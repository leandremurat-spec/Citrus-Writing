/**
 * One palette mode → the CSS custom properties `globals.css` and every component already
 * expect. This is the only place that knows, for instance, that `--muted` is the neutral
 * ramp's 200 rung or that `--edge` is the hairline colour at 10%.
 *
 * Deriving rather than authoring these is the point. Ten hand-written blocks of ~60
 * declarations each is 600 chances for one palette to disagree with the others about what
 * `--popover` means, and no way to notice. Here a palette states its grounds, its three ramps
 * and its handful of per-mode judgements, and every other token follows by rule.
 *
 * Consumed by `scripts/build-theme-css.ts` (which writes `src/app/palettes.css`) and by
 * `scripts/theme-check.ts` (which audits the same values for contrast). Both read this, so the
 * audit can never be auditing something other than what ships.
 */

import { BASE_STEP, MUTED_STEP, RAMP_STEPS, SUBTLE_STEP, type PaletteMode } from "./palettes";

/** `color-mix` rather than an 8-digit hex, matching how these tokens were already written. */
function alpha(color: string, percent: number): string {
  return `color-mix(in srgb, ${color} ${percent}%, transparent)`;
}

/** The hairline weights, as they were in the hand-written palette. */
const HAIRLINE = {
  edge: 10,
  border: 14,
  divider: 14,
  sidebarBorder: 12,
  input: 20,
  scrollbar: 20,
  scrollbarHover: 32,
} as const;

/**
 * Ordered so the generated stylesheet reads like the block it replaced: grounds, then the
 * shadcn slots, then the brand ramps, then the mechanics. A `Map` because insertion order is
 * the contract here, and because the audit walks it by name.
 */
export function paletteVars(mode: PaletteMode): Map<string, string> {
  const vars = new Map<string, string>();
  const set = (name: string, value: string) => vars.set(name, value);

  const neutral = mode.neutral;
  const press = mode.press;
  const ochre = mode.ochre;

  /* ---- The three grounds, and the page that sits in them ---- */
  set("--background", mode.background);
  set("--chrome", mode.chrome);
  set("--sheet", mode.sheet);
  set("--foreground", mode.foreground);

  /* ---- shadcn's slots, mapped onto this app's vocabulary ----
     `--card` is the sheet and `--popover` is the chrome because a card *is* a small page and a
     popover *is* a piece of chrome that happens to float. Keeping them as separate authored
     colours only invited them to drift. */
  set("--card", mode.sheet);
  set("--card-foreground", mode.foreground);
  set("--popover", mode.chrome);
  set("--popover-foreground", mode.foreground);

  set("--primary", press[BASE_STEP]);
  set("--primary-foreground", mode.onAccent);
  set("--secondary", neutral[MUTED_STEP]);
  set("--secondary-foreground", mode.foreground);
  set("--muted", neutral[MUTED_STEP]);
  set("--muted-foreground", neutral[SUBTLE_STEP]);
  /* The generic hover tint stays a quiet neutral, never the brand accent: a menu item under the
     pointer should lift, not turn solid terracotta. */
  set("--accent", neutral[MUTED_STEP]);
  set("--accent-foreground", mode.foreground);

  set("--destructive", mode.proof);

  set("--border", alpha(mode.hairline, HAIRLINE.border));
  set("--input", alpha(mode.hairline, HAIRLINE.input));
  set("--ring", press[BASE_STEP]);

  /* Unused today — no chart component exists — but shadcn's contract includes them, and a
     palette that filled them with a different hue every time would be a trap for whoever adds
     the first chart. Two brand hues at two strengths, then the neutral. */
  set("--chart-1", press[BASE_STEP]);
  set("--chart-2", ochre[BASE_STEP]);
  set("--chart-3", press[500]);
  set("--chart-4", ochre[500]);
  set("--chart-5", neutral[600]);

  set("--sidebar", mode.chrome);
  set("--sidebar-foreground", mode.foreground);
  set("--sidebar-primary", press[BASE_STEP]);
  set("--sidebar-primary-foreground", mode.onAccent);
  set("--sidebar-accent", neutral[MUTED_STEP]);
  set("--sidebar-accent-foreground", mode.foreground);
  set("--sidebar-border", alpha(mode.hairline, HAIRLINE.sidebarBorder));
  set("--sidebar-ring", press[BASE_STEP]);

  /* ---- The brand ramps ---- */
  set("--press", press[BASE_STEP]);
  set("--press-foreground", mode.onAccent);
  for (const step of RAMP_STEPS) set(`--press-${step}`, press[step]);

  set("--proof", mode.proof);
  set("--proof-foreground", mode.onProof);

  set("--ochre", ochre[BASE_STEP]);
  for (const step of RAMP_STEPS) set(`--ochre-${step}`, ochre[step]);

  /* Three aliases the app still names by their trade rather than by a rung. */
  set("--slate", neutral[600]);
  set("--ink", mode.foreground);
  set("--stock", neutral[100]);

  for (const step of RAMP_STEPS) set(`--neutral-${step}`, neutral[step]);

  /* ---- Elevation, hairlines, and the rest of the mechanics ---- */
  set("--ink-tint", mode.inkTint);
  set("--elev-key", mode.elevKey);
  set("--elev-ambient", mode.elevAmbient);
  set("--elev-edge", mode.elevEdge);

  set("--edge", alpha(mode.hairline, HAIRLINE.edge));
  set("--divider", alpha(mode.hairline, HAIRLINE.divider));

  /* The dim text tier: a colour, not an opacity. Same rung as --muted-foreground, named
     separately because the app reaches for it by intent rather than by shadcn slot. */
  set("--subtle", neutral[SUBTLE_STEP]);

  set("--scrollbar", alpha(mode.hairline, HAIRLINE.scrollbar));
  set("--scrollbar-hover", alpha(mode.hairline, HAIRLINE.scrollbarHover));

  /* Paper grain and the selection wash: per mode because a light accent over a dark ground
     behaves nothing like a dark one over cream. See PaletteMode's own notes. */
  set("--grain-blend", mode.grainBlend);
  set("--grain-strength", String(mode.grainStrength));
  set("--selection-mix", `${mode.selectionMix}%`);

  set("color-scheme", mode.scheme);

  return vars;
}

/**
 * The token names whose values are always a bare colour — everything the contrast audit can
 * parse. `--border` and friends are excluded because they are deliberately translucent
 * `color-mix()` values with no single resolved colour.
 */
export function isOpaqueColorToken(value: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(value);
}
