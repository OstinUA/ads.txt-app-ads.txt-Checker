(() => {
  const adsTab = document.getElementById("ads-tab");
  const appAdsTab = document.getElementById("appads-tab");
  const sellerTab = document.getElementById("seller-tab");
  const output = document.getElementById("output");
  const filterArea = document.getElementById("filter-area");
  const linkBlock = document.getElementById("link-block");
  const filterStatusText = document.getElementById("filter-status-text");
  
  const settingsToggle = document.getElementById("settings-toggle");
  const settingsPanel = document.getElementById("settings-panel");
  const urlInput = document.getElementById("sellers-url-input");
  const saveBtn = document.getElementById("save-settings");

  const adsCountEl = document.getElementById("ads-line-count");
  const appAdsCountEl = document.getElementById("appads-line-count");
  const sellerCountEl = document.getElementById("seller-line-count");

  let adsText = "";
  let appAdsText = "";
  let adsUrl = "";
  let appAdsUrl = "";
  let sellersData = [];
  let current = "seller";
  let isFilterActive = true;
  let currentSellersUrl = "https://adwmg.com/sellers.json";

  function sendMessageSafe(message, callback = () => {}) {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) return;
      callback(response);
    });
  }

  function getBrandName(url) {
    try {
      const hostname = new URL(url).hostname;
      const parts = hostname.replace("www.", "").split(".");
      return parts[0] || "adWMG";
    } catch {
      return "adWMG";
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

  async function fetchWithTimeoutAndRetry(url, { timeout = 8000, retries = 1 } = {}) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeout);
      try {
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(id);
        return res;
      } catch (err) {
        clearTimeout(id);
        if (attempt === retries) throw err;
        await new Promise(r => setTimeout(r, 200 * (attempt + 1)));
      }
    }
  }

  async function fetchTxtFile(base, name) {
    if (!base) return { text: `File ${name} not found (Invalid Origin).`, isError: true };
    const url = `${base.replace(/\/$/, "")}/${name}`;
    try {
      const res = await fetchWithTimeoutAndRetry(url);
      if (!res.ok) return { text: `File ${name} not found (Error: ${res.status}).`, isError: true };
      const text = await res.text();
      return { text, finalUrl: res.url || url, isError: false };
    } catch {
      return { text: `File ${name} not found (Network Error).`, isError: true };
    }
  }

  function renderTextSafe(container, text) {
    container.innerHTML = "";
    if (!text) return;
    const brand = getBrandName(currentSellersUrl).toLowerCase();
    const highlightRegex = new RegExp(`(${brand})`, "gi");
    
    const lines = text.split("\n");
    lines.forEach(line => {
      const lineNode = document.createElement("div");
      let lastIndex = 0;
      let match;
      while ((match = highlightRegex.exec(line)) !== null) {
        lineNode.appendChild(document.createTextNode(line.substring(lastIndex, match.index)));
        const b = document.createElement("b");
        b.textContent = match[0];
        lineNode.appendChild(b);
        lastIndex = highlightRegex.lastIndex;
      }
      lineNode.appendChild(document.createTextNode(line.substring(lastIndex)));
      container.appendChild(lineNode);
    });
  }

  function filterAndRender(text, container) {
    const brand = getBrandName(currentSellersUrl).toLowerCase();
    if (!isFilterActive) {
      renderTextSafe(container, text);
      return;
    }
    const filtered = (text || "").split("\n").filter(l => l.toLowerCase().includes(brand));
    if (filtered.length === 0) {
      container.textContent = `No ${brand} matches found.`;
    } else {
      renderTextSafe(container, filtered.join("\n"));
    }
  }

  function extractAdwmgSellerIds(text) {
    const set = new Set();
    if (!text) return set;
    const brand = getBrandName(currentSellersUrl).toLowerCase();
    text.split("\n").forEach(raw => {
      if (raw.toLowerCase().includes(brand)) {
        const parts = raw.split(",").map(p => p.trim());
        if (parts.length >= 2) {
          const id = parts[1].replace(/\D/g, "");
          if (id) set.add(id);
        }
      }
    });
    return set;
  }

  function findSellerMatches() {
    const ids = new Set([...extractAdwmgSellerIds(adsText), ...extractAdwmgSellerIds(appAdsText)]);
    return sellersData.filter(rec => ids.has(String(rec.seller_id)));
  }

  function showCurrent() {
    linkBlock.textContent = "";
    const brand = getBrandName(currentSellersUrl);
    if (current === "seller") {
      filterArea.style.display = "none";
      const matches = findSellerMatches();
      sellerCountEl.textContent = matches.length > 0 ? matches.length : "0";
      if (matches.length === 0) {
        output.textContent = `No ${brand} matches found.`;
      } else {
        output.textContent = matches.map(m => `${m.domain} (${m.seller_id}) — ${m.seller_type}`).join("\n");
      }
    } else {
      filterArea.style.display = "block";
      const text = current === "ads" ? adsText : appAdsText;
      const url = current === "ads" ? adsUrl : appAdsUrl;
      
      if (url) {
        const a = document.createElement("a");
        a.href = url; a.target = "_blank"; a.textContent = url;
        linkBlock.appendChild(a);
      }
      filterAndRender(text, output);
    }
    
    const matches = findSellerMatches();
    sendMessageSafe({ type: "setBadge", count: matches.length });
  }

  function setActive(tab) {
    current = tab;
    [adsTab, appAdsTab, sellerTab].forEach(b => b.classList.remove("active"));
    document.getElementById(`${tab}-tab`).classList.add("active");
    showCurrent();
  }

  // Настройки
  settingsToggle.addEventListener("click", () => {
    settingsPanel.style.display = settingsPanel.style.display === "none" ? "flex" : "none";
  });

  saveBtn.addEventListener("click", () => {
    const newUrl = urlInput.value.trim();
    if (newUrl) {
      chrome.storage.local.set({ custom_sellers_url: newUrl }, () => {
        currentSellersUrl = newUrl;
        updateFilterText();
        settingsPanel.style.display = "none";
        sendMessageSafe({ type: "refreshSellers" }, (resp) => {
           loadData();
        });
      });
    }
  });

  adsTab.addEventListener("click", () => setActive("ads"));
  appAdsTab.addEventListener("click", () => setActive("appads"));
  sellerTab.addEventListener("click", () => setActive("seller"));

  filterArea.addEventListener("click", () => {
    isFilterActive = !isFilterActive;
    filterArea.classList.toggle("active", isFilterActive);
    showCurrent();
  });

  async function loadData() {
    output.textContent = "Loading...";
    chrome.storage.local.get(["custom_sellers_url"], (res) => {
      if (res.custom_sellers_url) {
        currentSellersUrl = res.custom_sellers_url;
        urlInput.value = currentSellersUrl;
      }
      updateFilterText();

      chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
        let origin = "";
        try {
          const url = new URL(tabs[0].url);
          if (url.protocol.startsWith("http")) origin = url.origin;
        } catch {}

        const [adsRes, appRes] = await Promise.all([
          fetchTxtFile(origin, "ads.txt"),
          fetchTxtFile(origin, "app-ads.txt")
        ]);

        adsText = adsRes.text;
        adsUrl = adsRes.finalUrl || (origin ? `${origin}/ads.txt` : "");
        appAdsText = appRes.text;
        appAdsUrl = appRes.finalUrl || (origin ? `${origin}/app-ads.txt` : "");

        adsCountEl.textContent = countLines(adsText, adsRes.isError);
        appAdsCountEl.textContent = countLines(appAdsText, appRes.isError);

        sendMessageSafe({ type: "getSellersCache" }, (response) => {
          sellersData = (response && response.sellers) || [];
          showCurrent();
        });
      });
    });
  }

  if (isFilterActive) filterArea.classList.add("active");
  loadData();
})();