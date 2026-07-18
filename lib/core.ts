// Site-agnostic rotator runtime: the hover buttons, the hover on/off setting,
// the per-host angle state, and dispatch from the context-menu message. Every
// site-specific DOM concern lives behind the SiteAdapter this is handed.

import { GROUP_CLASS, HOST_ATTR, type SiteAdapter } from './adapter';

const ANGLE_ATTR = 'data-sir-angle';
const BTN_CLASS = 'sir-btn';
const DISABLED_CLASS = 'sir-hover-off';

const SVG_NS = 'http://www.w3.org/2000/svg';

// Lucide rotate-cw / rotate-ccw icon path data (MIT), one array per direction.
const ICON_CW = [
  'M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8',
  'M21 3v5h-5',
];
const ICON_CCW = [
  'M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8',
  'M3 3v5h5',
];

/** Wire up the rotator on the current page using the given site adapter. */
export function runRotator(adapter: SiteAdapter) {
  injectStyles(adapter);
  applyHoverSetting();
  browser.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && changes.hoverButton) applyHoverSetting();
  });

  // Buttons are attached lazily on first hover; CSS shows them only while the
  // host is hovered.
  document.addEventListener('mouseover', (e) => {
    const host = resolveHost(adapter, e.target as Element | null);
    if (host && !host.querySelector(`.${GROUP_CLASS}`)) attachButtons(adapter, host);
  });

  browser.runtime.onMessage.addListener((message: unknown) => {
    const msg = message as { type?: string; srcUrl?: string; dir?: number };
    if (msg.type === 'rotate' && msg.srcUrl) {
      const host = resolveHostBySrc(adapter, msg.srcUrl);
      if (host) rotate(adapter, host, msg.dir ?? 90);
    }
  });
}

async function applyHoverSetting() {
  const { hoverButton } = await browser.storage.sync.get({ hoverButton: false });
  document.documentElement.classList.toggle(DISABLED_CLASS, !hoverButton);
}

/** Resolve a host through the adapter and mark it so the button CSS applies. */
function resolveHost(adapter: SiteAdapter, el: Element | null): HTMLElement | null {
  const host = adapter.resolveHost(el);
  if (host) host.setAttribute(HOST_ATTR, '');
  return host;
}

/** Find the host owning a context-menu image src, via the adapter's override
 *  or the default <img>-by-src lookup. */
function resolveHostBySrc(adapter: SiteAdapter, srcUrl: string): HTMLElement | null {
  if (adapter.resolveHostBySrc) return adapter.resolveHostBySrc(srcUrl);
  for (const img of document.querySelectorAll<HTMLImageElement>('img')) {
    if (img.src === srcUrl) return resolveHost(adapter, img);
  }
  return null;
}

/** Accumulate the host's angle by `dir`, then let the adapter paint it. */
function rotate(adapter: SiteAdapter, host: HTMLElement, dir: number) {
  const angle =
    (((Number(host.getAttribute(ANGLE_ATTR) || 0) + dir) % 360) + 360) % 360;
  host.setAttribute(ANGLE_ATTR, String(angle));
  adapter.applyRotation(host, angle);
}

function attachButtons(adapter: SiteAdapter, host: HTMLElement) {
  const group = document.createElement('div');
  group.className = GROUP_CLASS;
  group.appendChild(
    makeButton(adapter, host, -90, true, browser.i18n.getMessage('buttonRotateLeft')),
  );
  group.appendChild(
    makeButton(adapter, host, 90, false, browser.i18n.getMessage('buttonRotateRight')),
  );
  host.appendChild(group);
}

function makeButton(
  adapter: SiteAdapter,
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
  btn.appendChild(makeIcon(ccw ? ICON_CCW : ICON_CW));
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    rotate(adapter, host, dir);
  });
  return btn;
}

/** Build an SVG icon from Lucide path data via the DOM, so the strings are set
 *  as attribute values and never parsed as markup. */
function makeIcon(paths: string[]): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '16');
  svg.setAttribute('height', '16');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  for (const d of paths) {
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', d);
    svg.appendChild(path);
  }
  return svg;
}

function injectStyles(adapter: SiteAdapter) {
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
    ${adapter.styles ?? ''}
  `;
  document.head.appendChild(style);
}
