(() => {
  const adsTab = document.getElementById("ads-tab");
  const appAdsTab = document.getElementById("appads-tab");
  const sellerTab = document.getElementById("seller-tab");
  const output = document.getElementById("output");
  const filterCheckbox = document.getElementById("filter-checkbox");
  const filterBlock = document.getElementById("filter-block");
  const linkBlock = document.getElementById("link-block");

  let adsText = "";
  let appAdsText = "";
  let adsUrl = "";
  let appAdsUrl = "";
  let sellersData = [];
  let current = "seller";

  function getDomain() {
    return new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        try {
          const url = new URL(tabs[0].url);
          resolve(url.origin);
        } catch {
          resolve("");
        }
      });
    });
  }

  async function fetchTxtFile(base, name) {
    if (!base) return { text: `File ${name} not found.`, finalUrl: "" };
    try {
      const url = `${base.replace(/\/$/, "")}/${name}`;
      const res = await fetch(url, { redirect: "follow" });
      if (!res.ok) throw new Error("not found");
      return { text: await res.text(), finalUrl: res.url || url };
    } catch {
      return { text: `File ${name} not found.`, finalUrl: "" };
    }
  }

  async function fetchSellers() {
    try {
      const res = await fetch("https://adwmg.com/sellers.json");
      if (!res.ok) throw new Error("not found");
      const data = await res.json();
      sellersData = Array.isArray(data.sellers) ? data.sellers : [];
    } catch {
      sellersData = [];
    }
  }

  async function loadData() {
    const domain = await getDomain();
    const a = await fetchTxtFile(domain, "ads.txt");
    adsText = a.text;
    adsUrl = a.finalUrl || (domain ? `${domain}/ads.txt` : "");
    const b = await fetchTxtFile(domain, "app-ads.txt");
    appAdsText = b.text;
    appAdsUrl = b.finalUrl || (domain ? `${domain}/app-ads.txt` : "");
    await fetchSellers();
    showCurrent();
  }

  function highlightAdwmg(text) {
    return text.replace(/(adwmg.com)/gi, "<b>$1</b>");
  }

  function filterText(text) {
    if (!filterCheckbox.checked) return highlightAdwmg(text);
    const filtered = text.split("\n").filter(l => /adwmg/i.test(l)).join("\n");
    return filtered ? highlightAdwmg(filtered) : "No matches found.";
  }

  function extractAdwmgSellerIds(text) {
    const set = new Set();
    if (!text) return set;
    for (const raw of text.split("\n")) {
      if (!/adwmg/i.test(raw)) continue;
      const parts = raw.split(",").map(p => p.trim());
      if (parts.length >= 2 && /^\d+$/.test(parts[1])) set.add(parts[1]);
    }
    return set;
  }

  function findSellerMatchesForAdwmg() {
    const ids = new Set([
      ...extractAdwmgSellerIds(adsText),
      ...extractAdwmgSellerIds(appAdsText)
    ]);
    if (ids.size === 0) return [];
    return sellersData.filter(rec => ids.has(String(rec.seller_id))).map(rec => ({
      domain: rec.domain || "-",
      seller_id: rec.seller_id || "-",
      seller_type: rec.seller_type || "-"
    }));
  }

  function showCurrent() {
    let linkHtml = "";
    if (current === "ads") {
      filterBlock.style.display = "block";
      linkHtml = adsUrl ? `<a href="${adsUrl}" target="_blank">${adsUrl}</a>` : "";
      output.innerHTML = filterText(adsText);
    } else if (current === "appads") {
      filterBlock.style.display = "block";
      linkHtml = appAdsUrl ? `<a href="${appAdsUrl}" target="_blank">${appAdsUrl}</a>` : "";
      output.innerHTML = filterText(appAdsText);
    } else {
      filterBlock.style.display = "none";
      const matches = findSellerMatchesForAdwmg();
      if (matches.length === 0) {
        output.innerText = "No adwmg.com matches found.";
      } else {
        output.innerText = matches.map(m => `${m.domain} (${m.seller_id}) — ${m.seller_type}`).join("\n");
      }
    }
    linkBlock.innerHTML = linkHtml;
  }

  function setActive(tab) {
    current = tab;
    [adsTab, appAdsTab, sellerTab].forEach(b => b.classList.remove("active"));
    if (tab === "ads") adsTab.classList.add("active");
    if (tab === "appads") appAdsTab.classList.add("active");
    if (tab === "seller") sellerTab.classList.add("active");
    showCurrent();
  }

  adsTab.addEventListener("click", () => setActive("ads"));
  appAdsTab.addEventListener("click", () => setActive("appads"));
  sellerTab.addEventListener("click", () => setActive("seller"));
  filterCheckbox.addEventListener("change", showCurrent);

  filterCheckbox.checked = true;
  loadData();
})();