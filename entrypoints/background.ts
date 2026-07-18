import { SITE_MATCHES } from '../lib/sites';

export default defineBackground(() => {
  const items = [
    { id: 'sir-rotate-left', title: '画像を左に90°回転' },
    { id: 'sir-rotate-right', title: '画像を右に90°回転' },
  ];

  const createMenu = () => {
    browser.contextMenus.removeAll(() => {
      for (const item of items) {
        browser.contextMenus.create({
          id: item.id,
          title: item.title,
          contexts: ['image'],
          documentUrlPatterns: SITE_MATCHES,
        });
      }
    });
  };
  browser.runtime.onInstalled.addListener(createMenu);
  browser.runtime.onStartup.addListener(createMenu);

  browser.contextMenus.onClicked.addListener((info, tab) => {
    const dir =
      info.menuItemId === 'sir-rotate-left'
        ? -90
        : info.menuItemId === 'sir-rotate-right'
          ? 90
          : 0;
    if (dir && info.srcUrl && tab?.id != null) {
      browser.tabs.sendMessage(tab.id, { type: 'rotate', srcUrl: info.srcUrl, dir });
    }
  });
});
