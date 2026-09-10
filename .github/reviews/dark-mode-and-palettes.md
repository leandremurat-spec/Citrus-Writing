# Review brief — dark mode, and five palettes

Self-contained enough to hand to a reviewer who has not seen this codebase. Paste it into a PR
description, or attach it when asking Copilot to review the files listed below.

**What shipped:** the app had one palette (Citrus, light) and a theme toggle that switched a
`.dark` class onto a block identical to `:root` — so light/dark did nothing. It now has five
palettes, each in light and dark, selectable per device from Settings and from ⌘K.

**Verified:** `npm run typecheck`, `npm run lint`, `npm run build` and `npm run theme:check`
all pass. All ten modes were opened in the running app and screenshotted. There is no unit-test
suite in this repo; `theme:check` is the automated check for this feature.

---

## Files

### New

| File | What it is |
| --- | --- |
| `src/lib/theme/palettes.ts` | The source of truth. Ten palette modes as data, plus the swatch helper the UI draws from. |
| `src/lib/theme/tokens.ts` | The single derivation: one palette mode → the ~75 CSS custom properties the app already expected. |
| `src/app/palettes.css` | **Generated. Do not edit.** Every colour token, ten blocks. Checked in. |
| `scripts/build-theme-css.ts` | Writes `palettes.css`. Runs ahead of `dev` and `build`. |
| `scripts/theme-check.ts` | Contrast audit (590 pairings × ten modes) and a staleness check on the generated CSS. |
| `src/components/workspace/palette-store.ts` | The palette's client store — `useSyncExternalStore`, `localStorage`, `data-palette` on `<html>`. |
| `.github/copilot-instructions.md` | Repo conventions for any Copilot review here. |

### Changed

| File | Change |
| --- | --- |
| `src/app/globals.css` | The two hand-written palette blocks (~215 lines) replaced by an import of the generated file. Paper grain and the selection wash now read per-mode variables. |
| `src/components/workspace/theme-provider.tsx` | `defaultTheme` `"dark"` → `"system"`; new `PaletteScript` (pre-paint inline script). |
| `src/app/layout.tsx` | Mounts `PaletteScript` as the first thing in `<body>`. |
| `src/components/command-center/settings-panel.tsx` | New palette picker with live swatches; theme hint copy updated; `useMounted` extracted from `ThemeChoice` so both use it. |
| `src/components/workspace/command-palette.tsx` | A "Palette" group in ⌘K, one row per palette. |
| `package.json` | `theme:build` and `theme:check`; `dev` and `build` now run the generator first. |
| `CLAUDE.md`, `README.md` | New "Palettes and dark mode" section; stale claims about a single palette corrected. |

**No component was restyled.** The ~200 existing call sites (`text-ochre-800` on
`bg-ochre-100`, `border-neutral-600`, `bg-press-200`, …) are untouched — see decision 1.

---

## The decisions worth challenging

### 1. The ramps are ordered by *role*, not by lightness

`100` means "the faintest presence of this hue against the ground this mode sits on"; `900`
means "the strongest ink of it". In a light mode that runs light → dark; in a dark mode it runs
dark → light, **so `--neutral-100` is the darkest neutral in dark mode.**

This is the Radix Colors model, and it is the whole reason a dark mode was possible without
touching ~200 call sites: each of those states a *relationship* (dark ink on a faint tint; a
boundary that clears 3:1), and the relationship is what has to survive the mode change.

*Challenge it on:* whether the surprise is worth the saving; whether the invariant is
documented loudly enough (`palettes.ts` header, `globals.css`, `CLAUDE.md`, the Copilot
instructions); whether any existing call site actually depends on absolute lightness rather
than the relationship — I found none, but that is the failure mode to look for.

### 2. The CSS is generated rather than hand-written

Ten blocks × ~75 declarations is 750 chances for one palette to disagree with the others about
what `--popover` means, with nothing to catch it. Generating also means the Settings swatches
and the audit read the numbers the browser paints.

*Challenge it on:* the generated file is **checked in**, so it can go stale. The mitigations
are that `dev` and `build` both regenerate it first, and `theme:check` fails if the file on
disk is not what the data produces. Is checking it in right, or should it be gitignored and
built? (Checked in was chosen so a fresh clone and the Claude-app launch config —
`scripts/dev-server.mjs`, which bypasses `npm run dev` — both work without a build step.)

### 3. Selector specificity

Two axes select one block: `.dark` from next-themes, `data-palette` from the new store.
`[data-palette="nord"]` and `.dark` both weigh (0,1,0), so the naive selectors race on source
order and light Nord would beat dark Citrus. Every light block is written `:root:not(.dark)…`
and every dark one `:root.dark…`, making the modes mutually exclusive; within a mode the
qualified selector out-specifies the default block.

*Challenge it on:* correctness of that reasoning, and whether the unqualified default block
(Citrus, for the frame before the inline script runs) can ever beat a qualified one.

### 4. `defaultTheme` changed from `"dark"` to `"system"`

The `"dark"` dated from an older palette; through the entire Citrus era it pointed at a `.dark`
block identical to `:root`, so everyone saw light regardless. Now that the modes differ,
something has to decide.

*Challenge it on:* whether "system" is right, or whether the app should default to light —
which is what every current user is actually looking at today.

### 5. Four contrast failures are reported but not enforced

`theme:check` ends with a list of mid-ramp rungs used as informative marks: the `EDITED` status
dot is `ochre-400` (1.2–2.5:1 depending on palette), and the Progress panel's written-day dot
and the page gauge's "warming" arc are `ochre-500`. WCAG 1.4.11 wants 3:1 for a graphical
object that conveys meaning.

**Every one of these already failed in the shipped Citrus light theme.** They are component
decisions about the Run band's colour vocabulary — the app's signature element — and moving
them to `ochre-600` (which clears the floor in all ten palettes) changes how it looks. That
judgement was left to the owner rather than folded into a theming change.

*Challenge it on:* whether reporting-not-enforcing is the right call, or whether it just makes
a known failure easier to ignore.

### 6. One shipped colour changed

`--destructive` / `--proof` in Citrus light: `#b3392a` → `#9e3225`. It measured 4.44:1 against
`--chrome` and 3.89:1 as destructive-menu text on its own 10% wash. Everything else in Citrus
light is byte-identical to what shipped, except `--chart-3` and `--chart-4`, which were
duplicates of `--chart-1`/`--chart-2` and now point at the 500 rungs (no chart component
exists yet).

### 7. The audit is a hand-built table, not a DOM scan

`checksFor()` in `scripts/theme-check.ts` lists pairings read off the components' actual class
strings. It runs in about a second with no browser and covers ten palettes at once — but it can
go stale when a component introduces a pairing nobody adds a line for.

*Challenge it on:* whether any pairing in the app is missing from the table. That is the most
useful concrete thing a reviewer can do here.

---

## Smaller things to look at

- `PaletteScript` (`theme-provider.tsx`) is an inline `<script>` with
  `dangerouslySetInnerHTML`. Its content is built from `JSON.stringify` of module constants —
  no user input reaches it — but it is worth confirming.
- The palette store reads its initial value from the `data-palette` **attribute** rather than
  from `localStorage`, on the grounds that the inline script has already resolved and validated
  it and the store then cannot disagree with what is on screen. Is that sound?
- `PaletteDot` in `command-palette.tsx` takes `resolvedTheme` from the caller and can render
  before next-themes has mounted. The subtree only exists once the ⌘K dialog is open, which is
  client state, so there should be no server render to mismatch — worth a second opinion.
- Nord dark uses `nord0` (`#2e3440`) as the *manuscript page* and extends the desk and chrome
  darker than anything Nord publishes, because the page has to be the brightest surface. Is
  that a defensible reading of the palette, or a liberty?
- `Citrus dark` is a design, not an inversion; the three grounds keep their *relationship*
  (chrome recedes, desk between, page brightest) rather than their values. `theme:check`
  asserts the ordering.
- Gruvbox light's page (`#f9f5d7`) and desk (`#fbf1c7`) are very close in luminance, so the
  page barely lifts. Gruvbox publishes only those three creams. Acceptable, or worth deviating?

## How to run it

```bash
npm run theme:check
```

```bash
npm run typecheck && npm run lint && npm run build
```

Then in the app: Settings → Palette, and the theme row above it. ⌘K also lists all five.
