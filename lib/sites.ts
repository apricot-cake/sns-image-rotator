// Static descriptions of the sites the rotator supports: how to match their
// URLs (for the manifest content script and context menu) and recognize their
// hostname at runtime. Kept free of any DOM code so the background service
// worker can pull the match patterns without dragging in adapter logic. The
// per-site rotation behavior lives in ./adapters, bound to these by id in
// ./registry.

export interface SiteDescriptor {
  /** Stable key binding this site to its adapter in ./registry. */
  readonly id: string;
  /** Host names this site serves, matched against location.hostname. */
  readonly hosts: string[];
  /** URL match patterns for the manifest content script and context menu. */
  readonly matches: string[];
}

export const SITES: SiteDescriptor[] = [
  {
    id: 'x',
    hosts: ['x.com', 'twitter.com'],
    matches: ['*://x.com/*', '*://twitter.com/*'],
  },
  {
    id: 'bluesky',
    hosts: ['bsky.app'],
    matches: ['*://bsky.app/*'],
  },
];

/** Every site's match patterns, for the content script and context menu. */
export const SITE_MATCHES = SITES.flatMap((s) => s.matches);

/** The site serving `hostname` (exact host or a subdomain of it), or
 *  undefined if none. */
export function siteForHost(hostname: string): SiteDescriptor | undefined {
  return SITES.find((s) =>
    s.hosts.some((h) => hostname === h || hostname.endsWith(`.${h}`)),
  );
}
