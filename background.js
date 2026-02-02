const DEFAULT_SELLERS_URL = "https://adwmg.com/sellers.json";
const CACHE_KEY = "adwmg_sellers_cache";
const CACHE_TS_KEY = "adwmg_sellers_ts";

const BADGE_BG_COLOR = "#21aeb3";
const SCAN_COOLDOWN_MS = 60 * 1000;
const FETCH_TIMEOUT_MS = 8000;
const FETCH_RETRIES = 1;

const FIXED_CACHE_TTL_MS = 12 * 60 * 60 * 1000;

const INITIAL_DELAY_MS = 5000;
const RETRY_INTERVAL_MS = 5000;
const MAX_RETRIES = 2;

const countsByTab = Object.create(null);
const lastScanAt = Object.create(null);
const scheduledTimers = Object.create(null);
const retryAttempts = Object.create(null);

let sellersUrl = DEFAULT_SELLERS_URL;
let cacheTtlMs = FIXED_CACHE_TTL_MS;

async function fetchWithTimeoutAndRetry(url, { timeout = FETCH_TIMEOUT_MS, retries = FETCH_RETRIES, fetchOptions = {} } = {}) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
      const res = await fetch(url, { signal: controller.signal, ...fetchOptions });
      clearTimeout(id);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res;
    } catch (err) {
      clearTimeout(id);
      if (attempt === retries) throw err;
      await new Promise(r => setTimeout(r, 300 * (attempt + 1)));
    }
  }
}

async function fetchAndCacheSellers(force = false) {
  if (!sellersUrl) return null;
  try {
    const res = await fetchWithTimeoutAndRetry(sellersUrl, { timeout: FETCH_TIMEOUT_MS, retries: FETCH_RETRIES });
    const data = await res.json();
    const sellers = Array.isArray(data.sellers) ? data.sellers : [];
    const items = {};
    items[CACHE_KEY] = sellers;
    items[CACHE_TS_KEY] = Date.now();
    await new Promise((resolve) => chrome.storage.local.set(items, resolve));
    return sellers;
  } catch (err) {
    if (force) return null;
    return null;
  }
}

function getCachedSellers() {
  return new Promise((resolve) => {
    chrome.storage.local.get([CACHE_KEY, CACHE_TS_KEY], (res) => {
      resolve({
        sellers: Array.isArray(res[CACHE_KEY]) ? res[CACHE_KEY] : [],
        ts: res[CACHE_TS_KEY] || 0
      });
    });
  });
}

function applyBadgeForTab(tabId) {
  const count = countsByTab[tabId] || 0;
  const text = count > 0 ? String(count) : "";
  chrome.action.setBadgeText({ text });
  if (text) chrome.action.setBadgeBackgroundColor({ color: BADGE_BG_COLOR });
}

function cancelScheduled(tabId) {
  const t = scheduledTimers[tabId];
  if (t) {
    clearTimeout(t);
    delete scheduledTimers[tabId];
    delete retryAttempts[tabId];
  }
}

async function executeCountAdwmgLines(tabId, origin) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: (originUrl, timeoutMs) => {
        
        function fetchWithTimeout(url, timeout) {
          return new Promise((resolve) => {
            const controller = new AbortController();
            const id = setTimeout(() => {
              controller.abort();
              resolve(null);
            }, timeout);
            
            fetch(url, { signal: controller.signal, credentials: "same-origin" })
              .then(r => {
                clearTimeout(id);
                if (!r.ok) return resolve(null);
                r.text().then(t => resolve(t)).catch(() => resolve(null));
              })
              .catch(() => {
                clearTimeout(id);
                resolve(null);
              });
          });
        }
        
        function countAdwmgLines(text) {
          if (!text) return 0;
          return text.split("\n").filter(l => l.includes("adwmg.com")).length;
        }

        return (async () => {
          const baseUrl = originUrl.replace(/\/$/, "");
          const [adsText, appAdsTextLocal] = await Promise.all([
            fetchWithTimeout(baseUrl + "/ads.txt", timeoutMs),
            fetchWithTimeout(baseUrl + "/app-ads.txt", timeoutMs)
          ]);
          
          const adsCount = countAdwmgLines(adsText);
          
          return { 
            ok: true, 
            adsCount: adsCount,
            appAdsLocalFailed: appAdsTextLocal === null,
            appAdsCountLocal: countAdwmgLines(appAdsTextLocal)
          };
        })();
      },
      args: [origin, FETCH_TIMEOUT_MS],
      world: "MAIN"
    });

    if (!ArrayOfResults(results)) return { ok: false, count: 0 };
    const res0 = results[0].result;
    if (!res0 || res0.ok !== true) return { ok: false, count: 0 };
    
    let totalCount = res0.adsCount + res0.appAdsCountLocal;

    if (res0.appAdsLocalFailed) {
      
      const appAdsUrl = origin.replace(/\/$/, "") + "/app-ads.txt";
      let appAdsRedirectedText = null;
      
      try {
          const res = await fetchWithTimeoutAndRetry(appAdsUrl, { 
              timeout: FETCH_TIMEOUT_MS, 
              retries: 0
          });
          appAdsRedirectedText = await res.text();
          
      } catch (e) {
          appAdsRedirectedText = null; 
      }
      
      if (appAdsRedirectedText !== null) {
          const appAdsRedirectedCount = countAdwmgLines(appAdsRedirectedText);
          totalCount += appAdsRedirectedCount;
      }
    }
    
    return { ok: true, count: totalCount };

  } catch (err) {
    console.warn("executeCountAdwmgLines failed:", err && err.message);
    return { ok: false, count: 0 };
  }
}

function ArrayOfResults(results) {
    return Array.isArray(results) && results.length > 0 && results[0].result;
}
function countAdwmgLines(text) {
    if (!text) return 0;
    return text.split("\n").filter(l => l.includes("adwmg.com")).length;
}


async function processScan(tabId) {
  if (Date.now() - (lastScanAt[tabId] || 0) < SCAN_COOLDOWN_MS) return null;
  lastScanAt[tabId] = Date.now();

  const tab = await new Promise((resolve) => chrome.tabs.get(tabId, (t) => resolve(chrome.runtime.lastError ? null : t)));
  if (!tab || !tab.url || !/^https?:\/\//i.test(tab.url)) return null;
  
  const url = new URL(tab.url);
  const origin = url.origin;

  const scanRes = await executeCountAdwmgLines(tabId, origin);
  const matches = scanRes.count;

  if (!scanRes.ok && matches === 0) {
      countsByTab[tabId] = 0;
      return 0; 
  }

  countsByTab[tabId] = matches;
  return matches;
}

async function retryScanForTab(tabId) {
  cancelScheduled(tabId);
  
  const currentAttempts = (retryAttempts[tabId] || 0) + 1;
  retryAttempts[tabId] = currentAttempts;
  
  let matches = 0;
  let scanSuccessful = false;

  try {
    matches = await processScan(tabId);
    if (matches !== null) {
      scanSuccessful = true;
    }
  } catch (error) {
  }

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs[0] && tabs[0].id === tabId) applyBadgeForTab(tabId);
  });

  if ((scanSuccessful && matches > 0) || currentAttempts >= MAX_RETRIES) {
      delete retryAttempts[tabId];
      return;
  }

  if (currentAttempts < MAX_RETRIES) {
    scheduledTimers[tabId] = setTimeout(() => {
        delete scheduledTimers[tabId];
        retryScanForTab(tabId).catch(() => {});
    }, RETRY_INTERVAL_MS);
  }
}

function scheduleScan(tabId) {
  cancelScheduled(tabId);
  
  scheduledTimers[tabId] = setTimeout(() => {
    delete scheduledTimers[tabId];
    retryScanForTab(tabId).catch(() => {});
  }, INITIAL_DELAY_MS);
}

chrome.tabs.onActivated.addListener((activeInfo) => {
  applyBadgeForTab(activeInfo.tabId);
  scheduleScan(activeInfo.tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.url) {
    delete countsByTab[tabId];
    cancelScheduled(tabId);
    
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs[0] && tabs[0].id === tabId) applyBadgeForTab(tabId);
    });
    
    scheduleScan(tabId);
  } else if (changeInfo.status === "loading") {
    delete countsByTab[tabId];
    cancelScheduled(tabId);
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs[0] && tabs[0].id === tabId) applyBadgeForTab(tabId);
    });
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  delete countsByTab[tabId];
  delete lastScanAt[tabId];
  cancelScheduled(tabId);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const isAsync = true;
  
  (async () => {
    let response = {};
    if (!message || !message.type) { 
    } else if (message.type === "getSellersCache") {
      const cached = await getCachedSellers();
      if (!cached.ts || (Date.now() - cached.ts) > cacheTtlMs) { 
        fetchAndCacheSellers().catch(() => {});
      }
      response = { sellers: cached.sellers || [], ts: cached.ts || 0 };
    } else if (message.type === "refreshSellers") {
      const sellers = await fetchAndCacheSellers(true).catch(() => null);
      if (sellers) response = { ok: true, sellers }; else response = { ok: false };
    } else if (message.type === "setBadge") {
      const count = Number.isFinite(message.count) ? Math.max(0, message.count) : 0;
      const text = count > 0 ? String(count) : "";
      chrome.action.setBadgeText({ text });
      if (text) chrome.action.setBadgeBackgroundColor({ color: BADGE_BG_COLOR });
      response = { ok: true };
    } else if (message.type === "scanResult") {
      const tabId = sender && sender.tab && sender.tab.id;
      const count = Number.isFinite(message.count) ? Math.max(0, message.count) : 0;
      if (typeof tabId === "number") {
        countsByTab[tabId] = count;
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs && tabs[0] && tabs[0].id === tabId) applyBadgeForTab(tabId);
        });
      }
      response = { ok: true };
    }

    sendResponse(response);
  })().catch((error) => {
    console.error("Async response failed (Unexpected):", error && error.message || "Unknown error");
    sendResponse({ ok: false, error: error && error.message || "Unknown error" });
  });

  return isAsync;
});