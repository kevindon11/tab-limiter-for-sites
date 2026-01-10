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

function getHostFromTab(tab) {
  return getHostFromUrl(tab?.pendingUrl || tab?.url);
}

async function getTabsByHost(host) {
  const tabs = await chrome.tabs.query({});
  return tabs.filter((t) => getHostFromTab(t) === host);
}

async function sendHostStatus(host) {
  const limits = await getLimits();
  const limit = limits.get(host);
  if (!limit) return;
  const tabs = await getTabsByHost(host);
  const payload = {
    type: "site-status",
    host,
    count: tabs.length,
    limit,
  };
  for (const tab of tabs) {
    if (!tab.id) continue;
    chrome.tabs.sendMessage(tab.id, payload).catch(() => {});
  }
}

async function enforceLimit(tab) {
  if (!tab || !tab.id) return;
  const host = getHostFromTab(tab);
  if (!host) return;

  const limits = await getLimits();
  const limit = limits.get(host);
  if (!limit) return;

  const matching = await getTabsByHost(host);

  if (matching.length <= limit) {
    await sendHostStatus(host);
    return;
  }

  const ids = matching
    .filter((t) => t.id !== undefined)
    .sort((a, b) => (b.id || 0) - (a.id || 0))
    .map((t) => t.id);

  const toClose = ids[0];
  if (toClose !== undefined) {
    await chrome.tabs.remove(toClose);
  }

  await sendHostStatus(host);
}

chrome.tabs.onCreated.addListener((tab) => {
  void enforceLimit(tab);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url || changeInfo.status === "complete" || changeInfo.pendingUrl) {
    void enforceLimit(tab);
    const host = getHostFromTab(tab);
    if (host) {
      void sendHostStatus(host);
    }
  }
});

chrome.tabs.onRemoved.addListener(() => {
  chrome.tabs.query({}, async (tabs) => {
    const limits = await getLimits();
    const hosts = new Set();
    for (const tab of tabs) {
      const host = getHostFromTab(tab);
      if (host && limits.has(host)) hosts.add(host);
    }
    for (const host of hosts) {
      void sendHostStatus(host);
    }
  });
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && changes[STORAGE_KEY]) {
    chrome.tabs.query({}, (tabs) => {
      for (const tab of tabs) {
        void enforceLimit(tab);
      }
      const hosts = new Set();
      for (const tab of tabs) {
        const host = getHostFromTab(tab);
        if (host) hosts.add(host);
      }
      for (const host of hosts) {
        void sendHostStatus(host);
      }
    });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "get-site-status") return;
  const host = getHostFromUrl(message.url);
  if (!host) {
    sendResponse({ host: null, count: 0, limit: null });
    return;
  }
  void (async () => {
    const limits = await getLimits();
    const limit = limits.get(host) || null;
    if (!limit) {
      sendResponse({ host, count: 0, limit: null });
      return;
    }
    const tabs = await getTabsByHost(host);
    sendResponse({ host, count: tabs.length, limit });
  })();
  return true;
});
