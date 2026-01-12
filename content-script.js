let banner = null;
let currentHost = null;

function ensureBanner() {
  if (banner) return banner;
  banner = document.createElement("div");
  banner.id = "tab-limiter-banner";
  banner.style.position = "fixed";
  banner.style.bottom = "16px";
  banner.style.right = "16px";
  banner.style.zIndex = "2147483647";
  banner.style.background = "rgba(15, 23, 42, 0.92)";
  banner.style.color = "#fff";
  banner.style.padding = "8px 12px";
  banner.style.borderRadius = "999px";
  banner.style.fontSize = "12px";
  banner.style.fontFamily = "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  banner.style.boxShadow = "0 8px 20px rgba(15, 23, 42, 0.35)";
  banner.style.pointerEvents = "none";
  document.documentElement.appendChild(banner);
  return banner;
}

function updateBanner({ host, count, limit }) {
  if (!host || !limit) {
    if (banner) banner.remove();
    banner = null;
    currentHost = null;
    return;
  }
  currentHost = host;
  const el = ensureBanner();
  el.textContent = `${host}: ${count}/${limit} tabs`;
}

function requestStatus() {
  chrome.runtime.sendMessage(
    { type: "get-site-status", url: window.location.href },
    (response) => {
      if (chrome.runtime.lastError) return;
      updateBanner(response || {});
    }
  );
}

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type !== "site-status") return;
  if (!message.host || (currentHost && message.host !== currentHost)) return;
  updateBanner(message);
});

requestStatus();
