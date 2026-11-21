// Entry points only. All AI work happens in the app page.
chrome.action.onClicked.addListener((tab) => {
  const base = chrome.runtime.getURL('app/index.html');
  const url = tab.url ? base + '?src=' + encodeURIComponent(tab.url) : base;
  void chrome.tabs.create({ url });
});
