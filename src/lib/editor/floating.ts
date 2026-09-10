/**
 * Minimal viewport-aware positioning for editor popovers (the @ list and the hover card).
 * Both are `position: fixed`, so a client rect maps straight onto their coordinates; this
 * only decides whether to sit below or above the anchor and keeps the box on screen.
 */
const MARGIN = 8;

export interface PlacementOptions {
  /** Gap between the anchor and the box. */
  offset?: number;
  /** Prefer above the anchor when there is room. */
  preferAbove?: boolean;
}

export function placeFloating(element: HTMLElement, anchor: DOMRect, options: PlacementOptions = {}): void {
  const { offset = 6, preferAbove = false } = options;
  const box = element.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  const spaceBelow = viewportHeight - anchor.bottom - offset;
  const spaceAbove = anchor.top - offset;
  const fitsBelow = spaceBelow >= box.height + MARGIN;
  const fitsAbove = spaceAbove >= box.height + MARGIN;
  const above = preferAbove ? fitsAbove || !fitsBelow : !fitsBelow && fitsAbove;

  const top = above
    ? Math.max(MARGIN, anchor.top - offset - box.height)
    : Math.min(anchor.bottom + offset, viewportHeight - box.height - MARGIN);
  const left = Math.min(Math.max(MARGIN, anchor.left), viewportWidth - box.width - MARGIN);

  element.style.position = "fixed";
  element.style.top = `${Math.max(MARGIN, top)}px`;
  element.style.left = `${Math.max(MARGIN, left)}px`;
}
