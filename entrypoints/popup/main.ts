const checkbox = document.getElementById('hoverButton') as HTMLInputElement;

browser.storage.sync.get({ hoverButton: true }).then(({ hoverButton }) => {
  checkbox.checked = Boolean(hoverButton);
});

checkbox.addEventListener('change', () => {
  browser.storage.sync.set({ hoverButton: checkbox.checked });
});
