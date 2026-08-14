async function broadcast(tabId, eventName) {
  await chrome.scripting.executeScript({
    target: { tabId, allFrames: true },
    func: (name) => {
      document.dispatchEvent(new CustomEvent(name));
    },
    args: [eventName],
  });
}

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab?.id) return;
  try {
    await broadcast(tab.id, "et:toggle-pick");
  } catch (error) {
    console.warn("[element-transform] 无法在当前页面注入：", error.message);
  }
});

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg?.type === "et-frame-selected" && sender.tab?.id != null) {
    broadcast(sender.tab.id, "et:exit-pick").catch(() => {});
  }
});
