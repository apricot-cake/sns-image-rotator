// __MSG_*__ is only substituted in the manifest, not in HTML, so set every
// localized string here. The <title> tag exists to feed action.default_title.
document.title = browser.i18n.getMessage('extName');
document.documentElement.lang = browser.i18n.getUILanguage();

const label = document.getElementById('hoverButtonLabel') as HTMLSpanElement;
label.textContent = browser.i18n.getMessage('popupHoverToggle');

const hint = document.getElementById('hint') as HTMLParagraphElement;
hint.textContent = browser.i18n.getMessage('popupHint');

const checkbox = document.getElementById('hoverButton') as HTMLInputElement;

browser.storage.sync.get({ hoverButton: false }).then(({ hoverButton }) => {
  checkbox.checked = Boolean(hoverButton);
});

checkbox.addEventListener('change', () => {
  browser.storage.sync.set({ hoverButton: checkbox.checked });
});
