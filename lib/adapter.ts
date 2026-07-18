// The contract every site adapter implements, plus the shared DOM identifiers
// the rotator core and adapters both key off. A site adapter knows how one
// site lays out its images; the core (core.ts) is site-agnostic and drives it.

/** Marks an element as a rotator host so the button CSS can target it. Set by
 *  the core when an adapter resolves a host; adapters need not set it. */
export const HOST_ATTR = 'data-sir-host';

/** The hover button group the core appends to each host. Exposed so adapters
 *  can position it in site-specific CSS (see SiteAdapter.styles). */
export const GROUP_CLASS = 'sir-group';

export interface SiteAdapter {
  /** Optional site-specific CSS appended after the shared button styles, e.g.
   *  moving the buttons when the site overlays the default corner. */
  readonly styles?: string;

  /** The positioned container that owns the image under `el` (any descendant
   *  the pointer is over), or null when `el` isn't part of a rotatable image. */
  resolveHost(el: Element | null): HTMLElement | null;

  /** Apply an absolute rotation (0/90/180/270 degrees) to a resolved host. The
   *  adapter owns target selection, framing and scaling. */
  applyRotation(host: HTMLElement, angle: number): void;

  /** Find the host for a context-menu image `srcUrl`. Optional: the core
   *  defaults to locating the <img> with that src and resolving from it. */
  resolveHostBySrc?(srcUrl: string): HTMLElement | null;
}
