/**
 * Every colour in the app, for every palette, in both modes — and the single derivation
 * that turns a palette into the CSS custom properties `globals.css` already expects.
 *
 * Pure and free of React and of Node: the CSS generator (`scripts/build-theme-css.ts`), the
 * contrast audit (`scripts/theme-check.ts`) and the Settings picker all read this one file,
 * so a swatch in the UI cannot drift from the colour the stylesheet actually paints.
 *
 * ------------------------------------------------------------------------------------------
 * THE ONE THING TO UNDERSTAND BEFORE EDITING: the ramps are ordered by ROLE, not by lightness.
 * ------------------------------------------------------------------------------------------
 *
 * `100` is always "the faintest presence of this hue against the ground this mode sits on" and
 * `900` is always "the strongest ink of this hue". In a light mode that runs light → dark; in a
 * dark mode it runs dark → light. `--neutral-100` is the *darkest* neutral in dark mode, and
 * that is deliberate.
 *
 * This is the Radix Colors model, and it is what lets a dark mode exist at all without touching
 * the ~200 places that already write `text-ochre-800` on `bg-ochre-100`, `border-neutral-600`
 * for a hollow "empty" ring, or `bg-press-200` for a soft brand tint. Each of those pairings
 * states a *relationship* — dark ink on a faint tint, a boundary that clears 3:1 — and the
 * relationship is what has to survive the mode change. Ordering the ramps by lightness instead
 * would have meant auditing and rewriting every one of those call sites, and any component
 * added later would have had to remember the rule all over again.
 *
 * The base aliases follow the same logic: `--press` is the 700 rung in *both* modes, because
 * 700 is the rung that means "this hue, strong enough to be read as text on this mode's
 * grounds". See `scripts/theme-check.ts`, which asserts exactly that.
 */

export type RampStep = 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;

/** Nine rungs, faintest-against-the-ground (100) to strongest ink (900). */
export type Ramp = Record<RampStep, string>;

export const RAMP_STEPS: readonly RampStep[] = [100, 200, 300, 400, 500, 600, 700, 800, 900];

/** The rung each base alias points at. Named because the audit asserts against it. */
export const BASE_STEP: RampStep = 700;
/** The rung `--muted` / `--secondary` / `--accent` are drawn from. */
export const MUTED_STEP: RampStep = 200;
/** The rung `--subtle` / `--muted-foreground` are drawn from. */
export const SUBTLE_STEP: RampStep = 700;

export interface PaletteMode {
  /** Drives `color-scheme`, and tells the audit which direction the ramps run. */
  scheme: "light" | "dark";

  /* ---- The three grounds. See CLAUDE.md, "Three grounds, and a page". ---- */
  /** The well the canvas sits in — the desk. */
  background: string;
  /** Panels and bars. Chrome *recedes*, so it is the quietest of the three in both modes:
      further from the eye than the desk in light, further into the dark in dark. */
  chrome: string;
  /** The manuscript page. The most present surface in both modes — it is the lit thing. */
  sheet: string;

  /** Body ink. */
  foreground: string;
  /** Text laid on a solid `--press` / `--ochre` fill. */
  onAccent: string;
  /** Text laid on a solid `--proof` fill. Separate from `onAccent`: a red fill and a
      terracotta fill do not always want the same ink. */
  onProof: string;

  neutral: Ramp;
  press: Ramp;
  ochre: Ramp;
  /** Destructive. A single value: nothing in the app needs a ramp of reds. */
  proof: string;

  /** What every hairline is mixed from — `--border`, `--input`, `--edge`, `--divider`, the
      scrollbar. Near-black in a light mode, near-white in a dark one. */
  hairline: string;

  /** The manuscript's ink warms towards this, the way real ink never reaches the black it was
      ground from. Warm and dark under a light page; warm and pale under a dark one. */
  inkTint: string;

  /** Elevation. A shadow in a lamplit room is never grey, and a dark room swallows a soft
      one — so both the colour and the strength are per mode. */
  elevKey: string;
  elevAmbient: string;
  /** The lit top edge on e2/e3 and on the page itself. Nearly the whole story of elevation on
      a dark ground, where a drop shadow has almost no boundary contrast to work with. */
  elevEdge: string;

  /** Paper grain. `multiply` darkens the tile into a light page; on a dark page it would only
      muddy it, so a dark mode lifts the same tile with `screen` instead. */
  grainBlend: "multiply" | "screen";
  /** Multiplier on the grain's `--page-lift`-derived opacity. Screen-blended grain on a dark
      page reads far louder than multiply does on a light one, so this is not always 1. */
  grainStrength: number;

  /** How much `--press` washes a text selection. A light accent at the light mode's 35% over a
      dark ground is a glare, not a highlight. */
  selectionMix: number;
}

export interface Palette {
  id: PaletteId;
  /** Shown in Settings. */
  label: string;
  /** One line under the label — what this palette is, not how it was made. */
  blurb: string;
  light: PaletteMode;
  dark: PaletteMode;
}

export type PaletteId = "citrus" | "moonlight" | "evergreen" | "celestial";

export const PALETTE_IDS: readonly PaletteId[] = ["citrus", "moonlight", "evergreen", "celestial"];

export const DEFAULT_PALETTE: PaletteId = "citrus";

/* ------------------------------------------------------------------------------------------ */
/*  Citrus — the default, and the one the app was designed in.                                  */
/*                                                                                              */
/*  The light mode is the Claude Design handoff, unchanged: warm cream stock, terracotta ink,    */
/*  sage as the second voice. Nothing here is a new colour; it is the existing :root block       */
/*  lifted into data so a second mode can exist beside it.                                      */
/*                                                                                              */
/*  The dark mode is new, and is a design rather than an inversion. Inverting the cream would    */
/*  have given a cold grey; a grove at night is not a grey place. The grounds are the bark and   */
/*  soil end of the same warm hue family, the ink is cream rather than white, and the two        */
/*  accents climb their own ramps to the pale end — the fruit still catches the light.           */
/*  The relationship between the three grounds is preserved rather than the values: chrome       */
/*  recedes furthest, the desk sits between, the page is the brightest thing on screen.          */
/* ------------------------------------------------------------------------------------------ */
const citrus: Palette = {
  id: "citrus",
  label: "Citrus",
  blurb: "Warm cream stock, terracotta and sage. The house palette.",
  light: {
    scheme: "light",
    background: "#f5ead8",
    chrome: "#ebddc5",
    sheet: "#f9f4ed",
    foreground: "#201e1d",
    onAccent: "#f5ead8",
    onProof: "#f9f4ed",
    neutral: {
      100: "#f9f4ed",
      200: "#eee7db",
      300: "#dcd3c4",
      400: "#c0b6a5",
      500: "#a19786",
      600: "#82796a",
      700: "#645c50",
      800: "#474238",
      900: "#2e2b25",
    },
    press: {
      100: "#fff2eb",
      200: "#ffe1d0",
      300: "#ffc6a5",
      400: "#f6a06b",
      500: "#d67f48",
      600: "#b2622d",
      700: "#8c491a",
      800: "#643312",
      900: "#402310",
    },
    ochre: {
      100: "#f0fae1",
      200: "#e1eecc",
      300: "#ccdbb2",
      400: "#aebf92",
      500: "#8fa073",
      600: "#728157",
      700: "#56633f",
      800: "#3d472b",
      900: "#272e1b",
    },
    proof: "#9e3225",
    hairline: "#201e1d",
    inkTint: "#402310",
    elevKey: "rgb(60 40 20 / 0.16)",
    elevAmbient: "rgb(60 40 20 / 0.1)",
    elevEdge: "rgb(255 250 240 / 0.85)",
    grainBlend: "multiply",
    grainStrength: 1,
    selectionMix: 35,
  },
  dark: {
    scheme: "dark",
    background: "#1e1813",
    chrome: "#17120e",
    sheet: "#2b241d",
    foreground: "#f2e7d6",
    onAccent: "#231710",
    onProof: "#2a1310",
    neutral: {
      100: "#2b241d",
      200: "#342c23",
      300: "#42382d",
      400: "#584c3e",
      500: "#786a58",
      600: "#9c8d78",
      700: "#c0b09a",
      800: "#dbcdb8",
      900: "#f2e7d6",
    },
    press: {
      100: "#2c1a11",
      200: "#3f2415",
      300: "#5b331a",
      400: "#7d4620",
      500: "#a75f2c",
      600: "#d07f45",
      700: "#f0a874",
      800: "#f9c9a5",
      900: "#ffe5d2",
    },
    ochre: {
      100: "#1f2417",
      200: "#2a321d",
      300: "#3a4527",
      400: "#4e5b34",
      500: "#6a7a48",
      600: "#8b9c64",
      700: "#b0bf88",
      800: "#cdd7ae",
      900: "#e7edd4",
    },
    proof: "#f0796a",
    hairline: "#f2e7d6",
    inkTint: "#ffdaa8",
    elevKey: "rgb(0 0 0 / 0.6)",
    elevAmbient: "rgb(0 0 0 / 0.45)",
    elevEdge: "rgb(255 236 208 / 0.07)",
    grainBlend: "screen",
    grainStrength: 0.5,
    selectionMix: 30,
  },
};

/* ------------------------------------------------------------------------------------------ */
/*  Nord — arctic, bluish. Built on the published Nord palette (nord0–nord15).                   */
/*                                                                                              */
/*  Nord ships no official light theme, so the light mode here is built the way the project      */
/*  itself is documented: Snow Storm for the grounds, and Frost and Aurora walked further down   */
/*  their own hues until they clear 4.5:1 as text. `--press` is Frost, `--ochre` is Aurora        */
/*  green — the "in progress" role wants the colour Nord itself uses for growth, not its         */
/*  yellow, which in this palette reads as a warning.                                            */
/* ------------------------------------------------------------------------------------------ */

/* ------------------------------------------------------------------------------------------ */
/*  Gruvbox — retro, warm, high contrast. The closest relative Citrus has among the well-known   */
/*  palettes, which is why it is here: someone who likes the house look and wants more contrast  */
/*  has somewhere to go. `--press` is Gruvbox orange (its signature), `--ochre` its green.       */
/*  Both modes use the published bright/faded accent sets, which Gruvbox already tuned for       */
/*  their own ground — one of the few palettes that hands you both directions.                   */
/* ------------------------------------------------------------------------------------------ */

/* ------------------------------------------------------------------------------------------ */
/*  Rosé Pine — the one cool, low-saturation option, and the only palette here whose two modes   */
/*  are both published upstream (Main and Dawn). `--press` is iris, `--ochre` is gold: the       */
/*  secondary slot is documented as "the warm accent", and gold is the warm one in this family.  */
/*  Dawn's own iris and love are large-fill colours upstream, so they sit at 600 and the text    */
/*  aliases point one rung deeper, the same correction Citrus already makes.                     */
/* ------------------------------------------------------------------------------------------ */

/* ------------------------------------------------------------------------------------------ */
/*  Solarized — Ethan Schoonover's, and the reason a palette picker is worth building: it is     */
/*  the canonical pair, designed as one thing in two modes rather than a light theme with a      */
/*  dark cousin bolted on. `--press` is blue, `--ochre` is yellow.                               */
/*                                                                                              */
/*  Solarized is deliberately low-contrast — that is the design, not an oversight — so it sits   */
/*  closer to the 4.5:1 floor than the others and clears it rather than sailing over it. The     */
/*  canonical accents (#268bd2 blue, #b58900 yellow) land at the 600 rung here for the same      */
/*  reason they do everywhere else in this file: they are large-fill colours, and the base       */
/*  alias has to be readable as text.                                                            */
/* ------------------------------------------------------------------------------------------ */






/* ------------------------------------------------------------------------------------------ */
/*  The three companions to Citrus.                                                             */
/*                                                                                              */
/*  Their ramps were solved against the contract in scripts/theme-check.ts rather than           */
/*  eyeballed: hue and chroma are held, only lightness moves. Moonlight is the exception worth   */
/*  knowing about — with no hue to separate them, its two accents separate by value instead.     */
/* ------------------------------------------------------------------------------------------ */

const moonlight: Palette = {
  id: "moonlight",
  label: "Moonlight",
  blurb: "Black, white and the greys between. No colour at all.",
  light: {
    scheme: "light",
    background: "#f4f4f4",
    chrome: "#e9e9e9",
    sheet: "#ffffff",
    foreground: "#111111",
    onAccent: "#ffffff",
    onProof: "#ffffff",
    neutral: {
      100: "#f4f4f4",
      200: "#eeeeee",
      300: "#d3d3d3",
      400: "#b6b6b6",
      500: "#9b9b9b",
      600: "#838383",
      700: "#676767",
      800: "#545454",
      900: "#424242",
    },
    press: {
      100: "#f2f2f2",
      200: "#e8e8e8",
      300: "#c6c6c6",
      400: "#9e9e9e",
      500: "#7c7c7c",
      600: "#464646",
      700: "#202020",
      800: "#000000",
      900: "#000000",
    },
    ochre: {
      100: "#f4f4f4",
      200: "#ececec",
      300: "#d3d3d3",
      400: "#b6b6b6",
      500: "#9b9b9b",
      600: "#747474",
      700: "#525252",
      800: "#434343",
      900: "#343434",
    },
    proof: "#b81327",
    hairline: "#111111",
    inkTint: "#2b2b2b",
    elevKey: "rgb(0 0 0 / 0.14)",
    elevAmbient: "rgb(0 0 0 / 0.09)",
    elevEdge: "rgb(255 255 255 / 0.9)",
    grainBlend: "multiply",
    grainStrength: 1,
    selectionMix: 32,
  },
  dark: {
    scheme: "dark",
    background: "#121212",
    chrome: "#0a0a0a",
    sheet: "#1c1c1c",
    foreground: "#f2f2f2",
    onAccent: "#0a0a0a",
    onProof: "#0a0a0a",
    neutral: {
      100: "#121212",
      200: "#161616",
      300: "#282828",
      400: "#3e3e3e",
      500: "#535353",
      600: "#696969",
      700: "#868686",
      800: "#9c9c9c",
      900: "#b4b4b4",
    },
    press: {
      100: "#131313",
      200: "#191919",
      300: "#323232",
      400: "#535353",
      500: "#737373",
      600: "#aaaaaa",
      700: "#dedede",
      800: "#fdfdfd",
      900: "#ffffff",
    },
    ochre: {
      100: "#121212",
      200: "#161616",
      300: "#282828",
      400: "#3e3e3e",
      500: "#535353",
      600: "#737373",
      700: "#9a9a9a",
      800: "#aeaeae",
      900: "#c2c2c2",
    },
    proof: "#eb596f",
    hairline: "#f2f2f2",
    inkTint: "#e4e4e4",
    elevKey: "rgb(0 0 0 / 0.6)",
    elevAmbient: "rgb(0 0 0 / 0.45)",
    elevEdge: "rgb(242 242 242 / 0.08)",
    grainBlend: "screen",
    grainStrength: 0.4,
    selectionMix: 30,
  },
};

const evergreen: Palette = {
  id: "evergreen",
  label: "Evergreen",
  blurb: "Deep forest green and moss. The densest of the four.",
  light: {
    scheme: "light",
    background: "#eef3e8",
    chrome: "#e4ebdb",
    sheet: "#f7faf2",
    foreground: "#1e2a1c",
    onAccent: "#ffffff",
    onProof: "#ffffff",
    neutral: {
      100: "#eff1ee",
      200: "#e9ebe8",
      300: "#ced2cc",
      400: "#b0b6ac",
      500: "#959d91",
      600: "#7c8677",
      700: "#5f695a",
      800: "#4d5748",
      900: "#3b4437",
    },
    press: {
      100: "#eaf4e9",
      200: "#e0eee0",
      300: "#bfd8bf",
      400: "#99be99",
      500: "#76a677",
      600: "#448048",
      700: "#28642d",
      800: "#12511b",
      900: "#003d05",
    },
    ochre: {
      100: "#f3f1e5",
      200: "#edeadb",
      300: "#d7d1b6",
      400: "#beb58b",
      500: "#a89b63",
      600: "#827229",
      700: "#675701",
      800: "#544400",
      900: "#413100",
    },
    proof: "#a9332b",
    hairline: "#1e2a1c",
    inkTint: "#2f3d2b",
    elevKey: "rgb(30 42 28 / 0.16)",
    elevAmbient: "rgb(30 42 28 / 0.1)",
    elevEdge: "rgb(252 255 246 / 0.9)",
    grainBlend: "multiply",
    grainStrength: 1,
    selectionMix: 32,
  },
  dark: {
    scheme: "dark",
    background: "#131a13",
    chrome: "#0d120d",
    sheet: "#1b241a",
    foreground: "#dbe6d5",
    onAccent: "#131a13",
    onProof: "#0d120d",
    neutral: {
      100: "#161816",
      200: "#1a1c19",
      300: "#2a2f28",
      400: "#3e453b",
      500: "#525b4c",
      600: "#65715e",
      700: "#828f7b",
      800: "#98a691",
      900: "#b0bea9",
    },
    press: {
      100: "#111a11",
      200: "#131f13",
      300: "#1a331b",
      400: "#214c24",
      500: "#27652d",
      600: "#38883f",
      700: "#59a85d",
      800: "#71c175",
      900: "#8adb8d",
    },
    ochre: {
      100: "#1b170e",
      200: "#201c0f",
      300: "#362c11",
      400: "#514111",
      500: "#6c560b",
      600: "#927515",
      700: "#b1933c",
      800: "#caac56",
      900: "#e4c570",
    },
    proof: "#e26e6a",
    hairline: "#dbe6d5",
    inkTint: "#cbd9c4",
    elevKey: "rgb(0 0 0 / 0.6)",
    elevAmbient: "rgb(0 0 0 / 0.45)",
    elevEdge: "rgb(219 230 213 / 0.08)",
    grainBlend: "screen",
    grainStrength: 0.4,
    selectionMix: 30,
  },
};

const celestial: Palette = {
  id: "celestial",
  label: "Celestial",
  blurb: "Nebula violet and starlight cyan. A sky, not a room.",
  light: {
    scheme: "light",
    background: "#eeecf8",
    chrome: "#e3e0f0",
    sheet: "#f7f5fd",
    foreground: "#221d3c",
    onAccent: "#ffffff",
    onProof: "#ffffff",
    neutral: {
      100: "#ededf3",
      200: "#e7e6ef",
      300: "#cdccdb",
      400: "#b0aec4",
      500: "#9793b0",
      600: "#7f7a9d",
      700: "#635e7f",
      800: "#514c6c",
      900: "#3f3a59",
    },
    press: {
      100: "#eaebff",
      200: "#e2e4ff",
      300: "#c7c8ff",
      400: "#a9a8ff",
      500: "#9088ff",
      600: "#6c56ed",
      700: "#5536ce",
      800: "#461bb8",
      900: "#330098",
    },
    ochre: {
      100: "#e3f0f3",
      200: "#d8eaed",
      300: "#b2d3d9",
      400: "#85b9c2",
      500: "#5aa1ad",
      600: "#0a7b8a",
      700: "#005e6d",
      800: "#004a58",
      900: "#003644",
    },
    proof: "#ac1c37",
    hairline: "#221d3c",
    inkTint: "#332a55",
    elevKey: "rgb(34 29 60 / 0.16)",
    elevAmbient: "rgb(34 29 60 / 0.1)",
    elevEdge: "rgb(255 255 255 / 0.9)",
    grainBlend: "multiply",
    grainStrength: 1,
    selectionMix: 32,
  },
  dark: {
    scheme: "dark",
    background: "#100e20",
    chrome: "#080713",
    sheet: "#191733",
    foreground: "#ddd9f5",
    onAccent: "#100e20",
    onProof: "#080713",
    neutral: {
      100: "#101015",
      200: "#14141b",
      300: "#272534",
      400: "#3d3a53",
      500: "#534e71",
      600: "#696390",
      700: "#857fae",
      800: "#9c96c6",
      900: "#b3addf",
    },
    press: {
      100: "#100f1c",
      200: "#151225",
      300: "#272147",
      400: "#3f3372",
      500: "#56449d",
      600: "#755fd2",
      700: "#927ef5",
      800: "#ab98ff",
      900: "#c7b5ff",
    },
    ochre: {
      100: "#061315",
      200: "#06181b",
      300: "#002c32",
      400: "#00464f",
      500: "#005e6c",
      600: "#007e8f",
      700: "#009fb1",
      800: "#23b8ca",
      900: "#4ad2e4",
    },
    proof: "#e95778",
    hairline: "#ddd9f5",
    inkTint: "#c9c3ec",
    elevKey: "rgb(0 0 0 / 0.6)",
    elevAmbient: "rgb(0 0 0 / 0.45)",
    elevEdge: "rgb(221 217 245 / 0.08)",
    grainBlend: "screen",
    grainStrength: 0.4,
    selectionMix: 30,
  },
};

export const PALETTES: Record<PaletteId, Palette> = { citrus, moonlight, evergreen, celestial };

/** In the order the Settings picker shows them: the house palette first, then alphabetical. */
/** Settings order: the house palette first, then the three that were designed for it. */
export const PALETTE_LIST: readonly Palette[] = [citrus, moonlight, evergreen, celestial];

export function isPaletteId(value: unknown): value is PaletteId {
  return typeof value === "string" && (PALETTE_IDS as readonly string[]).includes(value);
}

/**
 * The swatch a picker draws for one palette: the ground it sits on, and the two accents.
 * Derived rather than authored so a swatch can never claim a colour the stylesheet does not
 * paint.
 */
export function paletteSwatch(palette: Palette, scheme: "light" | "dark") {
  const mode = palette[scheme];
  return {
    ground: mode.background,
    sheet: mode.sheet,
    press: mode.press[BASE_STEP],
    ochre: mode.ochre[BASE_STEP],
    ink: mode.foreground,
  };
}
