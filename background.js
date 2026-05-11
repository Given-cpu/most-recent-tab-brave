"use strict";

// Save recents map to storage
async function saveRecents(recents) {
  const obj = {};
  for (let [windowId, queue] of recents) {
    obj[windowId] = queue;
  }
  await chrome.storage.session.set({ recents: obj });
}

// Load recents map from storage
async function loadRecents() {
  const result = await chrome.storage.session.get("recents");
  const map = new Map();
  if (result.recents) {
    for (let [windowId, queue] of Object.entries(result.recents)) {
      map.set(Number(windowId), queue);
    }
  }
  return map;
}

// Called every time you switch to a tab
async function tabActivated(newTabInfo) {
  let windowId = newTabInfo.windowId;
  let tabId = newTabInfo.tabId;

  let recents = await loadRecents();

  if (!recents.has(windowId)) {
    recents.set(windowId, []);
  }

  let queue = recents.get(windowId);

  let index = queue.indexOf(tabId);
  if (index >= 0) queue.splice(index, 1);

  queue.unshift(tabId);
  await saveRecents(recents);
}

// Called when you press a shortcut
async function jumpToTab(windowId, skip) {
  let recents = await loadRecents();
  let queue = recents.get(windowId);

  let targetIndex = 1 + skip;
  if (!queue || queue.length <= targetIndex) return;

  let targetTabId = queue[targetIndex];
  chrome.tabs.update(targetTabId, { active: true }, () => {
  if (chrome.runtime.lastError) {} // tab no longer exists, ignore
});
}

// Called when a tab is closed
async function tabRemoved(tabId, removeInfo) {
  if (removeInfo.isWindowClosing) return;

  let recents = await loadRecents();
  let queue = recents.get(removeInfo.windowId);
  if (!queue) return;

  let index = queue.indexOf(tabId);
  if (index >= 0) queue.splice(index, 1);
  await saveRecents(recents);
}

// Called when a window is closed
async function windowRemoved(windowId) {
  let recents = await loadRecents();
  recents.delete(windowId);
  await saveRecents(recents);
}

// Listen for shortcut keypresses
chrome.commands.onCommand.addListener((command) => {
  chrome.windows.getCurrent((windowInfo) => {
    switch (command) {
      case "most-recent-tab-1": jumpToTab(windowInfo.id, 0); break;
      case "most-recent-tab-2": jumpToTab(windowInfo.id, 1); break;
      case "most-recent-tab-3": jumpToTab(windowInfo.id, 2); break;
    }
  });
});

// Hook all the events
chrome.tabs.onActivated.addListener(tabActivated);
chrome.tabs.onRemoved.addListener(tabRemoved);
chrome.windows.onRemoved.addListener(windowRemoved);

// On startup, clear stale storage so old tab IDs don't cause errors
chrome.storage.session.clear();