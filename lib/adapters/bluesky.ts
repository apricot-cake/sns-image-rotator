// Bluesky (bsky.app) adapter. Unlike X, Bluesky renders each post photo as a
// real <img> (object-fit: cover) filling a positioned `role="button"` frame,
// so there is only one element to rotate. The frame's size comes from a CSS
// `aspect-ratio` on an ancestor: single photos take the image's own ratio,
// multi-photo grids use square cells. Rotated images are scaled to fit inside
// that fixed frame (never enlarged past it), so nothing spills out of the
// frame's overflow:hidden — square grid cells land exactly, wider/taller single
// photos sit letterboxed. Resizing the frame to the rotated ratio (as the X
// adapter does) is left for later; it needs on-device DOM work.

import { type SiteAdapter } from '../adapter';

// Post photos load from this CDN path (feed_thumbnail in the timeline,
// feed_fullsize in the viewer). External link-card previews reuse the same
// path, so a media <img> alone doesn't prove a rotatable photo — see resolveHost.
const MEDIA_PATH = '/img/feed_';

export const blueskyAdapter: SiteAdapter = {
  resolveHost,
  applyRotation,
};

/** The `role="button"` frame that owns a post photo, given any descendant the
 *  pointer is over. Bluesky wraps tappable photos in a button and external
 *  link-card thumbnails in an <a role="link">; keying off the nearest button
 *  that actually contains a media <img> keeps us on photos and off link cards. */
function resolveHost(el: Element | null): HTMLElement | null {
  if (!(el instanceof Element)) return null;
  const frame = el.closest<HTMLElement>('[role="button"]');
  if (frame && frame.querySelector(`img[src*="${MEDIA_PATH}"]`)) return frame;
  return null;
}

/** Rotate the frame's photo in place, scaling a quarter turn down so the whole
 *  image stays inside the fixed frame. */
function applyRotation(host: HTMLElement, angle: number) {
  const scale = angle % 180 === 0 ? 1 : fitScale(host);
  for (const img of host.querySelectorAll<HTMLImageElement>(`img[src*="${MEDIA_PATH}"]`)) {
    img.style.transformOrigin = 'center center';
    img.style.transform = angle === 0 ? '' : `rotate(${angle}deg) scale(${scale})`;
  }
}

/** How much to shrink a quarter-turned photo so its swapped-dimension bounds
 *  (height x width) fit back inside the frame. Square grid cells give 1. */
function fitScale(host: HTMLElement): number {
  const rect = host.getBoundingClientRect();
  if (!rect.width || !rect.height) return 1;
  return Math.min(rect.width, rect.height) / Math.max(rect.width, rect.height);
}
