// Bluesky (bsky.app) adapter. Unlike X, Bluesky renders each post photo as a
// real <img> (object-fit: cover) filling a positioned `role="button"` frame,
// so there is only one element to rotate. The frame's size comes from a CSS
// `aspect-ratio` on the button's parent, and its reserved height from a
// `padding-top` spacer two levels up: single photos take the image's own ratio
// (portrait ones capped to a square), multi-photo grids use square cells.
//
// Single timeline photos get that frame resized so a quarter-turned image fills
// the post column with no letterbox — the same result as the X adapter. Grid
// cells (resizing one would break the grid) and any unrecognised structure fall
// back to scaling the rotation down to fit inside the fixed frame.

import { GROUP_CLASS, HOST_ATTR, type SiteAdapter } from '../adapter';

// Post photos load from this CDN path (feed_thumbnail in the timeline,
// feed_fullsize in the viewer). External link-card previews reuse the same
// path, so a media <img> alone doesn't prove a rotatable photo — see resolveHost.
const MEDIA_PATH = '/img/feed_';

// The fullscreen lightbox: its overlay, the enlarged photo (always the
// feed_fullsize preset), and the expo-image box that lays the photo out under
// object-fit:cover-contain and clips it to the viewport. The box is what a
// quarter-turned photo is scaled to fill; the close/menu/nav controls around it
// are all role="button" siblings, so keying off the photo keeps us off them.
const LIGHTBOX_SEL = '[role="dialog"][aria-modal="true"]';
const FULLSIZE_PATH = '/img/feed_fullsize/';
const SLOT_SEL = '[data-expoimage="true"]';

// A resized single-photo frame takes the rotated image's own aspect ratio so it
// fills the column edge to edge. This only bounds pathological cases (a panorama
// rotated upright) at height = 3x width; normal sideways art never reaches it.
const FRAME_ASPECT_CAP = 3;

export const blueskyAdapter: SiteAdapter = {
  // In the lightbox the default top-right corner is Bluesky's close button and
  // the top-left its options menu, so drop the rotate buttons below the close
  // button, clear of both.
  styles: `
    ${LIGHTBOX_SEL} [${HOST_ATTR}] > .${GROUP_CLASS} {
      top: 76px;
      right: 20px;
    }`,
  resolveHost,
  applyRotation,
};

/** The container owning a post photo under `el`: the fullscreen lightbox's
 *  photo box when the pointer is inside the viewer, otherwise the timeline
 *  `role="button"` frame. Bluesky wraps tappable timeline photos in a button
 *  and external link-card thumbnails in an <a role="link">; keying off the
 *  nearest button that actually contains a media <img> keeps us on photos and
 *  off link cards. */
function resolveHost(el: Element | null): HTMLElement | null {
  if (!(el instanceof Element)) return null;

  // Lightbox: the enlarged photo sits in an expo-image box inside the viewer
  // overlay. Prefer the box under the pointer; when hovering the surrounding
  // chrome, fall back to the viewer's photo so the buttons still appear.
  const overlay = el.closest<HTMLElement>(LIGHTBOX_SEL);
  if (overlay) {
    const box = el.closest<HTMLElement>(SLOT_SEL);
    if (box) return box;
    const img = overlay.querySelector<HTMLImageElement>(`img[src*="${FULLSIZE_PATH}"]`);
    return img?.closest<HTMLElement>(SLOT_SEL) ?? img?.parentElement ?? null;
  }

  const frame = el.closest<HTMLElement>('[role="button"]');
  if (frame && frame.querySelector(`img[src*="${MEDIA_PATH}"]`)) return frame;
  return null;
}

/** Apply the absolute angle: spin the photo in place inside the fixed lightbox
 *  slot, resize the frame for single timeline photos, else scale the rotation
 *  to fit inside the fixed frame (square grid cells, etc.). */
function applyRotation(host: HTMLElement, angle: number) {
  if (host.closest(LIGHTBOX_SEL)) {
    rotateLightbox(host, angle);
    return;
  }
  if (rotateResizingFrame(host, angle)) return;

  const scale = angle % 180 === 0 ? 1 : fitScale(host);
  for (const img of host.querySelectorAll<HTMLImageElement>(`img[src*="${MEDIA_PATH}"]`)) {
    img.style.transformOrigin = 'center center';
    img.style.transform = angle === 0 ? '' : `rotate(${angle}deg) scale(${scale})`;
  }
}

/** Rotate the enlarged lightbox photo in place. Its box already fills and clips
 *  to the viewport, so unlike the timeline there is no frame to resize — just
 *  turn the <img> and scale a quarter-turn up to fill the viewport slot. */
function rotateLightbox(host: HTMLElement, angle: number) {
  const img = host.querySelector<HTMLImageElement>(`img[src*="${FULLSIZE_PATH}"]`);
  if (!img) return;
  const scale = angle % 180 === 0 ? 1 : lightboxFitScale(host, img);
  img.style.transformOrigin = 'center center';
  // Snap instantly, matching the timeline (whose frame resizes in one step and
  // so can't animate) — one rotation behaviour across the site.
  img.style.transition = 'none';
  img.style.transform = angle === 0 ? '' : `rotate(${angle}deg) scale(${scale})`;
}

/** How much to scale a quarter-turned lightbox photo so it fills the viewport
 *  slot. object-fit:contain first fits the upright photo into the slot; after a
 *  90° turn its on-screen bounds are that fitted size with width and height
 *  swapped, so scale it back up to the slot. */
function lightboxFitScale(host: HTMLElement, img: HTMLImageElement): number {
  const slot = host.getBoundingClientRect();
  const nw = img.naturalWidth;
  const nh = img.naturalHeight;
  if (!slot.width || !slot.height || !nw || !nh) return 1;
  // The upright photo's displayed size under object-fit:contain.
  const contain = Math.min(slot.width / nw, slot.height / nh);
  const dispW = nw * contain;
  const dispH = nh * contain;
  // Turned a quarter, it occupies dispH × dispW; refit that to the slot.
  return Math.min(slot.width / dispH, slot.height / dispW);
}

/** How much to shrink a quarter-turned photo so its swapped-dimension bounds
 *  (height x width) fit back inside the frame. Square grid cells give 1. */
function fitScale(host: HTMLElement): number {
  const rect = host.getBoundingClientRect();
  if (!rect.width || !rect.height) return 1;
  return Math.min(rect.width, rect.height) / Math.max(rect.width, rect.height);
}

/** The aspect-ratio frame div that owns a single post photo: the button's own
 *  parent, carrying the inline `aspect-ratio` that shapes the photo. Grid cells
 *  lack this (their aspect-ratio sits on the whole grid, two levels higher), so
 *  finding it here doubles as the single-photo guard. */
function findFrame(host: HTMLElement): HTMLElement | null {
  const frame = host.parentElement;
  if (frame && (frame.getAttribute('style') || '').includes('aspect-ratio')) return frame;
  return null;
}

/** The spacer whose inline `padding-top` reserves the frame's height, just above
 *  the `inset:0` overlay that holds the frame. Resizing its padding is how we
 *  shrink the reserved block to the rotated image. */
function findSizer(frame: HTMLElement): HTMLElement | null {
  let el = frame.parentElement;
  for (let i = 0; i < 4 && el; i++, el = el.parentElement) {
    if ((el.getAttribute('style') || '').includes('padding-top')) return el;
  }
  return null;
}

/** Quarter-turned single timeline photos get their frame resized to fill the
 *  post column at the rotated image's aspect ratio — as large as it fits with no
 *  letterbox — instead of staying letterboxed in the original frame. Returns
 *  false (grid cells, unrecognised structure, off-screen frame) to fall back to
 *  the fit-in-frame scaling. */
function rotateResizingFrame(host: HTMLElement, angle: number): boolean {
  const frame = findFrame(host);
  if (!frame) return false;
  // The `inset:0` overlay that centres the frame inside the reserved block, and
  // the `padding-top` spacer that gives the block its height.
  const reserve = frame.parentElement;
  const sizer = findSizer(frame);
  const img = host.querySelector<HTMLImageElement>(`img[src*="${MEDIA_PATH}"]`);
  if (!reserve || !sizer || !img) return false;

  const d = host.dataset;
  if (!d.sirW) {
    const rect = frame.getBoundingClientRect();
    if (!rect.width || !rect.height) return false;
    d.sirW = String(rect.width);
    d.sirH = String(rect.height);
    d.sirFrameAr = frame.style.aspectRatio;
    d.sirFrameW = frame.style.width;
    d.sirFrameH = frame.style.height;
    d.sirFrameFlex = frame.style.flex;
    d.sirReserveJc = reserve.style.justifyContent;
    d.sirReserveAi = reserve.style.alignItems;
    d.sirSizerPt = sizer.style.paddingTop;
    d.sirImg = img.getAttribute('style') ?? '';
  }
  const w = Number(d.sirW);
  const h = Number(d.sirH);

  if (angle % 180 === 0) {
    frame.style.aspectRatio = d.sirFrameAr ?? '';
    frame.style.width = d.sirFrameW ?? '';
    frame.style.height = d.sirFrameH ?? '';
    frame.style.flex = d.sirFrameFlex ?? '';
    reserve.style.justifyContent = d.sirReserveJc ?? '';
    reserve.style.alignItems = d.sirReserveAi ?? '';
    sizer.style.paddingTop = d.sirSizerPt ?? '';
    // Restore lays the photo back at 100% x 100% cover; 180 just flips it.
    img.setAttribute('style', d.sirImg ?? '');
    img.style.transformOrigin = 'center center';
    img.style.transition = 'none';
    img.style.transform = angle === 0 ? '' : 'rotate(180deg)';
    return true;
  }

  // Size the frame to the rotated image: width-fit to the column, but if that
  // would overflow the viewport height, height-fit instead and let the frame
  // hug the (now narrower) image — the whole image stays on screen with no side
  // bars, the same way Bluesky shows a natively tall image.
  const contentW = sizer.getBoundingClientRect().width;
  if (!contentW) return false;
  const ratio = Math.min(w / h, FRAME_ASPECT_CAP);
  const maxH = Math.max(300, window.innerHeight - 64);
  const frameH = Math.min(contentW * ratio, maxH);
  const frameW = frameH / ratio;

  sizer.style.paddingTop = `${frameH}px`;
  // Centre the frame when it is narrower than the column (a height-capped tall
  // image) so any leftover column space is even on both sides.
  reserve.style.justifyContent = 'center';
  reserve.style.alignItems = 'center';
  frame.style.aspectRatio = 'auto';
  frame.style.width = `${frameW}px`;
  frame.style.height = `${frameH}px`;
  frame.style.flex = '0 0 auto';

  const scale = Math.min(frameW / h, frameH / w);
  // Lock the photo to its original box so object-fit:cover keeps the same crop,
  // centre it in the resized frame, then rotate and scale it to fill. Snap
  // instantly: the frame resizes in one step, so animating the image would leave
  // it spinning inside an already-resized frame.
  img.style.width = `${w}px`;
  img.style.height = `${h}px`;
  img.style.left = '50%';
  img.style.top = '50%';
  img.style.transformOrigin = 'center center';
  img.style.transition = 'none';
  img.style.transform = `translate(-50%, -50%) rotate(${angle}deg) scale(${scale})`;
  return true;
}
