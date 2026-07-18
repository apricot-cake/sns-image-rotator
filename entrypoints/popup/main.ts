// __MSG_*__ is only substituted in the manifest, not in HTML, so set the
// localized title here (the <title> tag exists to feed action.default_title).
document.title = browser.i18n.getMessage('extName');

const checkbox = document.getElementById('hoverButton') as HTMLInputElement;

browser.storage.sync.get({ hoverButton: true }).then(({ hoverButton }) => {
  checkbox.checked = Boolean(hoverButton);
});

checkbox.addEventListener('change', () => {
  browser.storage.sync.set({ hoverButton: checkbox.checked });
});
