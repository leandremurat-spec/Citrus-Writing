/**
 * How the writing surface looks. Per device, not per account: a writer on a laptop in a bright
 * room and the same writer on a desktop at night do not want the same page brightness, and
 * these are preferences about a screen rather than facts about a book.
 *
 * Pure and free of React so the store, the panel, and the CSS-variable writer all agree.
 */

export type Measure = "narrow" | "comfortable" | "wide";

/*
 * The manuscript face is a per-device choice, not a fixed token: the design system this app
 * is built on ships no reading serif of its own, so the prose face has always been a pick
 * among candidates rather than a single "correct" answer. Newsreader is the shipped default
 * (drawn for reading at length); the other four are the handoff's own candidate list.
 */
export type ProseFace = "figtree" | "newsreader" | "lora" | "sourceSerif4" | "ebGaramond";

export const PROSE_FACES: Record<ProseFace, { label: string; family: string }> = {
  figtree: { label: "Figtree", family: "var(--font-figtree), ui-sans-serif, system-ui, sans-serif" },
  newsreader: { label: "Newsreader", family: "var(--font-newsreader), ui-serif, Georgia, serif" },
  lora: { label: "Lora", family: "var(--font-lora), ui-serif, Georgia, serif" },
  sourceSerif4: { label: "Source Serif", family: "var(--font-source-serif-4), ui-serif, Georgia, serif" },
  ebGaramond: { label: "EB Garamond", family: "var(--font-eb-garamond), ui-serif, Georgia, serif" },
};

const PROSE_FACE_VALUES: readonly ProseFace[] = ["figtree", "newsreader", "lora", "sourceSerif4", "ebGaramond"];

export interface Appearance {
  /** 0–100. How far the page lifts off the desk; 0 is flush with the canvas. */
  pageBrightness: number;
  /** 0–100. The warm pool behind the page. 0 turns it off entirely. */
  lamplight: number;
  measure: Measure;
  /** Manuscript type size in px. Chrome never moves. */
  typeSize: number;
  /** What the prose itself is set in. Chrome stays on --font-sans regardless. */
  proseFace: ProseFace;
  /** Keep the line you are on near the middle of the canvas. */
  typewriter: boolean;
  /** Only the paragraph under the caret stays at full strength. */
  dimOthers: boolean;
  /** Off means the selection menu and keyboard shortcuts only. */
  showToolbar: boolean;
}

export const APPEARANCE_DEFAULTS: Appearance = {
  // Lamplight defaults on, low. The direction picked for this app is the lit page; opening
  // flat would hide the one thing that makes the canvas read as a page rather than a panel.
  pageBrightness: 62,
  lamplight: 35,
  measure: "comfortable",
  typeSize: 17,
  proseFace: "newsreader",
  typewriter: false,
  dimOthers: false,
  showToolbar: true,
};

export const APPEARANCE_KEY = "pith:appearance";

/*
 * Chosen against the space the canvas actually has, not against an ideal page.
 *
 * With both side panels open on a 1440px window the sheet gives the column about 611px, so
 * the old 46rem (736px) and 58rem (928px) both clamped to the container and rendered
 * identically — "comfortable" and "wide" were the same setting. These three are distinct in
 * the default three-panel layout, and wide opens up further the moment a panel is hidden.
 */
export const MEASURE_WIDTH: Record<Measure, string> = {
  narrow: "30rem", // ~55 characters
  comfortable: "36rem", // ~66 characters
  wide: "44rem", // ~80; needs a panel hidden to reach its full width
};

export const TYPE_SIZE_MIN = 14;
export const TYPE_SIZE_MAX = 22;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Anything stored is untrusted: it may be from an older version, or hand-edited. */
export function normalizeAppearance(input: unknown): Appearance {
  const raw = (typeof input === "object" && input !== null ? input : {}) as Partial<Appearance>;
  const measure: Measure =
    raw.measure === "narrow" || raw.measure === "wide" || raw.measure === "comfortable"
      ? raw.measure
      : APPEARANCE_DEFAULTS.measure;
  const proseFace: ProseFace = PROSE_FACE_VALUES.includes(raw.proseFace as ProseFace)
    ? (raw.proseFace as ProseFace)
    : APPEARANCE_DEFAULTS.proseFace;

  return {
    pageBrightness: clamp(Number(raw.pageBrightness ?? APPEARANCE_DEFAULTS.pageBrightness), 0, 100),
    lamplight: clamp(Number(raw.lamplight ?? APPEARANCE_DEFAULTS.lamplight), 0, 100),
    measure,
    typeSize: Math.round(clamp(Number(raw.typeSize ?? APPEARANCE_DEFAULTS.typeSize), TYPE_SIZE_MIN, TYPE_SIZE_MAX)),
    proseFace,
    typewriter: Boolean(raw.typewriter ?? APPEARANCE_DEFAULTS.typewriter),
    dimOthers: Boolean(raw.dimOthers ?? APPEARANCE_DEFAULTS.dimOthers),
    showToolbar: raw.showToolbar === undefined ? APPEARANCE_DEFAULTS.showToolbar : Boolean(raw.showToolbar),
  };
}

/** The CSS custom properties the canvas reads. Written onto <html> by the store. */
export function appearanceVars(a: Appearance): Record<string, string> {
  return {
    "--page-lift": String(a.pageBrightness / 100),
    "--lamplight": String(a.lamplight / 100),
    "--measure": MEASURE_WIDTH[a.measure],
    "--manuscript-size": `${a.typeSize}px`,
    "--manuscript-font-family": PROSE_FACES[a.proseFace].family,
  };
}
