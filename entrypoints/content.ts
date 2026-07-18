// Rotates tweet images on X. X renders the visible picture as a CSS
// background-image on a <div>, keeping a transparent <img> on top as the
// hit-target, so both elements must be transformed together.

const MEDIA_URL = 'pbs.twimg.com';
const HOST_ATTR = 'data-xir-host';
const ANGLE_ATTR = 'data-xir-angle';
const GROUP_CLASS = 'xir-group';
const BTN_CLASS = 'xir-btn';
const DISABLED_CLASS = 'xir-hover-off';
const LIGHTBOX_SEL = '[aria-modal="true"]';
const SLOT_SEL = '[data-testid="swipe-to-dismiss"]';

// Enlarged timeline frames take the rotated image's own aspect ratio so it
// fills them edge to edge. This only bounds pathological cases (a panorama
// rotated upright) at height = 3x width; normal sideways art never reaches it.
const FRAME_ASPECT_CAP = 3;

// A rotate arrow drawn clockwise; mirrored horizontally for the CCW variant.
const ARROW =
  '<path d="M21 2v6h-6"/><path d="M21 8a9 9 0 1 0 2.2 5.7"/>';

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
      if (host && !host.querySelector(`.${GROUP_CLASS}`)) attachButtons(host);
    });

    browser.runtime.onMessage.addListener((message: unknown) => {
      const msg = message as { type?: string; srcUrl?: string; dir?: number };
      if (msg.type === 'rotate' && msg.srcUrl) {
        rotateBySrc(msg.srcUrl, msg.dir ?? 90);
      }
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
  const modal = el.closest<HTMLElement>(LIGHTBOX_SEL);
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
  if (!targets.length) {
    const self = host.querySelector<HTMLImageElement>('img');
    if (self) targets.push(self);
  }
  return targets;
}

/** How much to scale a quarter-turned image so it fills the space available.
 *  In the lightbox that space is the whole modal slot (so sideways art can
 *  grow to fill the viewport, not just the letterboxed frame); in the
 *  timeline it is the fixed frame, which we must not overflow into the feed. */
function fitScale(host: HTMLElement): number {
  const rect = host.getBoundingClientRect();
  if (!rect.width || !rect.height) return 1;

  const slot = host.closest<HTMLElement>(SLOT_SEL);
  if (slot && host.closest(LIGHTBOX_SEL)) {
    unclip(host, slot);
    const avail = slot.getBoundingClientRect();
    // After a quarter turn the on-screen bounds are height × width.
    return Math.min(avail.width / rect.height, avail.height / rect.width);
  }
  return Math.min(rect.width, rect.height) / Math.max(rect.width, rect.height);
}

/** Lift the overflow:hidden clips between the image and its modal slot so a
 *  scaled-up rotation isn't cropped back to the original frame. */
function unclip(from: HTMLElement, to: HTMLElement) {
  let el: HTMLElement | null = from;
  while (el && el !== to) {
    if (getComputedStyle(el).overflow !== 'visible') el.style.overflow = 'visible';
    el = el.parentElement;
  }
}

function rotate(host: HTMLElement, dir: number) {
  const angle =
    (((Number(host.getAttribute(ANGLE_ATTR) || 0) + dir) % 360) + 360) % 360;
  host.setAttribute(ANGLE_ATTR, String(angle));

  if (!host.closest(LIGHTBOX_SEL) && rotateResizingFrame(host, angle)) return;

  const scale = angle % 180 === 0 ? 1 : fitScale(host);
  for (const target of rotationTargets(host)) {
    target.style.transformOrigin = 'center center';
    target.style.transition = 'transform 0.2s ease';
    target.style.transform =
      angle === 0 ? '' : `rotate(${angle}deg) scale(${scale})`;
  }
}

/** The aspect-ratio spacer that gives a timeline media frame its height:
 *  a static div with an inline padding-bottom, sibling of the content
 *  wrapper, a couple of levels above the tweetPhoto host. */
function findFrameSpacer(host: HTMLElement): HTMLElement | null {
  let anc = host.parentElement;
  for (let i = 0; i < 4 && anc; i++, anc = anc.parentElement) {
    for (const child of anc.children) {
      if (
        child instanceof HTMLElement &&
        !child.contains(host) &&
        (child.getAttribute('style') || '').includes('padding-bottom')
      ) {
        return child;
      }
    }
  }
  return null;
}

/** Quarter-turned timeline photos get a frame resized to the rotated image's
 *  own aspect ratio, so it fills the column width with no side margin,
 *  instead of shrinking into the old landscape frame. Only for single
 *  photos: resizing one cell of a multi-image grid would break the grid, and
 *  video posters would drag the player overlay along, so both keep the
 *  fit-in-frame behavior. Returns false to fall back to that behavior. */
function rotateResizingFrame(host: HTMLElement, angle: number): boolean {
  const article = host.closest('article');
  const isSinglePhoto =
    !!article &&
    article.querySelectorAll('[data-testid="tweetPhoto"]').length === 1 &&
    !!host.querySelector(`img[src*="${MEDIA_URL}/media/"]`);
  if (!isSinglePhoto) return false;
  const spacer = findFrameSpacer(host);
  if (!spacer) return false;

  const d = host.dataset;
  if (!d.xirW) {
    const rect = host.getBoundingClientRect();
    if (!rect.width || !rect.height) return false;
    d.xirW = String(rect.width);
    d.xirH = String(rect.height);
    d.xirPb = spacer.style.paddingBottom;
  }
  const w = Number(d.xirW);
  const h = Number(d.xirH);
  const targets = rotationTargets(host);

  if (angle % 180 === 0) {
    spacer.style.paddingBottom = d.xirPb ?? '';
    for (const t of targets) {
      t.style.width = t.style.height = t.style.top = t.style.left = '';
      t.style.transformOrigin = 'center center';
      t.style.transition = 'transform 0.2s ease';
      t.style.transform = angle === 0 ? '' : 'rotate(180deg)';
    }
    return true;
  }

  const ratio = Math.min(w / h, FRAME_ASPECT_CAP);
  spacer.style.paddingBottom = `${(ratio * 100).toFixed(4)}%`;
  const frameH = w * ratio;
  const scale = Math.min(w / h, frameH / w);
  for (const t of targets) {
    // Lock the original box so X's own sizing doesn't restretch the image
    // into the resized frame, then center it and rotate.
    t.style.width = `${w}px`;
    t.style.height = `${h}px`;
    t.style.top = `${(frameH - h) / 2}px`;
    t.style.left = '0px';
    t.style.transformOrigin = 'center center';
    t.style.transition = 'transform 0.2s ease';
    t.style.transform = `rotate(${angle}deg) scale(${scale})`;
  }
  return true;
}

function rotateBySrc(srcUrl: string, dir: number) {
  for (const img of document.querySelectorAll<HTMLImageElement>('img')) {
    if (img.src === srcUrl) {
      const host = resolveHost(img);
      if (host) rotate(host, dir);
      return;
    }
  }
}

function attachButtons(host: HTMLElement) {
  const group = document.createElement('div');
  group.className = GROUP_CLASS;
  group.appendChild(makeButton(host, -90, true, '左に90°回転'));
  group.appendChild(makeButton(host, 90, false, '右に90°回転'));
  host.appendChild(group);
}

function makeButton(
  host: HTMLElement,
  dir: number,
  ccw: boolean,
  label: string,
): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.className = BTN_CLASS;
  btn.type = 'button';
  btn.title = label;
  btn.setAttribute('aria-label', label);
  const inner = ccw ? `<g transform="translate(24,0) scale(-1,1)">${ARROW}</g>` : ARROW;
  btn.innerHTML =
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" ' +
    'stroke="currentColor" stroke-width="2.2" stroke-linecap="round" ' +
    `stroke-linejoin="round">${inner}</svg>`;
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    rotate(host, dir);
  });
  return btn;
}

function injectStyles() {
  const style = document.createElement('style');
  style.textContent = `
    .${GROUP_CLASS} {
      position: absolute;
      top: 8px;
      right: 8px;
      z-index: 10;
      display: flex;
      gap: 4px;
      opacity: 0;
      transition: opacity 0.15s ease;
    }
    [${HOST_ATTR}]:hover .${GROUP_CLASS},
    .${GROUP_CLASS}:focus-within {
      opacity: 1;
    }
    .${BTN_CLASS} {
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
    }
    .${BTN_CLASS}:hover {
      background: rgba(0, 0, 0, 0.8);
    }
    .${DISABLED_CLASS} .${GROUP_CLASS} {
      display: none;
    }
    /* The lightbox covers the image's top-right corner with a panel-toggle
       hit area, so the buttons move to the bottom-right there. */
    ${LIGHTBOX_SEL} [${HOST_ATTR}] > .${GROUP_CLASS} {
      top: auto;
      bottom: 8px;
    }
  `;
  document.head.appendChild(style);
}
