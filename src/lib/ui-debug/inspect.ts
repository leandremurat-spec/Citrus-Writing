/**
 * The measuring half of the UI inspector: no React, no DOM writes, nothing that only makes
 * sense inside the overlay. Split out so the rules it encodes — which token a colour is,
 * what contrast a pairing has, what counts as clipped — can be read and changed on their own,
 * and so the overlay component stays about presentation.
 *
 * Everything here reads *computed* style, never class strings. A class list tells you what a
 * component asked for; the computed value tells you what the browser actually painted after
 * the cascade, the palette, the theme class and any inline style have all had their say. When
 * those two disagree — which is the interesting case, and the one worth a tool — only the
 * second is the truth.
 */

import { PALETTES, RAMP_STEPS } from "@/lib/theme/palettes";
import { paletteVars } from "@/lib/theme/tokens";

export interface TokenTable {
  /** Custom property name (with the leading `--`) → its resolved value. */
  byName: Map<string, string>;
  /** Normalised colour → the property names that resolve to it, most specific first. */
  byColor: Map<string, string[]>;
}

/** Colour tokens that are aliases of a ramp rung. Naming the rung is more useful than the alias. */
const RAMP_PREFIXES = ["--press-", "--ochre-", "--neutral-"];

/**
 * The name to lead with when several tokens share a paint, which is most of them: the shadcn
 * slots are mostly aliases, so `--foreground` has seven synonyms and reporting whichever comes
 * first alphabetically means answering "what colour is this?" with `--accent-foreground`.
 *
 * A ramp rung wins outright — `--press` and `--press-700` are the same paint, but only the
 * second says which rung to reach for, which is the thing this app's contract is written in.
 * Then the names a person actually says out loud, then everything else.
 */
const PREFERRED = [
  "--foreground",
  "--background",
  "--sheet",
  "--chrome",
  "--card",
  "--muted",
  "--subtle",
  "--press",
  "--ochre",
  "--proof",
  "--edge",
  "--divider",
];

function rank(name: string): number {
  if (RAMP_PREFIXES.some((prefix) => name.startsWith(prefix))) return 0;
  const preferred = PREFERRED.indexOf(name);
  return preferred >= 0 ? 1 + preferred : 100;
}

let swatch: CanvasRenderingContext2D | null = null;

function canvas(): CanvasRenderingContext2D | null {
  if (swatch) return swatch;
  const element = document.createElement("canvas");
  element.width = 1;
  element.height = 1;
  swatch = element.getContext("2d", { willReadFrequently: true });
  return swatch;
}

/**
 * Any CSS colour, as the sRGB bytes it is actually painted as.
 *
 * Two steps, because either alone gets it wrong. A hidden span resolves `var()`, `color-mix()`
 * and keywords the way the cascade would — but reading the result back gives whatever
 * *serialisation* the engine prefers, and a modern one hands back `oklab(0.95 0.003 0.016)`
 * rather than `rgb(…)`. Scraping three numbers out of that reads a lightness as a red channel,
 * which is how a perfectly fine pairing ends up reported as failing. So the resolved string
 * goes through a 1×1 canvas, whose one job is to say what colour finally hits the screen.
 *
 * Null for anything that is not a colour, and for a fully transparent one, which is not a paint.
 */
export function toRgb(value: string): [number, number, number] | null {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "transparent" || trimmed === "none") return null;

  const probe = document.createElement("span");
  probe.style.color = "rgb(1, 2, 3)";
  probe.style.color = trimmed;
  if (probe.style.color === "rgb(1, 2, 3)" && trimmed !== "rgb(1, 2, 3)") return null;
  probe.style.position = "absolute";
  probe.style.visibility = "hidden";
  document.body.appendChild(probe);
  const resolved = getComputedStyle(probe).color;
  probe.remove();

  const context = canvas();
  if (!context) return null;
  context.clearRect(0, 0, 1, 1);
  context.fillStyle = "#000000";
  context.fillStyle = resolved;
  context.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
  return a === 0 ? null : [r, g, b];
}

/**
 * As `toRgb`, but keeping alpha. Compositing needs it: a wash is not the colour it names.
 */
export function toRgba(value: string): [number, number, number, number] | null {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "transparent" || trimmed === "none") return null;

  const probe = document.createElement("span");
  probe.style.color = "rgb(1, 2, 3)";
  probe.style.color = trimmed;
  if (probe.style.color === "rgb(1, 2, 3)" && trimmed !== "rgb(1, 2, 3)") return null;
  probe.style.position = "absolute";
  probe.style.visibility = "hidden";
  document.body.appendChild(probe);
  const resolved = getComputedStyle(probe).color;
  probe.remove();

  const context = canvas();
  if (!context) return null;
  context.clearRect(0, 0, 1, 1);
  context.fillStyle = "#000000";
  context.fillStyle = resolved;
  context.globalCompositeOperation = "copy";
  context.fillRect(0, 0, 1, 1);
  context.globalCompositeOperation = "source-over";
  const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
  return a === 0 ? null : [r, g, b, a / 255];
}

function rgbKey(rgb: [number, number, number]): string {
  return rgb.map(Math.round).join(",");
}

/**
 * The names of every token the theme layer defines.
 *
 * Taken from `paletteVars` — the same function `scripts/build-theme-css.ts` generates the
 * stylesheet from — rather than by reading the stylesheet back. Enumerating the CSSOM was the
 * obvious approach and it does not work here: under Turbopack the app's own CSS is not in
 * `document.styleSheets` in a form that lists its custom properties, so the walk came back
 * with the font and toast tokens and none of the palette. Reading the project's own source of
 * truth cannot drift from what shipped, and it means a token added to `palettes.ts` is
 * understood by this tool the moment it exists.
 *
 * Every palette contributes its names — they are the same set in every mode, but taking the
 * union costs nothing and survives a palette that one day defines an extra one.
 */
function tokenNames(): string[] {
  const names = new Set<string>();
  for (const palette of Object.values(PALETTES)) {
    for (const name of paletteVars(palette.light).keys()) names.add(name);
  }
  // The ramps, which components address by rung rather than through an alias.
  for (const family of ["press", "ochre", "neutral"]) {
    for (const step of RAMP_STEPS) names.add(`--${family}-${step}`);
  }
  return [...names];
}

/**
 * Every theme token, as the browser resolves it *right now*, indexed both ways.
 *
 * Resolution goes through `getComputedStyle(<html>)`, so the answer follows the live theme and
 * palette rather than any one block in the generated stylesheet — point the inspector at
 * something under Nord dark and it names Nord dark's values.
 */
export function readTokens(): TokenTable {
  const root = getComputedStyle(document.documentElement);
  const byName = new Map<string, string>();
  const byColor = new Map<string, string[]>();

  for (const name of tokenNames()) {
    const value = root.getPropertyValue(name).trim();
    if (!value) continue;
    byName.set(name, value);
    const rgb = toRgb(value);
    if (!rgb) continue;
    const key = rgbKey(rgb);
    const bucket = byColor.get(key) ?? [];
    bucket.push(name);
    byColor.set(key, bucket);
  }

  for (const [key, bucket] of byColor) {
    bucket.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
    byColor.set(key, bucket);
  }
  return { byName, byColor };
}

/** The token names a painted colour corresponds to, or an empty array for an off-palette value. */
export function tokensFor(tokens: TokenTable, painted: string): string[] {
  const rgb = toRgb(painted);
  return rgb ? (tokens.byColor.get(rgbKey(rgb)) ?? []) : [];
}

function channel(value: number): number {
  const v = value / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

export function luminance(rgb: [number, number, number]): number {
  return 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2]);
}

export function contrast(a: [number, number, number], b: [number, number, number]): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * The colour actually behind an element.
 *
 * Walks up until it finds an ancestor painting something opaque, because `background-color`
 * on the element itself is `rgba(0, 0, 0, 0)` far more often than not — and a contrast figure
 * measured against transparent is worse than no figure at all.
 */
export function effectiveBackground(element: Element): [number, number, number] {
  // Collect every painted layer up to the first fully opaque one, then composite them back
  // down. Stopping at the first *non-transparent* layer is the tempting shortcut and it is
  // wrong: the header's Export button sits on a 6% wash of near-white, and taking that wash at
  // face value reported cream text on a dark header as 1.04:1 — a control anyone can plainly
  // read, flagged as invisible. A tool that cries wolf about working code is worse than none.
  const layers: [number, number, number, number][] = [];
  let node: Element | null = element;
  while (node) {
    const layer = toRgba(getComputedStyle(node).backgroundColor);
    if (layer) {
      layers.push(layer);
      if (layer[3] >= 0.999) break;
    }
    node = node.parentElement;
  }

  let base: [number, number, number] =
    layers.length && layers[layers.length - 1][3] >= 0.999
      ? [layers[layers.length - 1][0], layers[layers.length - 1][1], layers[layers.length - 1][2]]
      : (toRgb(getComputedStyle(document.body).backgroundColor) ?? [255, 255, 255]);

  // Back to front, skipping the opaque base we just took.
  for (let i = layers.length - 1; i >= 0; i--) {
    const [r, g, b, a] = layers[i];
    if (a >= 0.999) continue;
    base = [r * a + base[0] * (1 - a), g * a + base[1] * (1 - a), b * a + base[2] * (1 - a)];
  }
  return [Math.round(base[0]), Math.round(base[1]), Math.round(base[2])];
}

/** Large text clears at 3:1 rather than 4.5:1 — 24px, or 18.66px when bold. */
export function isLargeText(style: CSSStyleDeclaration): boolean {
  const size = Number.parseFloat(style.fontSize);
  const weight = Number.parseFloat(style.fontWeight) || 400;
  return size >= 24 || (size >= 18.66 && weight >= 700);
}

export interface Finding {
  kind: "contrast" | "clipped" | "offscreen" | "tap-target" | "off-palette" | "radius";
  element: Element;
  /** One line, already phrased for a person reading a list. */
  message: string;
  /** What to change, in this app's own vocabulary. */
  hint?: string;
}

/**
 * The padding a corner radius demands.
 *
 * A rounded box of radius `R` is a quarter-circle at each corner, so content sitting `P` from
 * both edges has its corner at distance `√2·(R − P)` from the arc's centre. It clears only
 * while that stays within `R`, which gives `P ≥ R·(1 − 1/√2)`, near enough **three tenths of
 * the radius**. Under that, the curve cuts across the first and last rows — which is not a
 * clipping bug the browser will report, because the content is still painted; it simply has a
 * round edge running through it.
 *
 * This is the whole reason the rule is worth encoding: a big radius is not free, it is a
 * padding bill. `--radius-lg` is 28px, so anything wearing it owes about 9px of padding.
 */
export const CLEARANCE = 1 - 1 / Math.SQRT2;

export function requiredPadding(radius: number): number {
  return radius * CLEARANCE;
}

/** A pill's radius is capped at half its shorter side, however large the declared value. */
function effectiveRadius(declared: number, width: number, height: number): number {
  if (!Number.isFinite(declared) || declared <= 0) return 0;
  return Math.min(declared, width / 2, height / 2);
}

/**
 * The rectangle a child's own glyphs occupy, or null if it has none.
 *
 * Measured with a Range rather than inferred from the padding box, because inferring is wrong
 * exactly where it matters: a centred label in a flex button sits nowhere near that button's
 * top-left corner, so assuming it starts there reports crowding on controls that have plenty
 * of room. The glyphs are the thing a reader sees meeting the curve; measure the glyphs.
 */
function textRect(element: Element): DOMRect | null {
  const range = document.createRange();
  let union: DOMRect | null = null;
  for (const node of Array.from(element.childNodes)) {
    if (node.nodeType !== Node.TEXT_NODE || !(node.textContent ?? "").trim()) continue;
    range.selectNodeContents(node);
    for (const rect of Array.from(range.getClientRects())) {
      if (rect.width === 0 || rect.height === 0) continue;
      union = union
        ? new DOMRect(
            Math.min(union.x, rect.x),
            Math.min(union.y, rect.y),
            Math.max(union.right, rect.right) - Math.min(union.x, rect.x),
            Math.max(union.bottom, rect.bottom) - Math.min(union.y, rect.y),
          )
        : rect;
    }
  }
  range.detach();
  return union;
}

/**
 * What a child actually paints into the corner, as a rectangle and a radius.
 *
 * The distinction matters more than it sounds. A full-width `<div>` wrapping a menu label has
 * a box corner well inside the container's arc but paints nothing there, so nobody can see it
 * "overrun" anything — flagging it is noise. What a reader sees is a background, a border, or
 * glyphs, and only the first two have corners of their own.
 */
function paintedCorner(child: Element): { rect: DOMRect; radii: Record<string, number> } | null {
  const style = getComputedStyle(child);
  const box = child.getBoundingClientRect();
  const paintsBox = toRgb(style.backgroundColor) !== null || parseFloat(style.borderTopWidth) > 0;
  if (paintsBox) {
    // Per corner, not one radius for all four. A dialog footer is `rounded-b-lg` — square on
    // top, concentric with the dialog along the bottom — so reading its top-left radius and
    // applying it downward reports the one shape that is exactly right as a collision.
    const radius = (value: string) => effectiveRadius(parseFloat(value), box.width, box.height);
    return {
      rect: box,
      radii: {
        "top-left": radius(style.borderTopLeftRadius),
        "top-right": radius(style.borderTopRightRadius),
        "bottom-left": radius(style.borderBottomLeftRadius),
        "bottom-right": radius(style.borderBottomRightRadius),
      },
    };
  }
  const glyphs = textRect(child);
  if (!glyphs) return null;
  // A truncated line's Range still reports the full, untruncated run, so a `truncate`d binder
  // title measures as reaching far past the row that hides it. Only the part still on screen
  // can meet a curve.
  const visible = clipToAncestors(child, glyphs);
  // Glyphs have no corners of their own.
  return visible ? { rect: visible, radii: {} } : null;
}

/** Intersects a rect with every clipping ancestor, or null once nothing is left. */
function clipToAncestors(element: Element, rect: DOMRect): DOMRect | null {
  let left = rect.left;
  let top = rect.top;
  let right = rect.right;
  let bottom = rect.bottom;
  let node: Element | null = element;
  while (node && node !== document.body) {
    const style = getComputedStyle(node);
    if (style.overflow !== "visible") {
      const box = node.getBoundingClientRect();
      left = Math.max(left, box.left);
      top = Math.max(top, box.top);
      right = Math.min(right, box.right);
      bottom = Math.min(bottom, box.bottom);
      if (right <= left || bottom <= top) return null;
    }
    node = node.parentElement;
  }
  return new DOMRect(left, top, right - left, bottom - top);
}

/**
 * How much room a child's painted corner has before the container's curve reaches it. Negative
 * means the curve is already cutting across it.
 *
 * Concentric corners are the geometry: a child of radius `r` sitting `(x, y)` in from a corner
 * of radius `R` stays inside while the distance between the two arc centres is at most `R − r`.
 * With `r = 0` — text, or a square child — that collapses to the plain "is this point inside
 * the circle" test.
 */
function cornerClearance(container: Element, child: Element): { corner: string; clearance: number } | null {
  const painted = paintedCorner(child);
  if (!painted) return null;

  const style = getComputedStyle(container);
  const box = container.getBoundingClientRect();
  const rect = painted.rect;
  if (rect.width === 0 || rect.height === 0) return null;

  const corners: [string, number, number, number][] = [
    ["top-left", parseFloat(style.borderTopLeftRadius), rect.left - box.left, rect.top - box.top],
    ["top-right", parseFloat(style.borderTopRightRadius), box.right - rect.right, rect.top - box.top],
    ["bottom-left", parseFloat(style.borderBottomLeftRadius), rect.left - box.left, box.bottom - rect.bottom],
    ["bottom-right", parseFloat(style.borderBottomRightRadius), box.right - rect.right, box.bottom - rect.bottom],
  ];

  let worst: { corner: string; clearance: number } | null = null;
  for (const [name, declared, x, y] of corners) {
    const R = effectiveRadius(declared, box.width, box.height);
    const r = painted.radii[name] ?? 0;
    if (R <= 0) continue;
    if (x >= R || y >= R) continue; // Clear of the arc entirely; nothing to reach it.
    // A child whose radius is the container's less its inset is *concentric* — a circle
    // sitting in a pill's end, a card inside a card. That is the correct answer to a curve,
    // not a collision, and sub-pixel rounding otherwise reports it as one.
    if (r > 0 && Math.abs(r - (R - Math.min(x, y))) < 1.5) continue;
    const clearance = R - r - Math.hypot(R - x - r, R - y - r);
    if (!worst || clearance < worst.clearance) worst = { corner: name, clearance };
  }
  return worst;
}

/**
 * Below this much room between painted content and the curve, a corner *reads* as crowded even
 * when the geometry technically clears. Four pixels is about where the eye stops seeing a
 * margin and starts seeing the round edge running into the text.
 */
const COMFORTABLE_CLEARANCE = 4;

/** The nearest ancestor with a corner big enough to reach content, if any. */
function roundedAncestor(element: Element): Element | null {
  let node = element.parentElement;
  while (node && node !== document.body) {
    const style = getComputedStyle(node);
    const box = node.getBoundingClientRect();
    if (effectiveRadius(parseFloat(style.borderTopLeftRadius), box.width, box.height) >= 12) return node;
    node = node.parentElement;
  }
  return null;
}

const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TITLE", "HEAD", "META", "LINK", "BR", "SVG", "PATH"]);

/**
 * Text hidden from sight but left for a screen reader — `sr-only`, and the hand-rolled
 * equivalents. Every one of them is a 1px box with its content clipped on purpose, which is
 * indistinguishable from the real "text cut off with nowhere to go" fault unless it is named.
 * Reporting them would bury the genuine findings under a page's worth of correct code.
 */
function isScreenReaderOnly(element: Element, style: CSSStyleDeclaration): boolean {
  const rect = element.getBoundingClientRect();
  const tiny = rect.width <= 1 || rect.height <= 1;
  const clipped = style.clipPath !== "none" || style.clip !== "auto";
  return tiny && clipped && style.position === "absolute";
}

/**
 * Content the page has already declared is not content: `aria-hidden`, `role="presentation"`,
 * and anything inside them. Base UI's progress primitive, for one, parks a 1×1 span holding
 * the letter "x" inside every gauge as a measurement helper — real to the layout engine, not
 * to a reader, and four findings a page if it is taken at face value.
 */
function isDecorative(element: Element): boolean {
  return Boolean(element.closest('[aria-hidden="true"], [role="presentation"], [role="none"]'));
}

function isVisible(element: Element, style: CSSStyleDeclaration): boolean {
  if (SKIP_TAGS.has(element.tagName)) return false;
  if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return false;
  if (isScreenReaderOnly(element, style)) return false;
  // The inspector's own panel is not part of the page it is measuring.
  if (element.closest("[data-ui-inspector]")) return false;
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

/** True when the element holds text of its own rather than only wrapping other elements. */
function ownText(element: Element): string {
  let text = "";
  for (const node of Array.from(element.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) text += node.textContent ?? "";
  }
  return text.trim();
}

/**
 * Everything on the page that is measurably wrong, in the terms this project already uses.
 *
 * Deliberately narrow. It reports only what a machine can be certain about — a ratio below a
 * published floor, text painted outside the box that clips it, a control smaller than a
 * fingertip — and says nothing about whether a thing looks right, which is not a measurement.
 */
export function scanPage(tokens: TokenTable): Finding[] {
  const findings: Finding[] = [];
  const seen = new Set<Element>();
  const viewportWidth = document.documentElement.clientWidth;

  for (const element of Array.from(document.body.querySelectorAll("*"))) {
    const style = getComputedStyle(element);
    if (!isVisible(element, style)) continue;
    const rect = element.getBoundingClientRect();
    // Decorative content is skipped for the text checks but still measured as a tap target:
    // a control does not stop needing to be hittable because its label is hidden.
    const text = isDecorative(element) ? "" : ownText(element);

    // ---- contrast, on elements that paint their own text ----
    if (text && !seen.has(element)) {
      const foreground = toRgb(style.color);
      if (foreground) {
        const background = effectiveBackground(element);
        const ratio = contrast(foreground, background);
        const floor = isLargeText(style) ? 3 : 4.5;
        if (ratio < floor) {
          const names = tokensFor(tokens, style.color);
          findings.push({
            kind: "contrast",
            element,
            message: `“${text.slice(0, 40)}” is ${ratio.toFixed(2)}:1 against its background (needs ${floor}:1)`,
            hint: names.length
              ? `Painted with ${names[0]}. The ramp contract says 700 is the text rung on every ground.`
              : "This colour is not one of the palette tokens — see the ramp contract in CLAUDE.md.",
          });
          seen.add(element);
        }
      }
    }

    // ---- text clipped by its own box ----
    const clipsX = style.overflowX === "hidden" || style.overflowX === "clip";
    const clipsY = style.overflowY === "hidden" || style.overflowY === "clip";
    const hiddenX = element.scrollWidth - element.clientWidth;
    const hiddenY = element.scrollHeight - element.clientHeight;
    const ellipsis = style.textOverflow.includes("ellipsis");
    if (clipsX && hiddenX > 1 && !ellipsis && text) {
      findings.push({
        kind: "clipped",
        element,
        message: `${hiddenX}px of “${text.slice(0, 30)}” is cut off with no ellipsis`,
        hint: "Either let it wrap, add `truncate`, or give the container room.",
      });
    }
    if (clipsY && hiddenY > 1 && text) {
      findings.push({
        kind: "clipped",
        element,
        message: `${hiddenY}px of “${text.slice(0, 30)}” is cut off below the box`,
        hint: "A fixed height on text that grew — check for `h-*` where `min-h-*` was meant.",
      });
    }

    // ---- painted outside the viewport with no way to scroll to it ----
    if (rect.width > 0 && (rect.right > viewportWidth + 1 || rect.left < -1)) {
      const scrollable = document.documentElement.scrollWidth > viewportWidth + 1;
      if (!scrollable && element.children.length === 0) {
        findings.push({
          kind: "offscreen",
          element,
          message: `Sits at x ${Math.round(rect.left)}–${Math.round(rect.right)}, past a ${viewportWidth}px viewport`,
          hint: "Unreachable: the page does not scroll sideways to it.",
        });
      }
    }

    // ---- a form control's radius clipping its own text ----
    // Textareas, inputs and anything else that scrolls its own content are clipped to their
    // own border-radius, so a large corner cuts through the text *inside* the element. Nothing
    // above catches that, because there is no child element to measure — the glyphs belong to
    // the control itself. This is how the chapter notes field shipped with a 56px corner eating
    // seventeen pixels of its first line.
    if (
      (element.tagName === "TEXTAREA" || element.tagName === "INPUT") &&
      style.overflow !== "visible"
    ) {
      const box = element.getBoundingClientRect();
      const selfRadius = effectiveRadius(parseFloat(style.borderTopLeftRadius), box.width, box.height);
      const inset = Math.min(parseFloat(style.paddingTop) || 0, parseFloat(style.paddingLeft) || 0);
      if (selfRadius >= 12 && inset < selfRadius) {
        // The first line of text starts at the padding box's corner; a sharp point, no radius.
        const clearance = selfRadius - Math.hypot(selfRadius - inset, selfRadius - inset);
        if (clearance < COMFORTABLE_CLEARANCE) {
          findings.push({
            kind: "radius",
            element,
            message:
              clearance < 0
                ? `Its own ${Math.round(selfRadius)}px corner clips the text inside it by ${(-clearance).toFixed(1)}px`
                : `Its own text has only ${clearance.toFixed(1)}px before the ${Math.round(selfRadius)}px corner`,
            hint: `A ${element.tagName.toLowerCase()} is clipped to its own radius. ${Math.round(
              inset,
            )}px of padding against ${Math.round(selfRadius)}px — either pad it to about ${
              Math.ceil(requiredPadding(selfRadius)) + COMFORTABLE_CLEARANCE
            }px or take the radius down.`,
          });
        }
      }
    }

    // ---- content crowded by the corner arc ----
    // Measured against the nearest *rounded* ancestor rather than the direct parent, so text
    // three plain wrappers deep inside a menu is still judged against the menu's own curve.
    //
    // Decorative subtrees are exempt, and that is the whole distinction: a curve cutting
    // across a word is a fault, a curve cutting across a graphic is a mask. The palette
    // swatches are the case in point — each is a round window with a page and two seeds
    // drawn to overflow it deliberately, which is how the miniature works.
    const container = isDecorative(element) ? null : roundedAncestor(element);
    if (container) {
      const hit = cornerClearance(container, element);
      if (hit && hit.clearance < COMFORTABLE_CLEARANCE) {
        const containerStyle = getComputedStyle(container);
        const containerBox = container.getBoundingClientRect();
        const radius = effectiveRadius(
          parseFloat(containerStyle.borderTopLeftRadius),
          containerBox.width,
          containerBox.height,
        );
        const padding = Math.min(parseFloat(containerStyle.paddingTop), parseFloat(containerStyle.paddingLeft)) || 0;
        const needed = Math.ceil(requiredPadding(radius)) + COMFORTABLE_CLEARANCE;
        const label = (element.textContent ?? "").trim().slice(0, 30) || element.tagName.toLowerCase();
        findings.push({
          kind: "radius",
          element: container,
          message:
            hit.clearance < 0
              ? `Its ${Math.round(radius)}px ${hit.corner} corner cuts across “${label}” by ${(-hit.clearance).toFixed(1)}px`
              : `“${label}” has only ${hit.clearance.toFixed(1)}px before the ${Math.round(radius)}px ${hit.corner} corner`,
          hint: `${Math.round(padding)}px of padding against a ${Math.round(
            radius,
          )}px radius. That radius wants roughly ${needed}px to look unhurried — or take the radius down.`,
        });
      }
    }

    // ---- controls too small to hit ----
    const interactive =
      element.tagName === "BUTTON" ||
      element.tagName === "A" ||
      element.tagName === "INPUT" ||
      element.getAttribute("role") === "button" ||
      element.getAttribute("role") === "tab";
    if (interactive && (rect.width < 24 || rect.height < 24) && style.position !== "absolute") {
      findings.push({
        kind: "tap-target",
        element,
        message: `${Math.round(rect.width)}×${Math.round(rect.height)}px target (WCAG 2.2 asks for 24×24)`,
        hint: "Grow the padding, or give it a `size-*` that clears 24px.",
      });
    }
  }

  return findings;
}

/** Where an element sits in the tree, in the terms this codebase names things by. */
export function describeElement(element: Element): string {
  const parts: string[] = [];
  let node: Element | null = element;
  let depth = 0;
  while (node && depth < 6) {
    const slot = node.getAttribute("data-slot");
    const role = node.getAttribute("role");
    const label = node.getAttribute("aria-label");
    let own = node.tagName.toLowerCase();
    if (slot) own += `[${slot}]`;
    else if (role) own += `[role=${role}]`;
    if (label && node === element) own += ` “${label}”`;
    parts.unshift(own);
    node = node.parentElement;
    depth++;
  }
  return parts.join(" › ");
}
