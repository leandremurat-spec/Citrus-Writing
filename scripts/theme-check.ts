/**
 * Audits every palette, in both modes, against the pairings the app actually paints — and
 * checks that `src/app/palettes.css` is the file the current palette data would generate.
 *
 * `npm run theme:check`
 *
 * Two things this is not. It is not a substitute for looking at the running app: it says
 * nothing about whether a palette is *pleasant*. And it is not a general contrast scanner —
 * it does not walk the DOM. The pairing table below is hand-built from the class strings the
 * components actually carry (ochre-800 text on an ochre-100 tag, neutral-600 for a hollow
 * ring, and so on), so adding a genuinely new pairing to a component means adding it here
 * too. That is the trade: a table that can go stale, in exchange for a check that runs in a
 * second without a browser and covers ten palettes at once.
 *
 * Thresholds are WCAG 2.1: 4.5:1 for text (nothing in this app's chrome is large enough to
 * claim the 3:1 large-text exemption — the biggest chrome step is 18px regular), 3:1 for the
 * boundary of a graphical object such as a status dot or a hollow ring.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  BASE_STEP,
  PALETTE_LIST,
  RAMP_STEPS,
  SUBTLE_STEP,
  type PaletteMode,
  type RampStep,
} from "../src/lib/theme/palettes";
import { paletteVars } from "../src/lib/theme/tokens";
import { renderPaletteCss } from "./build-theme-css";

/* ------------------------------------------------------------------ */
/*  Colour maths                                                       */
/* ------------------------------------------------------------------ */

type Rgb = readonly [number, number, number];

function parseHex(hex: string): Rgb {
  const value = hex.trim().replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(value)) throw new Error(`Not a six-digit hex colour: ${hex}`);
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ];
}

/** WCAG 2.1 relative luminance. */
function luminance(rgb: Rgb): number {
  const linear = rgb.map((channel) => {
    const c = channel / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrast(a: string, b: string): number {
  const la = luminance(parseHex(a));
  const lb = luminance(parseHex(b));
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Simple alpha compositing, for the accent-wash tints. */
function over(top: string, bottom: string, alpha: number): string {
  const t = parseHex(top);
  const b = parseHex(bottom);
  const mix = t.map((channel, i) => Math.round(channel * alpha + b[i] * (1 - alpha)));
  return `#${mix.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

/* ------------------------------------------------------------------ */
/*  What the app actually paints                                       */
/* ------------------------------------------------------------------ */

interface Check {
  /** Where this pairing comes from, so a failure names a surface rather than a rule. */
  where: string;
  fg: string;
  bg: string;
  min: number;
  /**
   * A pairing that already failed in the shipped Citrus light theme, and that this work
   * neither introduced nor fixed. Reported at the end of a run so it stays visible, but it
   * does not fail the check: these are component decisions — which rung a status dot reaches
   * for — rather than palette decisions, and quietly rewriting the Run band's colour
   * vocabulary is not a change a dark mode gets to make on its own.
   */
  carriedOver?: boolean;
}

/** The three grounds plus the two surfaces derived from the neutral ramp, which between them
    are every ground text and marks land on. `--muted` doubles as `--secondary` and `--accent`,
    and is the hover fill under binder and codex rows.

    `neutral-100` joined the list with the marketing and account pages: the handoff's landing,
    pricing and auth screens all sit their cards on it rather than on `--card`, and the export
    dialog's preview well does too. In a dark palette it is the *darkest* neutral, so this is
    not a near-duplicate of `--sheet` — it is a genuinely different ground in one mode of four
    palettes, which is exactly the kind of pairing this table exists to catch. */
function grounds(mode: PaletteMode): { name: string; color: string }[] {
  return [
    { name: "background", color: mode.background },
    { name: "chrome/popover", color: mode.chrome },
    { name: "sheet/card", color: mode.sheet },
    { name: "muted/accent", color: mode.neutral[200] },
    { name: "card tint (neutral-100)", color: mode.neutral[100] },
  ];
}

function checksFor(mode: PaletteMode): Check[] {
  const checks: Check[] = [];
  const add = (where: string, fg: string, bg: string, min = 4.5) => checks.push({ where, fg, bg, min });
  const carried = (where: string, fg: string, bg: string, min = 3) =>
    checks.push({ where, fg, bg, min, carriedOver: true });

  /*
   * The ramp contract, and the reason a palette can be swapped in without re-auditing every
   * component: the 700 rung is readable as TEXT on every ground, and the 600 rung clears the
   * 3:1 floor for the BOUNDARY of a graphical object on every ground. Nothing below 600 makes
   * either promise — a mid-ramp colour cannot, by definition, separate from a near-ground
   * surface — so anything that has to be seen reaches for 600 or deeper.
   */
  for (const ground of grounds(mode)) {
    add(`--foreground on ${ground.name}`, mode.foreground, ground.color);
    add(`--subtle on ${ground.name}`, mode.neutral[SUBTLE_STEP], ground.color);
    add(`--press (700) as text on ${ground.name}`, mode.press[BASE_STEP], ground.color);
    add(`--ochre (700) as text on ${ground.name}`, mode.ochre[BASE_STEP], ground.color);

    /* The hollow "empty" ring — DRAFT in the Run band, the Binder, the Library, the Codex
       mention thread, the Buffer's open slots, the Progress panel's week dots. A boundary,
       not text, so 3:1. */
    add(`neutral-600 hollow ring on ${ground.name}`, mode.neutral[600], ground.color, 3);
    add(`press-600 mark on ${ground.name}`, mode.press[600], ground.color, 3);
    add(`ochre-600 mark on ${ground.name}`, mode.ochre[600], ground.color, 3);

    /* Deeper rungs used directly as text: library-page.tsx, buffer-board.tsx. */
    add(`neutral-700 as text on ${ground.name}`, mode.neutral[700], ground.color);
    add(`neutral-800 as text on ${ground.name}`, mode.neutral[800], ground.color);
  }

  /* --proof is narrower than the other accents: it appears on the editor's unreadable-chapter
     card, in the footer's over-length warning, and as a destructive menu item. Never on
     --muted, so requiring it there would distort the palette for a pairing nothing paints. */
  add("--proof as text on background", mode.proof, mode.background);
  add("--proof as text on chrome/popover", mode.proof, mode.chrome);
  add("--proof as text on sheet/card", mode.proof, mode.sheet);
  // chapter-workspace.tsx draws that card as proof text on a 5% proof wash.
  add("--proof on a 5% proof wash over sheet", mode.proof, over(mode.proof, mode.sheet, 0.05));
  // dropdown-menu.tsx / context-menu.tsx: a destructive item under the pointer. Those
  // primitives deepen the wash to 20% under `dark:`, so the mode decides the figure — reading
  // 10% for both would let a dark palette pass a pairing the browser never paints.
  const menuWash = mode.scheme === "dark" ? 0.2 : 0.1;
  add(
    `--proof on a ${menuWash * 100}% proof wash over popover`,
    mode.proof,
    over(mode.proof, mode.chrome, menuWash),
  );

  /* --- Ink on a solid accent fill --- */
  add("--press-foreground on --press (button, active tab)", mode.onAccent, mode.press[BASE_STEP]);
  add("--press-foreground on --ochre", mode.onAccent, mode.ochre[BASE_STEP]);
  add("--proof-foreground on --proof", mode.onProof, mode.proof);
  // cadence-editor.tsx sets ochre-100 text on an ochre-700 fill for the active weekday.
  add("ochre-100 on ochre-700 (active weekday)", mode.ochre[100], mode.ochre[BASE_STEP]);

  /* --- Ink on a soft brand tint. These are the pairings the ramp flip exists for. --- */
  // codex-browser.tsx, unlinked-summary.tsx, library-page.tsx — a tag on ochre-100.
  add("ochre-800 on ochre-100 (tag, mention pill)", mode.ochre[800], mode.ochre[100]);
  add("ochre-900 on ochre-100 (panel heading and body)", mode.ochre[900], mode.ochre[100]);
  // unlinked-summary.tsx hover, editor mention hover, cadence-editor.tsx.
  add("ochre-800 on ochre-200 (hover)", mode.ochre[800], mode.ochre[200]);
  add("ochre-900 on ochre-200 (inactive weekday)", mode.ochre[900], mode.ochre[200]);
  add("ochre-900 on ochre-300 (weekday hover)", mode.ochre[900], mode.ochre[300]);
  // selection-menu.tsx, codex-panel.tsx — a brand chip.
  add("--press (700) on press-100 (chip)", mode.press[BASE_STEP], mode.press[100]);
  add("--press (700) on press-200 (chip hover)", mode.press[BASE_STEP], mode.press[200]);
  // unlinked-summary.tsx — a count pill on press-100.
  add("press-800 on press-100", mode.press[800], mode.press[100]);
  // buffer-board.tsx — the drop target.
  add("press-800 on press-200", mode.press[800], mode.press[200]);
  // binder-row.tsx, codex-browser.tsx — the active row keeps body ink.
  add("--foreground on press-200 (active row)", mode.foreground, mode.press[200]);
  // buffer-board.tsx — a slot label on a neutral tile.
  add("neutral-800 on neutral-200 (buffer slot)", mode.neutral[800], mode.neutral[200]);
  // progress-panel.tsx — the current week's dot, ringed by ochre-200.
  add("ochre-600 dot against its ochre-200 ring", mode.ochre[600], mode.ochre[200], 3);

  /* --- The marketing, auth and export surfaces. The landing page's four figure discs are
         the reason most of these exist: each is a tinted circle carrying a heading in one of
         the accent ramps and a caption in the *neutral* ramp, which is a pairing nothing in
         the workspace had ever painted. --- */
  // page.tsx (landing) — the caption under each figure.
  add("neutral-800 caption on press-100 (figure disc)", mode.neutral[800], mode.press[100]);
  add("neutral-800 caption on press-200 (figure disc)", mode.neutral[800], mode.press[200]);
  add("neutral-800 caption on ochre-100 (figure disc)", mode.neutral[800], mode.ochre[100]);
  add("neutral-800 caption on ochre-300 (figure disc)", mode.neutral[800], mode.ochre[300]);
  // page.tsx — the figures themselves, in the accent the disc is tinted with.
  add("ochre-800 on ochre-300 (figure)", mode.ochre[800], mode.ochre[300]);
  add("--ochre (700) on ochre-100 (figure)", mode.ochre[BASE_STEP], mode.ochre[100]);
  // pricing-plans.tsx, account-settings.tsx, export-dialog.tsx — the highlighted plan card,
  // the brand-toned account card, and the open chapter's row in the export list.
  add("press-900 on press-100 (highlighted card)", mode.press[900], mode.press[100]);
  add("press-900 on press-200 (row hover)", mode.press[900], mode.press[200]);
  // export-dialog.tsx — the run-number pill, a neutral-100 circle inside a tinted row.
  add("press-800 on neutral-100 (run number pill)", mode.press[800], mode.neutral[100]);
  // segmented.tsx — an unselected option under the pointer.
  add("neutral-800 on neutral-300 (segmented hover)", mode.neutral[800], mode.neutral[300]);

  /* --- The manuscript. Ink is warmed toward --ink-tint by 7%, and sits on the page as the
         canvas actually composes it. Both ends of the brightness slider are checked, because
         a writer can set it anywhere: at 0 the sheet resolves to the background exactly. --- */
  const manuscriptInk = over(mode.inkTint, mode.foreground, 0.07);
  add("manuscript ink on a fully lifted page", manuscriptInk, mode.sheet);
  add("manuscript ink on a page set flush (brightness 0)", manuscriptInk, mode.background);

  /* --- Carried over: mid-ramp rungs used as informative marks. Every one of these already
         sat below 3:1 in the shipped Citrus light theme, so they are reported rather than
         enforced — see Check.carriedOver. --- */
  // run-band.tsx and library/mini-run-dots.tsx: the EDITED status dot.
  carried("ochre-400 EDITED status dot on chrome", mode.ochre[400], mode.chrome);
  carried("ochre-400 EDITED status dot on sheet/card", mode.ochre[400], mode.sheet);
  // progress-panel.tsx: a past day with words written.
  carried("ochre-500 written-day dot on sheet/card", mode.ochre[500], mode.sheet);
  // page-gauge.tsx: the sweet-spot arc in its "warming" zone.
  carried("ochre-500 gauge arc on sheet/card", mode.ochre[500], mode.sheet);

  return checks;
}

/* ------------------------------------------------------------------ */
/*  Structural invariants                                              */
/* ------------------------------------------------------------------ */

/**
 * The ramps are ordered by role, not by lightness — but *within* one mode they still have to
 * run monotonically from "faintest against this ground" to "strongest ink", or a component
 * reaching for 200-then-800 gets an unpredictable pair. This is what makes the flip safe.
 */
function rampMonotonicity(mode: PaletteMode, name: "neutral" | "press" | "ochre"): string[] {
  const problems: string[] = [];
  const ramp = mode[name];
  const towardsLight = mode.scheme === "dark";
  let previous = luminance(parseHex(ramp[RAMP_STEPS[0] as RampStep]));
  for (const step of RAMP_STEPS.slice(1)) {
    const current = luminance(parseHex(ramp[step]));
    if (current > previous !== towardsLight) {
      problems.push(
        `${name}-${step} breaks the ramp: a ${mode.scheme} ramp runs ${
          towardsLight ? "dark to light" : "light to dark"
        }, and this rung goes the other way.`,
      );
    }
    previous = current;
  }
  return problems;
}

/**
 * Chrome recedes, the desk sits between, the page is the most present surface. That
 * relationship — not the raw values — is what a mode has to preserve. See CLAUDE.md,
 * "Three grounds, and a page".
 */
function groundOrder(mode: PaletteMode): string[] {
  const l = (c: string) => luminance(parseHex(c));
  const problems: string[] = [];
  // Note this is *not* mirrored between modes. The page is the brightest surface and chrome
  // the dimmest in both, because "lit" is not a relative claim — a dark mode that made the
  // panels the brightest thing on screen would be an inversion, not a design.
  if (l(mode.background) <= l(mode.chrome)) {
    problems.push("--background must sit forward of --chrome: panels recede, the desk does not.");
  }
  if (l(mode.sheet) <= l(mode.background)) {
    problems.push("--sheet must sit forward of --background, or the page does not read as lit.");
  }
  return problems;
}

/* ------------------------------------------------------------------ */
/*  Run                                                                */
/* ------------------------------------------------------------------ */

const CSS_PATH = resolve(import.meta.dirname, "..", "src", "app", "palettes.css");

let failures = 0;
let checked = 0;
const carriedOver = new Map<string, number[]>();

for (const palette of PALETTE_LIST) {
  for (const scheme of ["light", "dark"] as const) {
    const mode = palette[scheme];
    const label = `${palette.label} ${scheme}`;
    const problems: string[] = [
      ...groundOrder(mode),
      ...rampMonotonicity(mode, "neutral"),
      ...rampMonotonicity(mode, "press"),
      ...rampMonotonicity(mode, "ochre"),
    ];

    /* The base alias has to be the rung the whole model claims it is. */
    if (paletteVars(mode).get("--press") !== mode.press[BASE_STEP]) {
      problems.push("--press is not the ramp's base rung.");
    }

    let worst = { ratio: Number.POSITIVE_INFINITY, where: "" };
    for (const check of checksFor(mode)) {
      const ratio = contrast(check.fg, check.bg);
      if (check.carriedOver) {
        const ratios = carriedOver.get(check.where) ?? [];
        ratios.push(ratio);
        carriedOver.set(check.where, ratios);
        continue;
      }
      checked += 1;
      if (ratio < check.min) {
        problems.push(`${check.where} — ${ratio.toFixed(2)}:1, needs ${check.min}:1`);
      }
      // Only text pairings are interesting as a "worst case" figure; a 3:1 boundary check
      // sitting at 3.2 is not a near miss, it is the design.
      if (check.min >= 4.5 && ratio < worst.ratio) worst = { ratio, where: check.where };
    }

    if (problems.length > 0) {
      failures += problems.length;
      console.log(`\n  ${label} — ${problems.length} problem${problems.length === 1 ? "" : "s"}`);
      for (const problem of problems) console.log(`    x ${problem}`);
    } else {
      console.log(
        `  ${label.padEnd(18)} ok   worst text pairing ${worst.ratio.toFixed(2)}:1  (${worst.where})`,
      );
    }
  }
}

/* The generated stylesheet has to be the one this data produces, or the audit is auditing
   something the browser never sees. */
let cssStale = false;
try {
  if (readFileSync(CSS_PATH, "utf8") !== renderPaletteCss()) {
    cssStale = true;
    console.log("\n  x src/app/palettes.css is out of date. Run: npm run theme:build");
  }
} catch {
  cssStale = true;
  console.log("\n  x src/app/palettes.css is missing. Run: npm run theme:build");
}

if (carriedOver.size > 0) {
  console.log(
    "\n  Carried over from the light theme — mid-ramp rungs used as informative marks, below the\n" +
      "  3:1 floor for a graphical object in the shipped Citrus light theme too. Which rung a\n" +
      "  status dot uses is a component decision, so these are reported, not enforced:",
  );
  for (const [where, ratios] of carriedOver) {
    const lo = Math.min(...ratios);
    const hi = Math.max(...ratios);
    console.log(`    - ${where.padEnd(44)} ${lo.toFixed(2)}:1 – ${hi.toFixed(2)}:1 across all palettes`);
  }
}

console.log(
  `\n  ${PALETTE_LIST.length} palettes x 2 modes, ${checked} pairings enforced.` +
    (failures === 0 && !cssStale ? "  All clear." : ""),
);

if (failures > 0 || cssStale) process.exit(1);
