// X (Twitter) adapter. X renders the visible picture as a CSS background-image
// on a <div>, keeping a transparent <img> on top as the hit-target, so both
// elements must be transformed together. Timeline single photos also get their
// frame resized so a quarter-turned image fills the column with no letterbox.

import { GROUP_CLASS, HOST_ATTR, type SiteAdapter } from '../adapter';

const MEDIA_HOST = 'pbs.twimg.com';
const LIGHTBOX_SEL = '[aria-modal="true"]';
const SLOT_SEL = '[data-testid="swipe-to-dismiss"]';

/** Whether `url` is served by X's photo CDN, checked on the parsed hostname so
 *  a lookalike path segment (e.g. https://evil.example/pbs.twimg.com/x.jpg)
 *  can't pass the way a substring match would. */
function isMediaUrl(url: string): boolean {
  let host: string;
  try {
    host = new URL(url, location.href).hostname;
  } catch {
    return false;
  }
  return host === MEDIA_HOST || host.endsWith(`.${MEDIA_HOST}`);
}

/** The URL inside a CSS `url(...)` value (e.g. a computed background-image), or
 *  null when there is none. */
function cssUrl(value: string): string | null {
  const m = /url\((["']?)([^"')]+)\1\)/.exec(value);
  return m ? m[2] : null;
}

/** The first CDN-hosted <img> inside `root`, or null. */
function findMediaImg(root: Element): HTMLImageElement | null {
  for (const img of root.querySelectorAll<HTMLImageElement>('img')) {
    if (isMediaUrl(img.src)) return img;
  }
  return null;
}

/** Whether `host` holds a CDN photo (a `/media/` image), as opposed to a video
 *  poster or other CDN asset, which single-photo frame resizing keys off. */
function hasMediaPhoto(host: HTMLElement): boolean {
  for (const img of host.querySelectorAll<HTMLImageElement>('img')) {
    if (!isMediaUrl(img.src)) continue;
    try {
      if (new URL(img.src, location.href).pathname.startsWith('/media/')) return true;
    } catch {
      // Ignore an unparseable src and keep scanning.
    }
  }
  return false;
}

// Enlarged timeline frames take the rotated image's own aspect ratio so it
// fills them edge to edge. This only bounds pathological cases (a panorama
// rotated upright) at height = 3x width; normal sideways art never reaches it.
const FRAME_ASPECT_CAP = 3;

export const xAdapter: SiteAdapter = {
  // The lightbox covers the image's top-right corner with a panel-toggle hit
  // area, so the buttons move to the bottom-right there.
  styles: `
    ${LIGHTBOX_SEL} [${HOST_ATTR}] > .${GROUP_CLASS} {
      top: auto;
      bottom: 8px;
    }`,
  resolveHost,
  applyRotation,
};

/** Find the positioned container that owns a tweet image, given any
 *  descendant. Covers timeline/quote photos and the lightbox viewer. */
function resolveHost(el: Element | null): HTMLElement | null {
  if (!el || !(el instanceof Element)) return null;

  const photo = el.closest<HTMLElement>('[data-testid="tweetPhoto"]');
  if (photo) return photo;

  // Lightbox: a plain <img> inside the modal viewer.
  const modal = el.closest<HTMLElement>(LIGHTBOX_SEL);
  if (modal) {
    const img =
      el instanceof HTMLImageElement && isMediaUrl(el.src) ? el : findMediaImg(el);
    const parent = img?.parentElement;
    if (parent) {
      if (getComputedStyle(parent).position === 'static') {
        parent.style.position = 'relative';
      }
      return parent;
    }
  }
  return null;
}

/** Apply the absolute angle: resize the frame for single timeline photos, else
 *  scale the rotation to fit the fixed frame (or the lightbox slot). */
function applyRotation(host: HTMLElement, angle: number) {
  if (!host.closest(LIGHTBOX_SEL) && rotateResizingFrame(host, angle)) return;

  // Animate the spin only in the lightbox, where the frame is fixed and a
  // smooth rotation reads well; in the feed the frame stays put too but a
  // snap keeps it consistent with the resized single-photo case.
  const anim = host.closest(LIGHTBOX_SEL) ? 'transform 0.2s ease' : 'none';
  const scale = angle % 180 === 0 ? 1 : fitScale(host);
  for (const target of rotationTargets(host)) {
    target.style.transformOrigin = 'center center';
    target.style.transition = anim;
    target.style.transform =
      angle === 0 ? '' : `rotate(${angle}deg) scale(${scale})`;
  }
}

/** Both the visible background-image <div>s and the transparent <img>s. */
function rotationTargets(host: HTMLElement): HTMLElement[] {
  const targets: HTMLElement[] = [];
  for (const div of host.querySelectorAll<HTMLElement>('div')) {
    const url = cssUrl(getComputedStyle(div).backgroundImage);
    if (url && isMediaUrl(url)) targets.push(div);
  }
  for (const img of host.querySelectorAll<HTMLImageElement>('img')) {
    if (isMediaUrl(img.src)) targets.push(img);
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

/** The ancestor whose inline max-width caps a portrait photo narrower than
 *  the tweet column. Lifting it lets a rotated landscape image fill the
 *  full content width. */
function findWidthCap(from: HTMLElement): HTMLElement | null {
  let el: HTMLElement | null = from;
  for (let i = 0; i < 8 && el; i++, el = el.parentElement) {
    if ((el.getAttribute('style') || '').includes('max-width')) return el;
  }
  return null;
}

/** The rounded media card that paints X's pale-blue media background. It
 *  stays at full column width on its own, which would show as side bands
 *  around a narrower rotated frame, so it must shrink-wrap the frame. */
function findMediaCard(host: HTMLElement): HTMLElement | null {
  let el = host.parentElement;
  for (let i = 0; i < 10 && el; i++, el = el.parentElement) {
    if (parseFloat(getComputedStyle(el).borderRadius) >= 8) return el;
  }
  return null;
}

/** Quarter-turned timeline photos get a frame resized to fill the tweet's
 *  content column at the rotated image's aspect ratio — as large as it fits
 *  with no side margin — instead of staying inside the original frame. Only
 *  for single photos: resizing one cell of a multi-image grid would break
 *  the grid, and video posters would drag the player overlay along, so both
 *  keep the fit-in-frame behavior. Returns false to fall back to that. */
function rotateResizingFrame(host: HTMLElement, angle: number): boolean {
  const article = host.closest('article');
  const isSinglePhoto =
    !!article &&
    article.querySelectorAll('[data-testid="tweetPhoto"]').length === 1 &&
    hasMediaPhoto(host);
  if (!isSinglePhoto) return false;
  const spacer = findFrameSpacer(host);
  // The spacer's parent is the frame sizer. Its height may come from the
  // spacer's padding-bottom or from an inline `height` X sets directly
  // (which the padding-bottom alone can't override), so drive both.
  const sizer = spacer?.parentElement;
  if (!spacer || !sizer) return false;
  const widthCap = findWidthCap(sizer);
  const card = findMediaCard(host);

  const d = host.dataset;
  if (!d.sirW) {
    const rect = host.getBoundingClientRect();
    if (!rect.width || !rect.height) return false;
    d.sirW = String(rect.width);
    d.sirH = String(rect.height);
    d.sirPb = spacer.style.paddingBottom;
    d.sirSizerH = sizer.style.height;
    d.sirSizerW = sizer.style.width;
    d.sirSizerM = sizer.style.margin;
    d.sirCapW = widthCap ? widthCap.style.maxWidth : '';
    d.sirCardW = card ? card.style.width : '';
    d.sirCardM = card ? card.style.margin : '';
  }
  const w = Number(d.sirW);
  const h = Number(d.sirH);
  const targets = rotationTargets(host);

  if (angle % 180 === 0) {
    spacer.style.paddingBottom = d.sirPb ?? '';
    sizer.style.height = d.sirSizerH ?? '';
    sizer.style.width = d.sirSizerW ?? '';
    sizer.style.margin = d.sirSizerM ?? '';
    if (widthCap) widthCap.style.maxWidth = d.sirCapW ?? '';
    if (card) {
      card.style.width = d.sirCardW ?? '';
      card.style.margin = d.sirCardM ?? '';
    }
    for (const t of targets) {
      t.style.width = t.style.height = t.style.top = t.style.left = '';
      t.style.transformOrigin = 'center center';
      // Snap instantly: the frame resizes in one step, so animating the image
      // would leave it spinning inside an already-resized frame.
      t.style.transition = 'none';
      t.style.transform = angle === 0 ? '' : 'rotate(180deg)';
    }
    return true;
  }

  // Size the frame to the rotated image so it fills it with no letterbox:
  // width-fit to the content column, but if that would overflow the viewport
  // height, height-fit instead and let the frame hug the (now narrower)
  // image — the whole image stays on screen with no side bars, the same way
  // X shows a natively tall image.
  const contentW = widthCap?.parentElement
    ? widthCap.parentElement.getBoundingClientRect().width
    : w;
  const ratio = Math.min(w / h, FRAME_ASPECT_CAP);
  const maxH = Math.max(300, window.innerHeight - 64);
  const frameH = Math.min(contentW * ratio, maxH);
  const frameW = frameH / ratio;
  if (widthCap) widthCap.style.maxWidth = `${contentW}px`;
  sizer.style.width = `${frameW}px`;
  sizer.style.height = `${frameH}px`;
  // Centre the frame when it is narrower than the column (a height-capped
  // tall image) so any leftover column space is even on both sides.
  sizer.style.margin = '0 auto';
  // Shrink-wrap the rounded media card too, or its pale-blue background
  // shows as bands on both sides of the narrower frame.
  if (card) {
    card.style.width = 'fit-content';
    card.style.margin = '0 auto';
  }
  spacer.style.paddingBottom = `${((frameH / frameW) * 100).toFixed(4)}%`;
  const scale = Math.min(frameW / h, frameH / w);
  for (const t of targets) {
    // Lock the original box so X's own sizing doesn't restretch the image
    // into the resized frame, then center it in the frame and rotate.
    t.style.width = `${w}px`;
    t.style.height = `${h}px`;
    t.style.left = `${(frameW - w) / 2}px`;
    t.style.top = `${(frameH - h) / 2}px`;
    t.style.transformOrigin = 'center center';
    // Snap instantly: the frame resizes in one step, so animating the image
    // would leave it spinning inside an already-resized frame.
    t.style.transition = 'none';
    t.style.transform = `rotate(${angle}deg) scale(${scale})`;
  }
  return true;
}
