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
let current = "ads";
let matchedSellerIds = new Set();

// --- Helper: get current domain ---
async function getDomain() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      try {
        const url = new URL(tabs[0].url);
        resolve(url.origin);
      } catch (e) {
        resolve("");
      }
    });
  });
}

// --- Improved fetch with redirect handling ---
async function fetchTxtFile(baseUrl, filename) {
  if (!baseUrl) return { text: `File ${filename} not found.`, finalUrl: "" };
  try {
    const url = `${baseUrl}/${filename}`;
    const res = await fetch(url, { redirect: "follow" });

    // Handle redirect
    let finalUrl = url;
    if (res.redirected && res.url && res.url !== url) {
      finalUrl = res.url;
      console.log(`Redirected to: ${res.url}`);
      const redirectedRes = await fetch(res.url, { redirect: "follow" });
      if (!redirectedRes.ok) throw new Error("redirect fetch failed");
      return { text: await redirectedRes.text(), finalUrl };
    }

    if (!res.ok) throw new Error("not found");
    return { text: await res.text(), finalUrl };
  } catch (err) {
    console.warn("Error fetching:", baseUrl, filename, err);
    return { text: `File ${filename} not found.`, finalUrl: "" };
  }
}

// --- Fetch sellers.json from adWMG ---
async function fetchSellers() {
  try {
    const res = await fetch("https://adwmg.com/sellers.json");
    if (!res.ok) throw new Error("not found");
    const data = await res.json();
    sellersData = data.sellers || [];
  } catch {
    sellersData = [];
  }
}

// --- Load everything ---
async function loadData() {
  const domain = await getDomain();

  const adsResult = await fetchTxtFile(domain, "ads.txt");
  adsText = adsResult.text;
  adsUrl = adsResult.finalUrl || `${domain}/ads.txt`;

  const appResult = await fetchTxtFile(domain, "app-ads.txt");
  appAdsText = appResult.text;
  appAdsUrl = appResult.finalUrl || `${domain}/app-ads.txt`;

  await fetchSellers();
  showCurrent();
}

// --- Filter text and record seller IDs ---
function filterText(text) {
  matchedSellerIds.clear();
  if (!filterCheckbox.checked) return highlightAdwmg(text);

  const filtered = text
    .split("\n")
    .filter(line => /adwmg/i.test(line))
    .map(line => {
      const parts = line.split(",").map(p => p.trim());
      if (parts.length >= 2 && /^\d+$/.test(parts[1])) {
        matchedSellerIds.add(parts[1]);
      }
      return line;
    });

  const result = filtered.join("\n");
  return result ? highlightAdwmg(result) : "No matches found.";
}

// --- Highlight adwmg text ---
function highlightAdwmg(text) {
  return text.replace(/(adwmg)/gi, "<b>$1</b>");
}

// --- Match seller IDs ---
function findSellerMatchesFromFiltered() {
  if (matchedSellerIds.size === 0) return [];
  const results = [];
  for (const id of matchedSellerIds) {
    const found = sellersData.filter(s => String(s.seller_id) === id);
    for (const rec of found) {
      results.push({
        domain: rec.domain || "-",
        seller_id: id,
        seller_type: rec.seller_type || "-"
      });
    }
  }
  return results;
}

// --- Show current tab content ---
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
  } else if (current === "seller") {
    filterBlock.style.display = "none";
    const matches = findSellerMatchesFromFiltered();
    linkHtml = "";
    if (matches.length === 0) {
      output.innerText = "No matches found.";
    } else {
      const lines = matches.map(m => `${m.domain} (${m.seller_id}) — ${m.seller_type}`);
      output.innerText = lines.join("\n");
    }
  }

  linkBlock.innerHTML = linkHtml;
}

// --- Tab listeners ---
adsTab.addEventListener("click", () => setActive("ads"));
appAdsTab.addEventListener("click", () => setActive("appads"));
sellerTab.addEventListener("click", () => setActive("seller"));
filterCheckbox.addEventListener("change", showCurrent);

function setActive(tab) {
  current = tab;
  [adsTab, appAdsTab, sellerTab].forEach(b => b.classList.remove("active"));
  if (tab === "ads") adsTab.classList.add("active");
  if (tab === "appads") appAdsTab.classList.add("active");
  if (tab === "seller") sellerTab.classList.add("active");
  showCurrent();
}

// --- Default state ---
filterCheckbox.checked = true; // enabled by default
loadData();
