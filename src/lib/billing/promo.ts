import { priceCents, type BillingInterval } from "./plans";

/**
 * The launch discount, as the app describes it.
 *
 * ── What this file is, and is not ─────────────────────────────────────────────
 *
 * This is a *declaration*, not a source of truth. The discount itself lives in Stripe — a
 * coupon and a promotion code — and Stripe is what actually decides whether a code applies and
 * for how much. Nothing here can grant a penny.
 *
 * That makes it the same shape of risk `lib/billing/plans.ts` carries with prices, and it is
 * handled the same way: **the numbers are derived, never restated.** The percentage and the
 * code string are declared because Stripe has no cheap way to hand them to a page render; every
 * money figure is computed from `plans.ts`, so the page cannot advertise "$42" while the
 * checkout charges something else.
 *
 * If the Stripe objects change, this file has to change with them. STRIPE_INTEGRATION_TODO.md
 * carries the matching `curl` commands so the two are written down in one place.
 *
 * ── Why the window is here ────────────────────────────────────────────────────
 *
 * Stripe promotion codes carry an `expires_at` and nothing that says "activates on", so a code
 * that should not be redeemable yet has to be held inactive by hand. The app therefore cannot
 * ask Stripe "is the offer open?" — it has to know. `opensAt` mirrors the moment the code is
 * switched on and `closesAt` mirrors its `expires_at` exactly.
 *
 * **Call `activePromo()` on the server.** Both surfaces that use it are `force-dynamic` server
 * components, and that is deliberate: reading the clock during a client render disagrees with
 * what the server rendered and breaks hydration for the whole page — the same failure the
 * Library's own "Wednesday evening" kicker hit once already.
 */

export interface LaunchPromo {
  /** The promotion code as a writer types it. Uppercase, because Stripe's is. */
  code: string;
  /** Mirrors the Stripe coupon's `percent_off`. */
  percentOff: number;
  /** When the code is switched on in Stripe. */
  opensAt: string;
  /** Mirrors the promotion code's `expires_at`, to the second. */
  closesAt: string;
  /** Mirrors `restrictions.first_time_transaction`. */
  newCustomersOnly: boolean;
}

/**
 * 12 September – 31 December 2026, Montreal time.
 *
 * The two offsets differ on purpose: the window opens in EDT (UTC−4) and closes in EST (UTC−5),
 * because North American DST ends on 1 November.
 *
 * `opensAt` is in the past, so the offer is running. That is the deliberate shape for a launch
 * rather than a dated campaign — there is nothing to switch on, and the only date that still has
 * to be honoured is the closing one, which `expires_at` on the Stripe code enforces by itself.
 *
 * The code names its own rate. `WELCOME30` gives 30%, and if that rate ever changes the string
 * has to change with it — a code reading WELCOME50 that takes 30% off is a number the customer
 * was shown and did not get, which is the kind of small dishonesty that costs more than it saves.
 */
export const LAUNCH_PROMO: LaunchPromo = {
  code: "WELCOME30",
  percentOff: 30,
  opensAt: "2026-09-12T04:00:00Z",
  closesAt: "2027-01-01T04:59:59Z",
  newCustomersOnly: true,
};

/** The promo if it is running at `now`, else null. */
export function activePromo(now: Date = new Date()): LaunchPromo | null {
  const opens = Date.parse(LAUNCH_PROMO.opensAt);
  const closes = Date.parse(LAUNCH_PROMO.closesAt);
  const at = now.getTime();
  return at >= opens && at <= closes ? LAUNCH_PROMO : null;
}

/**
 * What the first charge comes to with the discount applied.
 *
 * The Stripe coupon is restricted to the Serial *product*, not to one price, so it applies to
 * whichever interval is being bought — half off the first year, or half off the first month.
 * `duration: "once"` is what makes it the first charge only in both cases.
 *
 * Rounded the way Stripe rounds a percentage discount: to the nearest cent, on the total.
 */
export function firstChargeCents(promo: LaunchPromo, interval: BillingInterval): number {
  const full = priceCents("SERIAL", interval);
  return Math.max(full - Math.round((full * promo.percentOff) / 100), 0);
}
