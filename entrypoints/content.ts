// Rotates tweet images on X. X renders the visible picture as a CSS
// background-image on a <div>, keeping a transparent <img> on top as the
// hit-target, so both elements must be transformed together.

const MEDIA_URL = 'pbs.twimg.com';
const HOST_ATTR = 'data-xir-host';
const ANGLE_ATTR = 'data-xir-angle';
const BTN_CLASS = 'xir-btn';
const DISABLED_CLASS = 'xir-hover-off';

export default defineContentScript({
  matches: ['*://x.com/*', '*://twitter.com/*'],
  main() {
    injectStyles();
    applyHoverSetting();
    browser.storage.onChanged.addListener((changes, area) => {
      if (area === 'sync' && changes.hoverButton) applyHoverSetting();
    });

    // Buttons are attached lazily on first hover; CSS shows them only while
    // the host is hovered.
    document.addEventListener('mouseover', (e) => {
      const host = resolveHost(e.target as Element | null);
      if (host && !host.querySelector(`.${BTN_CLASS}`)) attachButton(host);
    });

    browser.runtime.onMessage.addListener((message: unknown) => {
      const msg = message as { type?: string; srcUrl?: string };
      if (msg.type === 'rotate' && msg.srcUrl) rotateBySrc(msg.srcUrl);
    });
  },
});

async function applyHoverSetting() {
  const { hoverButton } = await browser.storage.sync.get({ hoverButton: true });
  document.documentElement.classList.toggle(DISABLED_CLASS, !hoverButton);
}

/** Find the positioned container that owns a tweet image, given any
 *  descendant. Covers timeline/quote photos and the lightbox viewer. */
function resolveHost(el: Element | null): HTMLElement | null {
  if (!el || !(el instanceof Element)) return null;

  const photo = el.closest<HTMLElement>('[data-testid="tweetPhoto"]');
  if (photo) return markHost(photo);

  // Lightbox: a plain <img> inside the modal viewer.
  const modal = el.closest<HTMLElement>('[aria-modal="true"]');
  if (modal) {
    const img =
      el instanceof HTMLImageElement && el.src.includes(MEDIA_URL)
        ? el
        : el.querySelector<HTMLImageElement>(`img[src*="${MEDIA_URL}"]`);
    const parent = img?.parentElement;
    if (parent) {
      if (getComputedStyle(parent).position === 'static') {
        parent.style.position = 'relative';
      }
      return markHost(parent);
    }
  }
  return null;
}

function markHost(host: HTMLElement): HTMLElement {
  host.setAttribute(HOST_ATTR, '');
  return host;
}

/** Both the visible background-image <div>s and the transparent <img>s. */
function rotationTargets(host: HTMLElement): HTMLElement[] {
  const targets: HTMLElement[] = [];
  for (const div of host.querySelectorAll<HTMLElement>('div')) {
    if (getComputedStyle(div).backgroundImage.includes(MEDIA_URL)) {
      targets.push(div);
    }
  }
  for (const img of host.querySelectorAll<HTMLImageElement>('img')) {
    if (img.src.includes(MEDIA_URL)) targets.push(img);
  }
  if (!targets.length && host instanceof HTMLElement) {
    const self = host.querySelector<HTMLImageElement>('img');
    if (self) targets.push(self);
  }
  return targets;
}

function rotate(host: HTMLElement) {
  const angle = (Number(host.getAttribute(ANGLE_ATTR) || 0) + 90) % 360;
  host.setAttribute(ANGLE_ATTR, String(angle));

  // A quarter-turned image must shrink to stay inside X's fixed-aspect frame.
  const rect = host.getBoundingClientRect();
  const fit =
    angle % 180 !== 0 && rect.width && rect.height
      ? Math.min(rect.width, rect.height) / Math.max(rect.width, rect.height)
      : 1;

  for (const target of rotationTargets(host)) {
    target.style.transition = 'transform 0.15s ease';
    target.style.transform =
      angle === 0 ? '' : `rotate(${angle}deg) scale(${fit})`;
  }
}

function rotateBySrc(srcUrl: string) {
  for (const img of document.querySelectorAll<HTMLImageElement>('img')) {
    if (img.src === srcUrl) {
      const host = resolveHost(img);
      if (host) rotate(host);
      return;
    }
  }
}

function attachButton(host: HTMLElement) {
  const btn = document.createElement('button');
  btn.className = BTN_CLASS;
  btn.type = 'button';
  btn.title = '90°回転';
  btn.setAttribute('aria-label', '画像を90°回転');
  btn.innerHTML =
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" ' +
    'stroke="currentColor" stroke-width="2.2" stroke-linecap="round" ' +
    'stroke-linejoin="round"><path d="M21 2v6h-6"/>' +
    '<path d="M21 8a9 9 0 1 0 2.2 5.7"/></svg>';
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    rotate(host);
  });
  host.appendChild(btn);
}

function injectStyles() {
  const style = document.createElement('style');
  style.textContent = `
    .${BTN_CLASS} {
      position: absolute;
      top: 8px;
      right: 8px;
      z-index: 10;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      padding: 0;
      border: none;
      border-radius: 9999px;
      background: rgba(0, 0, 0, 0.6);
      color: #fff;
      cursor: pointer;
      opacity: 0;
      transition: opacity 0.15s ease;
    }
    [${HOST_ATTR}]:hover .${BTN_CLASS},
    .${BTN_CLASS}:focus-visible {
      opacity: 1;
    }
    .${BTN_CLASS}:hover {
      background: rgba(0, 0, 0, 0.8);
    }
    .${DISABLED_CLASS} .${BTN_CLASS} {
      display: none;
    }
    /* The lightbox covers the image's top-right corner with a 60x60
       panel-toggle hit area, so the button moves to the bottom-right. */
    [aria-modal="true"] [${HOST_ATTR}] > .${BTN_CLASS} {
      top: auto;
      bottom: 8px;
    }
  `;
  document.head.appendChild(style);
}
