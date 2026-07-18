export default defineBackground(() => {
  const createMenu = () => {
    browser.contextMenus.removeAll(() => {
      browser.contextMenus.create({
        id: 'xir-rotate',
        title: '画像を90°回転',
        contexts: ['image'],
        documentUrlPatterns: ['*://x.com/*', '*://twitter.com/*'],
      });
    });
  };
  browser.runtime.onInstalled.addListener(createMenu);
  browser.runtime.onStartup.addListener(createMenu);

  browser.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'xir-rotate' && info.srcUrl && tab?.id != null) {
      browser.tabs.sendMessage(tab.id, { type: 'rotate', srcUrl: info.srcUrl });
    }
  });
});
