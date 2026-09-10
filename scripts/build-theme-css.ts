/**
 * Writes `src/app/palettes.css` from `src/lib/theme/palettes.ts`.
 *
 * `npm run theme:build` — and it also runs ahead of `npm run dev` and `npm run build`, so the
 * stylesheet cannot be stale in either. `npm run theme:check` fails if the file on disk is not
 * what this would produce, which is the safety net for anyone editing the CSS by hand.
 *
 * Why generate at all, when the alternative is one hand-written block per mode: ten blocks of
 * around sixty declarations is six hundred chances for one palette to quietly disagree with
 * the others about what `--popover` means, and nothing to catch it. Generating also means the
 * Settings swatches and the contrast audit read the same numbers the browser paints, rather
 * than a second copy that happens to match today.
 *
 * ---------------------------------------------------------------------------------------
 * Specificity, which is the whole reason the selectors look the way they do.
 * ---------------------------------------------------------------------------------------
 *
 * Two independent axes select a palette mode: next-themes writes `.dark` (or nothing) onto
 * <html>, and the palette store writes `data-palette`. The obvious selectors —
 * `:root` / `.dark` / `[data-palette="nord"]` — collide: a bare attribute selector and `.dark`
 * both weigh (0,1,0), so whichever came last in the file would win, and the light Nord block
 * would silently beat the dark Citrus one.
 *
 * Writing every light selector as `:root:not(.dark)…` and every dark one as `:root.dark…`
 * makes the two mutually exclusive, so source order and specificity stop mattering between
 * modes. Within a mode, the palette-specific selector carries one more attribute than the
 * default block and therefore wins on specificity alone, which is what makes the default
 * (no `data-palette` attribute at all, before the store's inline script runs) resolve to
 * Citrus rather than to nothing.
 */

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { DEFAULT_PALETTE, PALETTE_LIST, type Palette, type PaletteMode } from "../src/lib/theme/palettes";
import { paletteVars } from "../src/lib/theme/tokens";

const OUT_PATH = resolve(import.meta.dirname, "..", "src", "app", "palettes.css");

const HEADER = `/*
 * GENERATED FILE — do not edit.
 *
 * Source of truth: src/lib/theme/palettes.ts
 * Regenerate:      npm run theme:build
 * Verify:          npm run theme:check  (contrast audit, and fails if this file is stale)
 *
 * Every colour token in the app, for every palette, in both modes. globals.css imports this
 * and then never mentions a colour value again.
 *
 * The ramps are ordered by ROLE, not by lightness: 100 is always "the faintest presence of
 * this hue against the ground this mode sits on" and 900 is always "the strongest ink". In a
 * dark mode that means --neutral-100 is the darkest neutral. That is deliberate, and it is
 * what lets a component write ochre-800 text on an ochre-100 tag once and have it read
 * correctly in ten palettes. See the long note at the top of src/lib/theme/palettes.ts.
 */
`;

function block(selector: string, mode: PaletteMode, comment?: string): string {
  const lines: string[] = [];
  if (comment) lines.push(comment);
  lines.push(`${selector} {`);
  for (const [name, value] of paletteVars(mode)) lines.push(`  ${name}: ${value};`);
  lines.push("}");
  return lines.join("\n");
}

/** The selector pair for one palette. The default palette also answers to "no attribute". */
function selectors(palette: Palette, scheme: "light" | "dark"): string {
  const mode = scheme === "dark" ? ":root.dark" : ":root:not(.dark)";
  const attribute = `[data-palette="${palette.id}"]`;
  // The default palette needs the bare selector too, for the frame before the inline script
  // runs and for anyone who has never opened Settings. It is listed *after* the qualified
  // one so the file still reads "this palette, and also the default".
  return palette.id === DEFAULT_PALETTE ? `${mode}${attribute},\n${mode}` : `${mode}${attribute}`;
}

export function renderPaletteCss(): string {
  const parts: string[] = [HEADER];

  for (const palette of PALETTE_LIST) {
    parts.push(
      [
        "/* ------------------------------------------------------------------ */",
        `/*  ${palette.label} — ${palette.blurb}`.padEnd(69) + "*/",
        "/* ------------------------------------------------------------------ */",
      ].join("\n"),
    );
    parts.push(block(selectors(palette, "light"), palette.light));
    parts.push(block(selectors(palette, "dark"), palette.dark));
  }

  return parts.join("\n\n") + "\n";
}

// Only write when run directly, so theme-check.ts can import renderPaletteCss without the
// import itself rewriting the file it is about to compare against.
if (process.argv[1] && import.meta.filename === resolve(process.argv[1])) {
  writeFileSync(OUT_PATH, renderPaletteCss(), "utf8");
  console.log(`  wrote src/app/palettes.css — ${PALETTE_LIST.length} palettes x 2 modes`);
}
