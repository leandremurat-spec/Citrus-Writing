/**
 * What each plan can reach.
 *
 * Pure and client-safe on purpose: the pricing table, the upgrade prompts and the server-side
 * checks all read the *same* object, so a limit can never be advertised as one number and
 * enforced as another. Every gate in the app answers a question asked here — never an inline
 * `plan === "SERIAL"`.
 *
 * Two plans, where the design drew three. Studio's five seats are collaboration the app has
 * no model for — shared novels, per-seat permissions, comments — and selling a plan whose
 * headline feature does not exist is worse than not selling it. When seats are built, Studio
 * slots in beside these two without any call site changing shape.
 *
 * The split is the one the writer asked for: Drawer is the raw writing architecture — the
 * manuscript, the volume/arc organisers, the notes, and the chapter that comes out at the end
 * of it. Everything that measures a *schedule* rather than a sentence is Serial.
 */

export type PlanId = "DRAWER" | "SERIAL";

/** The four things an export can be scoped to. Mirrors the dialog's own segmented control. */
export type ExportScopeId = "chapter" | "arc" | "volume" | "novel";

export interface PlanCapabilities {
  /** Serials the writer may keep. `null` is unlimited. */
  maxNovels: number | null;
  /** Versions kept per chapter. `null` is unlimited. */
  snapshotsPerChapter: number | null;
  /** Which export scopes the dialog offers, and the action accepts. */
  exportScopes: readonly ExportScopeId[];
  /** The Buffer: release cadence, scheduling a chapter onto a date, runway and pace. */
  buffer: boolean;
  /** Ties between codex entries. Entries themselves are on every plan. */
  codexTies: boolean;
}

/*
 * There is deliberately no `advancedMetrics` flag here yet.
 *
 * "More advanced metrics" belong to Serial, and will — but the ones that exist today are the
 * runway, the pace projection and the release board, and every one of them lives behind
 * `buffer` already. A second flag that gates nothing is a promise the code cannot keep and a
 * branch nobody can test; it goes in the day the first metric it guards is written.
 *
 * The metrics that are *not* going behind a plan: the live word count, the sweet-spot gauge,
 * the daily goal and the streak. Those are writing feedback rather than schedule analysis,
 * the landing page sells them as part of the free workspace, and taking them away would make
 * Drawer worse at the one thing it is meant to be good at.
 */

export interface PlanDefinition {
  id: PlanId;
  name: string;
  /** The one-line positioning under the plan name on the pricing card. */
  tagline: string;
  /** Price in whole US cents, so nothing here is ever a float. `0` is free forever. */
  monthlyCents: number;
  /** Billed once a year. The per-month figure the card shows is derived, never stored twice. */
  yearlyCents: number;
  capabilities: PlanCapabilities;
}

export const PLANS: Record<PlanId, PlanDefinition> = {
  DRAWER: {
    id: "DRAWER",
    name: "Drawer",
    tagline: "One story, taken seriously.",
    monthlyCents: 0,
    yearlyCents: 0,
    capabilities: {
      maxNovels: 1,
      snapshotsPerChapter: 20,
      exportScopes: ["chapter"],
      buffer: false,
      codexTies: false,
    },
  },
  SERIAL: {
    id: "SERIAL",
    name: "Serial",
    tagline: "For anyone posting on a schedule.",
    // $9 monthly, $84 yearly — $7 a month, which is the figure the pricing design puts in
    // 44px type. The design's badge said "two months free", which these numbers do not make
    // true ($108 − $84 is nearer two and a half); the badge states the saving in dollars
    // instead. Keeping the headline price and fixing the claim beats the other way round.
    monthlyCents: 900,
    yearlyCents: 8400,
    capabilities: {
      maxNovels: null,
      snapshotsPerChapter: null,
      exportScopes: ["chapter", "arc", "volume", "novel"],
      buffer: true,
      codexTies: true,
    },
  },
};

export const PLAN_ORDER: readonly PlanId[] = ["DRAWER", "SERIAL"];

export type BillingInterval = "monthly" | "yearly";

export function capabilitiesFor(plan: PlanId): PlanCapabilities {
  return PLANS[plan].capabilities;
}

export function priceCents(plan: PlanId, interval: BillingInterval): number {
  return interval === "yearly" ? PLANS[plan].yearlyCents : PLANS[plan].monthlyCents;
}

/** What a plan costs per month on a given interval — the number the pricing card shows. */
export function perMonthCents(plan: PlanId, interval: BillingInterval): number {
  const cents = priceCents(plan, interval);
  return interval === "yearly" ? Math.round(cents / 12) : cents;
}

/** What a year on the monthly plan costs over a year paid up front. */
export function yearlySavingCents(plan: PlanId): number {
  return Math.max(0, PLANS[plan].monthlyCents * 12 - PLANS[plan].yearlyCents);
}

/** "$7", "$8.40", "Free" — whole dollars lose the ".00", because most of these are whole. */
export function formatPrice(cents: number): string {
  if (cents === 0) return "Free";
  const dollars = cents / 100;
  return `$${Number.isInteger(dollars) ? dollars : dollars.toFixed(2)}`;
}

export function planAllowsScope(plan: PlanId, scope: ExportScopeId): boolean {
  return capabilitiesFor(plan).exportScopes.includes(scope);
}

/**
 * Whether a writer on `plan` may add one more serial, given how many they have.
 *
 * Phrased as "may add" rather than "is over the limit" because the two differ for someone who
 * downgraded: a Drawer account holding three novels from a Serial subscription keeps all
 * three — nothing is deleted, which is what the pricing FAQ promises — it simply cannot make
 * a fourth.
 */
export function canCreateNovel(plan: PlanId, currentCount: number): boolean {
  const max = capabilitiesFor(plan).maxNovels;
  return max === null || currentCount < max;
}
