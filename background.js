const STORAGE_KEY = "siteLimits";

async function getLimits() {
  const result = await chrome.storage.sync.get(STORAGE_KEY);
  const list = Array.isArray(result[STORAGE_KEY]) ? result[STORAGE_KEY] : [];
  const map = new Map();
  for (const entry of list) {
    if (!entry || typeof entry.host !== "string") continue;
    const limit = Number(entry.limit);
    if (!Number.isFinite(limit) || limit <= 0) continue;
    map.set(entry.host.toLowerCase(), Math.floor(limit));
  }
  return map;
}

function getSuspendedTargetUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "chrome-extension:") return null;
    if (!parsed.pathname.endsWith("/suspended.html")) return null;
    const hashParams = new URLSearchParams(parsed.hash.replace(/^#/, ""));
    const searchParams = new URLSearchParams(parsed.search);
    return hashParams.get("uri") || searchParams.get("uri");
  } catch {
    return null;
  }
}

function getHostFromUrl(rawUrl) {
  if (!rawUrl) return null;
  const suspendedTarget = getSuspendedTargetUrl(rawUrl);
  const urlToParse = suspendedTarget || rawUrl;
  try {
    const parsed = new URL(urlToParse);
    return parsed.hostname.toLowerCase();
  } catch {
    return null;
  }
}

async function enforceLimit(tab) {
  if (!tab || !tab.id) return;
  const host = getHostFromUrl(tab.url);
  if (!host) return;

  const limits = await getLimits();
  const limit = limits.get(host);
  if (!limit) return;

  const tabs = await chrome.tabs.query({});
  const matching = tabs.filter((t) => getHostFromUrl(t.url) === host);

  if (matching.length <= limit) return;

  const ids = matching
    .filter((t) => t.id !== undefined)
    .sort((a, b) => (b.id || 0) - (a.id || 0))
    .map((t) => t.id);

  const toClose = ids[0];
  if (toClose !== undefined) {
    await chrome.tabs.remove(toClose);
  }
}

chrome.tabs.onCreated.addListener((tab) => {
  void enforceLimit(tab);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url || changeInfo.status === "complete") {
    void enforceLimit(tab);
  }
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && changes[STORAGE_KEY]) {
    chrome.tabs.query({}, (tabs) => {
      for (const tab of tabs) {
        void enforceLimit(tab);
      }
    });
  }
});
