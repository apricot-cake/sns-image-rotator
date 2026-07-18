export default defineBackground(() => {
  const items = [
    { id: 'xir-rotate-left', title: '画像を左に90°回転' },
    { id: 'xir-rotate-right', title: '画像を右に90°回転' },
  ];

  const createMenu = () => {
    browser.contextMenus.removeAll(() => {
      for (const item of items) {
        browser.contextMenus.create({
          id: item.id,
          title: item.title,
          contexts: ['image'],
          documentUrlPatterns: ['*://x.com/*', '*://twitter.com/*'],
        });
      }
    });
  };
  browser.runtime.onInstalled.addListener(createMenu);
  browser.runtime.onStartup.addListener(createMenu);

  browser.contextMenus.onClicked.addListener((info, tab) => {
    const dir =
      info.menuItemId === 'xir-rotate-left'
        ? -90
        : info.menuItemId === 'xir-rotate-right'
          ? 90
          : 0;
    if (dir && info.srcUrl && tab?.id != null) {
      browser.tabs.sendMessage(tab.id, { type: 'rotate', srcUrl: info.srcUrl, dir });
    }
  });
});
