// Binds each supported site (by its descriptor id in ./sites) to the adapter
// that implements its rotation behavior. Adding a site means adding its
// descriptor in ./sites and registering its adapter here.

import type { SiteAdapter } from './adapter';
import { siteForHost } from './sites';
import { xAdapter } from './adapters/x';

const ADAPTERS: Record<string, SiteAdapter> = {
  x: xAdapter,
};

/** The adapter serving `hostname`, or undefined if no site matches. */
export function adapterForHost(hostname: string): SiteAdapter | undefined {
  const site = siteForHost(hostname);
  return site ? ADAPTERS[site.id] : undefined;
}
