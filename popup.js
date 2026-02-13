(() => {
  const adsTab = document.getElementById("ads-tab");
  const appAdsTab = document.getElementById("appads-tab");
  const sellerTab = document.getElementById("seller-tab");
  const output = document.getElementById("output");
  
  const filterArea = document.getElementById("filter-area");
  const filterLeftSection = document.getElementById("filter-left-section");
  const linkBlock = document.getElementById("link-block");
  const filterStatusText = document.getElementById("filter-status-text");
  
  const settingsToggle = document.getElementById("settings-toggle");
  const settingsPanel = document.getElementById("settings-panel");
  const urlInput = document.getElementById("sellers-url-input");
  const saveBtn = document.getElementById("save-settings");
  const refreshCacheBtn = document.getElementById("force-refresh-cache");

  const adsCountEl = document.getElementById("ads-line-count");
  const appAdsCountEl = document.getElementById("appads-line-count");
  const sellerCountEl = document.getElementById("seller-line-count");

  const statusContainer = document.getElementById("status-container");
  const fileDateEl = document.getElementById("file-date");
  const ownerBadgeEl = document.getElementById("owner-badge");

  let adsData = { text: "", url: "", date: null };
  let appAdsData = { text: "", url: "", date: null };
  
  let sellersData = [];
  let current = "seller";
  let isFilterActive = true;
  let currentSellersUrl = "https://yoursite.com/sellers.json";
  let currentTabDomain = "";

  function sendMessageSafe(message, callback = () => {}) {
    if (!chrome.runtime || !chrome.runtime.id) return;
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) return;
      if (callback) callback(response);
    });
  }

  function getBrandName(url) {
    try {
      const hostname = new URL(url).hostname;
      return hostname.replace("www.", "").split(".")[0] || "yoursite";
    } catch {
      return "yoursite";
    }
  }

  function updateFilterText() {
    const brand = getBrandName(currentSellersUrl);
    filterStatusText.textContent = `Show only ${brand}`;
  }

  function countLines(text, isError) {
    if (!text || isError) return "";
    const count = text.split("\n").filter(line => line.trim().length > 0).length;
    return count > 0 ? count : "0";
  }

  async function fetchWithTimeoutAndRetry(url, { timeout = 8000, retries = 1, force = false } = {}) {
    const fetchOptions = force ? { cache: "reload" } : {};
    for (let attempt = 0; attempt <= retries; attempt++) {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeout);
      try {
        const res = await fetch(url, { signal: controller.signal, ...fetchOptions });
        clearTimeout(id);
        return res;
      } catch (err) {
        clearTimeout(id);
        if (attempt === retries) throw err;
        await new Promise(r => setTimeout(r, 200 * (attempt + 1)));
      }
    }
  }

  async function fetchTxtFile(base, name, force = false) {
    if (!base) return { text: `File ${name} not found.`, isError: true };
    const url = `${base.replace(/\/$/, "")}/${name}`;
    try {
      const res = await fetchWithTimeoutAndRetry(url, { force });
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.toLowerCase().includes("text/html")) {
        return { text: `Error: ${name} returned HTML header (likely a 404 page).`, isError: true };
      }
      if (!res.ok) return { text: `File ${name} not found (Error: ${res.status}).`, isError: true };
      
      const text = await res.text();
      const textTrimmed = text.trim();

      if (textTrimmed.startsWith("<!DOCTYPE") || 
          textTrimmed.startsWith("<html") || 
          textTrimmed.startsWith("<head") || 
          textTrimmed.startsWith("<body") ||
          textTrimmed.substring(0, 300).toLowerCase().includes("<script")) {
         return { text: `Error: ${name} appears to be an HTML page (Soft 404), not a valid text file.`, isError: true };
      }

      const lastModified = res.headers.get("Last-Modified");
      return { text, finalUrl: res.url || url, lastModified: lastModified, isError: false };
    } catch {
      return { text: `File ${name} not found (Network Error).`, isError: true };
    }
  }

  function cleanDomain(input) {
    if (!input) return "";
    let d = input.toLowerCase().trim();
    d = d.replace(/^https?:\/\//, "");
    d = d.replace(/^www\./, "");
    d = d.replace(/\.+/g, "."); 
    d = d.split(/[/?#\s,;=:]/)[0];
    return d;
  }

  function checkOwnerDomain(text) {
    if (!text) return { status: "NOT FOUND", value: null };
    const lines = text.split(/\r?\n/);
    let foundRawValue = null;
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (line.toUpperCase().startsWith("OWNERDOMAIN")) {
        let val = line.substring(11).trim().replace(/^[,=:]/, "").trim();
        if (val) { foundRawValue = val.split(/\s+/)[0]; break; }
      }
    }
    if (!foundRawValue) return { status: "NOT FOUND", value: null };
    const ownerClean = cleanDomain(foundRawValue);
    const siteClean = cleanDomain(currentTabDomain);
    if (ownerClean === siteClean || siteClean.endsWith("." + ownerClean)) {
      return { status: "MATCH", value: foundRawValue };
    }
    return { status: "MISMATCH", value: foundRawValue };
  }

  function isIdInSellers(sellerId) {
    if (!sellersData || sellersData.length === 0) return true;
    return sellersData.some(s => String(s.seller_id) === String(sellerId));
  }

  function renderTextSafe(container, text) {
    container.innerHTML = "";
    if (!text) return;
    const brand = getBrandName(currentSellersUrl).toLowerCase();
    const highlightRegex = new RegExp(`(${brand})`, "gi");

    text.split("\n").forEach(line => {
      const trimmedLine = line.trim();
      if (trimmedLine.length === 0) return;

      const lineNode = document.createElement("div");
      lineNode.className = "line-row";
      let warningTitle = "";
      let isError = false;
      let isMismatch = false;

      if (trimmedLine.toLowerCase().includes(brand)) {
        const hasComma = trimmedLine.includes(",");
        const startsWithSpecial = /^[^a-zA-Z0-9]/.test(trimmedLine);

        if (startsWithSpecial && hasComma) {
          isError = true;
          warningTitle = "Error: Data line is commented out!";
          lineNode.classList.add("line-critical-error"); 
        }

        const parts = trimmedLine.split(",").map(p => p.trim());
        if (parts.length >= 2) {
          const cleanId = parts[1].split(/\s+/)[0].replace(/[^a-zA-Z0-9]/g, ""); 
          if (cleanId && !isIdInSellers(cleanId)) {
            isMismatch = true;
            if (!isError && !startsWithSpecial) {
              lineNode.classList.add("line-warning");
              warningTitle = "Warning: ID not found in sellers.json";
            }
          }
        }
      }

      let lastIndex = 0; let match;
      while ((match = highlightRegex.exec(line)) !== null) {
        lineNode.appendChild(document.createTextNode(line.substring(lastIndex, match.index)));
        const b = document.createElement("b"); b.textContent = match[0];
        lineNode.appendChild(b);
        lastIndex = highlightRegex.lastIndex;
      }
      lineNode.appendChild(document.createTextNode(line.substring(lastIndex)));

      if (isError || (isMismatch && !/^[^a-zA-Z0-9]/.test(trimmedLine))) {
        const warnSpan = document.createElement("span");
        warnSpan.className = "warning-icon";
        warnSpan.textContent = isError ? "(X)" : "(!)";
        warnSpan.title = warningTitle;
        lineNode.appendChild(warnSpan);
      }
      container.appendChild(lineNode);
    });
  }

  function filterAndRender(text, container) {
    const brand = getBrandName(currentSellersUrl).toLowerCase();
    if (!isFilterActive) { renderTextSafe(container, text); return; }
    const filtered = (text || "").split("\n").filter(l => l.toLowerCase().includes(brand));
    if (filtered.length === 0) { container.textContent = `No ${brand} matches.`; } 
    else { renderTextSafe(container, filtered.join("\n")); }
  }

  function findSellerMatches() {
    const brand = getBrandName(currentSellersUrl).toLowerCase();
    const extractIds = (t) => {
      const set = new Set();
      (t || "").split("\n").forEach(l => {
        const trimmed = l.trim();
        if (trimmed.toLowerCase().includes(brand) && !/^[^a-zA-Z0-9]/.test(trimmed)) {
          const p = l.split(",").map(x => x.trim());
          if (p.length >= 2) { const id = p[1].replace(/[^a-zA-Z0-9]/g, ""); if (id) set.add(id); }
        }
      });
      return set;
    };
    const ids = new Set([...extractIds(adsData.text), ...extractIds(appAdsData.text)]);
    return sellersData.filter(rec => ids.has(String(rec.seller_id)));
  }

  function updateStatusInfo(type) {
    if (type === "seller") { statusContainer.style.display = "none"; return; }
    statusContainer.style.display = "flex";
    const data = type === "ads" ? adsData : appAdsData;
    if (data.date) {
      const d = new Date(data.date);
      fileDateEl.textContent = `Modified: ${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
    } else { fileDateEl.textContent = ""; }
    
    const ownerResult = checkOwnerDomain(data.text);
    ownerBadgeEl.innerHTML = "";
    
    if (ownerResult.status === "NOT FOUND") {
      ownerBadgeEl.className = "badge neutral";
      ownerBadgeEl.textContent = "OWNER: NOT FOUND";
    } else if (ownerResult.status === "MATCH") {
      ownerBadgeEl.className = "badge success";
      ownerBadgeEl.textContent = "OWNER: MATCH";
    } else {
      ownerBadgeEl.className = "badge error";
      ownerBadgeEl.textContent = "OWNER: ";
      const link = document.createElement("a");
      let href = ownerResult.value;
      if (!href.startsWith("http")) href = "http://" + href;
      link.href = href;
      link.target = "_blank";
      link.textContent = ownerResult.value;
      link.style.color = "inherit";
      link.style.textDecoration = "underline";
      ownerBadgeEl.appendChild(link);
    }
  }

  function showCurrent() {
    linkBlock.textContent = "";
    const brand = getBrandName(currentSellersUrl);
    if (current === "seller") {
      statusContainer.style.display = "none"; 
      filterArea.style.display = "none";
      const matches = findSellerMatches();
      sellerCountEl.textContent = matches.length || "0";
      output.innerHTML = "";
      if (matches.length === 0) {
        output.textContent = `No ${brand} matches.`;
      } else {
        const currentDomainClean = cleanDomain(currentTabDomain);
        matches.forEach(m => {
          const d = document.createElement("div");
          d.className = "line-row";
          const sellerDomainClean = cleanDomain(m.domain);
          if (sellerDomainClean === currentDomainClean && currentDomainClean !== "") {
            d.classList.add("highlight-own-domain");
          }
          d.textContent = `${m.domain} (${m.seller_id}) — ${m.seller_type}`;
          output.appendChild(d);
        });
      }
    } else {
      updateStatusInfo(current); 
      filterArea.style.display = "flex";
      const data = current === "ads" ? adsData : appAdsData;
      if (data.url) { 
        const a = document.createElement("a"); 
        a.href = data.url; 
        a.target = "_blank"; 
        a.textContent = data.url; 
        linkBlock.appendChild(a); 
      }
      filterAndRender(data.text, output);
    }
    sendMessageSafe({ type: "setBadge", count: findSellerMatches().length });
  }

  function setActive(tab) { current = tab; [adsTab, appAdsTab, sellerTab].forEach(b => b.classList.toggle("active", b.id === `${tab}-tab`)); showCurrent(); }

  settingsToggle.addEventListener("click", () => { settingsPanel.style.display = settingsPanel.style.display === "none" ? "flex" : "none"; });

  saveBtn.addEventListener("click", () => {
    const newUrl = urlInput.value.trim();
    if (newUrl) {
      chrome.storage.local.set({ custom_sellers_url: newUrl }, () => {
        currentSellersUrl = newUrl; updateFilterText();
        sendMessageSafe({ type: "refreshSellers" }, () => loadData(true));
      });
    }
  });

  refreshCacheBtn.addEventListener("click", () => {
    refreshCacheBtn.textContent = "..."; refreshCacheBtn.disabled = true;
    sendMessageSafe({ type: "refreshSellers" }, () => {
      loadData(true).then(() => {
        refreshCacheBtn.textContent = "Cache"; refreshCacheBtn.disabled = false;
      });
    });
  });

  adsTab.addEventListener("click", () => setActive("ads"));
  appAdsTab.addEventListener("click", () => setActive("appads"));
  sellerTab.addEventListener("click", () => setActive("seller"));
  filterLeftSection.addEventListener("click", () => { isFilterActive = !isFilterActive; filterArea.classList.toggle("active", isFilterActive); showCurrent(); });

  async function loadData(force = false) {
    output.textContent = "Loading...";
    return new Promise((resolve) => {
      chrome.storage.local.get(["custom_sellers_url"], (res) => {
        if (res.custom_sellers_url) { currentSellersUrl = res.custom_sellers_url; urlInput.value = currentSellersUrl; }
        updateFilterText();
        chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
          let origin = ""; try { const u = new URL(tabs[0].url); if (u.protocol.startsWith("http")) { origin = u.origin; currentTabDomain = u.hostname; } } catch {}
          const [adsRes, appRes] = await Promise.all([
            fetchTxtFile(origin, "ads.txt", force),
            fetchTxtFile(origin, "app-ads.txt", force)
          ]);
          adsData = { text: adsRes.text, url: adsRes.finalUrl || (origin ? `${origin}/ads.txt` : ""), date: adsRes.lastModified };
          appAdsData = { text: appRes.text, url: appRes.finalUrl || (origin ? `${origin}/app-ads.txt` : ""), date: appRes.lastModified };
          adsCountEl.textContent = countLines(adsData.text, adsRes.isError);
          appAdsCountEl.textContent = countLines(appAdsData.text, appRes.isError);
          sendMessageSafe({ type: "getSellersCache" }, (resp) => {
            sellersData = (resp && resp.sellers) || [];
            showCurrent(); resolve();
          });
        });
      });
    });
  }

  loadData(false);
  if (isFilterActive) filterArea.classList.add("active");
})();