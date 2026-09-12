/**
 * Checks that the Stripe configuration in the environment agrees with itself, and with what
 * this app advertises.
 *
 * Run: node node_modules/tsx/dist/cli.mjs scripts/stripe-check.ts
 *
 * ── Why this exists ───────────────────────────────────────────────────────────
 *
 * Live checkout broke once with `No such price`, and nothing caught it until someone tried to
 * pay and a server log was read by hand. The cause was mundane — a secret key in one Stripe
 * mode and price ids from the other — and every symptom before that point looked healthy: the
 * build passed, the page rendered, the route guarded correctly, the form mounted. **Stripe's
 * two modes are separate ledgers, and an id from one is simply absent in the other.**
 *
 * So this is the check that would have failed first. It is the same job `theme:check` does for
 * contrast and `legal:check` does for cross-references: assert that two things which must agree
 * actually do, at a moment when fixing it is cheap.
 *
 * ── What it will not do ───────────────────────────────────────────────────────
 *
 * **It never prints a secret.** Keys are reported by mode and nothing else; the values are read,
 * used against the API, and never echoed. A check you cannot paste into a chat or a CI log is
 * a check nobody runs.
 *
 * **It is not part of `npm run build`.** It needs the network and a real key, and a build that
 * fails because Stripe is unreachable would be a worse problem than the one this prevents.
 * `legal:check` runs in the build because it is offline and deterministic; this is not.
 *
 * **No key is not a failure.** Running with no `STRIPE_SECRET_KEY` is a supported state — the
 * app falls back to switching the plan directly so every gate can be exercised without a Stripe
 * account — so this reports that and exits clean.
 */

import { priceCents } from "../src/lib/billing/plans";
import { activePromo, LAUNCH_PROMO } from "../src/lib/billing/promo";

try {
  process.loadEnvFile(".env");
} catch {
  // No .env — the environment may still carry the variables, which is the CI case.
}

const API = "https://api.stripe.com/v1";

const failures: string[] = [];
const warnings: string[] = [];
const notes: string[] = [];

/* --------------------------------------------------------------------------- the keys --- */

const secret = process.env.STRIPE_SECRET_KEY;
const publishable = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

function modeOf(key: string | undefined, live: string, test: string): "live" | "test" | null {
  if (!key) return null;
  if (key.startsWith(live)) return "live";
  if (key.startsWith(test)) return "test";
  return null;
}

const secretMode = modeOf(secret, "sk_live_", "sk_test_");
const publishableMode = modeOf(publishable, "pk_live_", "pk_test_");

if (!secret) {
  console.log(
    "Stripe is not configured (no STRIPE_SECRET_KEY), so there is nothing to check.\n" +
      "That is a supported state: the upgrade path switches the plan directly instead, and is\n" +
      "refused in production.",
  );
  process.exit(0);
}

if (!secretMode) {
  failures.push("STRIPE_SECRET_KEY does not start with sk_test_ or sk_live_ — it is not a secret key.");
}
if (!publishable) {
  failures.push("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not set, so the payment form cannot load.");
} else if (!publishableMode) {
  failures.push("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY does not start with pk_test_ or pk_live_.");
} else if (secretMode && publishableMode !== secretMode) {
  // Worth its own line because it fails later and more confusingly than a missing key: the
  // form mounts, the session is created, and confirmation is rejected.
  failures.push(
    `Key modes disagree — the secret key is ${secretMode} and the publishable key is ${publishableMode}. ` +
      `Both must be the same mode.`,
  );
}

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
if (!webhookSecret) {
  warnings.push("STRIPE_WEBHOOK_SECRET is not set, so every webhook will be rejected and no plan is ever granted.");
} else if (!webhookSecret.startsWith("whsec_")) {
  failures.push("STRIPE_WEBHOOK_SECRET does not start with whsec_.");
}

/* ------------------------------------------------------------------------------- api --- */

async function stripe(path: string): Promise<{ ok: boolean; body: Record<string, unknown> }> {
  const response = await fetch(API + path, { headers: { authorization: "Bearer " + secret } });
  return { ok: response.ok, body: (await response.json()) as Record<string, unknown> };
}

interface StripePrice {
  unit_amount?: number;
  currency?: string;
  currency_options?: Record<string, { unit_amount?: number }>;
  active?: boolean;
  recurring?: { interval?: string };
  product?: string;
  error?: { message?: string };
}

/*
 * Everything below talks to the API. It lives in a function because tsx compiles these
 * scripts as CJS, where top-level await is not available.
 */
async function main(): Promise<void> {
  /* ---------------------------------------------------------------------------- prices --- */

  const priceSlots = [
    { label: "STRIPE_PRICE_SERIAL_MONTHLY", id: process.env.STRIPE_PRICE_SERIAL_MONTHLY, interval: "month" as const, plan: "monthly" as const },
    { label: "STRIPE_PRICE_SERIAL_YEARLY", id: process.env.STRIPE_PRICE_SERIAL_YEARLY, interval: "year" as const, plan: "yearly" as const },
  ];

  const currencies = new Set<string>();

  for (const slot of priceSlots) {
    if (!slot.id) {
      failures.push(`${slot.label} is not set, so that billing interval cannot be sold.`);
      continue;
    }

    // currency_options is not returned unless asked for, and it is the whole point of the
    // multi-currency check below.
    const { ok, body } = await stripe("/prices/" + slot.id + "?expand[]=currency_options");
    const price = body as StripePrice;

    if (!ok) {
      // The whole reason this script exists. Name the mode, because "No such price" on its own
      // sends people looking for a typo rather than for the other ledger.
      failures.push(
        `${slot.label} does not exist in ${secretMode} mode — Stripe says: ${price.error?.message ?? "unknown error"}. ` +
          `Test and live are separate ledgers; a price created in one is absent from the other.`,
      );
      continue;
    }

    if (price.active === false) {
      failures.push(`${slot.label} resolves but is archived, so checkout will refuse it.`);
    }

    const expected = priceCents("SERIAL", slot.plan);
    if (price.unit_amount !== expected) {
      // plans.ts is what the pricing page and the refund policy both quote.
      failures.push(
        `${slot.label} charges ${price.unit_amount} cents, but plans.ts advertises ${expected}. ` +
          `The pricing page and the refund policy both quote plans.ts, so this is a price we state and do not charge.`,
      );
    }

    if (price.recurring?.interval !== slot.interval) {
      failures.push(
        `${slot.label} recurs every ${price.recurring?.interval ?? "(not recurring)"}, but that slot is the ${slot.interval}ly one.`,
      );
    }

    /*
     * Multi-currency prices are a Stripe feature the app has no idea about.
     *
     * `currency_options` lets one price charge a different amount per currency, and Checkout
     * picks by the customer's location. That is invisible to `plans.ts`, which holds a single
     * figure — so a Canadian writer can read "$6 a month" on the pricing page, tick a box
     * saying "Charged in US dollars", and be charged CAD 8.00. The page, the checkout
     * disclosure and the refund policy are then all wrong at once, for that customer only.
     *
     * Reported rather than fatal: it is a deliberate Stripe setting and might be intended. But
     * it cannot be *silent*, because the only place it shows up otherwise is a real receipt.
     */
    const options = price.currency_options ?? {};
    const extra = Object.keys(options).filter((code) => code !== price.currency);
    if (extra.length > 0) {
      warnings.push(
        `${slot.label} also charges ${extra
          .map((code) => `${((options[code].unit_amount ?? 0) / 100).toFixed(2)} ${code.toUpperCase()}`)
          .join(", ")} — plans.ts knows only ${((price.unit_amount ?? 0) / 100).toFixed(2)} ` +
          `${(price.currency ?? "").toUpperCase()}, and the checkout disclosure says the charge is in US dollars.`,
      );
    }

    if (price.currency) currencies.add(price.currency);

    notes.push(
      `${slot.label.replace("STRIPE_PRICE_SERIAL_", "").toLowerCase().padEnd(8)}` +
        `${((price.unit_amount ?? 0) / 100).toFixed(2)} ${(price.currency ?? "?").toUpperCase()} every ${price.recurring?.interval}`,
    );
  }

  if (currencies.size > 1) {
    failures.push(`The two prices are in different currencies (${[...currencies].join(", ")}).`);
  }

  /* --------------------------------------------------------------------------- webhook --- */

  /*
   * The check that would have caught the worst failure this app has had.
   *
   * A webhook registered at the site root instead of `/api/stripe/webhook` takes every payment
   * and grants nothing: Stripe posts the event to a page that does not handle it, the app never
   * learns the payment cleared, and the writer is billed while staying on the free plan. Every
   * other signal looks healthy — the session completes, the subscription is active, the money
   * arrives — so nothing surfaces it until someone says "I paid and nothing happened".
   */
  const endpoints = await stripe("/webhook_endpoints?limit=20");
  const list = (endpoints.body.data as Record<string, unknown>[] | undefined) ?? [];
  const WANT_PATH = "/api/stripe/webhook";
  const REQUIRED = [
    "checkout.session.completed",
    "customer.subscription.created",
    "customer.subscription.updated",
    "customer.subscription.deleted",
  ];

  const pointing = list.filter((e) => String(e.url ?? "").endsWith(WANT_PATH));

  if (list.length === 0) {
    failures.push(
      `No webhook endpoint is registered in ${secretMode} mode. Payments will be taken and no plan granted.`,
    );
  } else if (pointing.length === 0) {
    failures.push(
      `No webhook endpoint points at ${WANT_PATH} — found ${list
        .map((e) => String(e.url))
        .join(", ")}. Payments will be taken and no plan granted.`,
    );
  } else {
    for (const endpoint of pointing) {
      if (endpoint.status !== "enabled") {
        failures.push(`The webhook at ${String(endpoint.url)} is ${String(endpoint.status)}, not enabled.`);
      }
      const enabled = (endpoint.enabled_events as string[] | undefined) ?? [];
      const missing = enabled.includes("*") ? [] : REQUIRED.filter((event) => !enabled.includes(event));
      if (missing.length > 0) {
        failures.push(`The webhook at ${String(endpoint.url)} is not subscribed to: ${missing.join(", ")}.`);
      }
      notes.push("webhook  " + String(endpoint.url));
    }
  }

  /* ----------------------------------------------------------------------------- promo --- */

  /*
   * `promo.ts` describes the Stripe objects rather than being them, and says so. This is the
   * check that keeps the description honest — and it is only fatal while the offer is actually
   * running, because before it opens the objects may legitimately not exist yet.
   */
  const promoIsLive = activePromo() !== null;
  const escalate = (message: string) => (promoIsLive ? failures : warnings).push(message);

  const promoLookup = await stripe("/promotion_codes?code=" + encodeURIComponent(LAUNCH_PROMO.code) + "&limit=1");
  const promoList = (promoLookup.body.data as Record<string, unknown>[] | undefined) ?? [];
  const promo = promoList[0];

  if (!promo) {
    escalate(
      `promo.ts declares the code ${LAUNCH_PROMO.code}, but no such promotion code exists in ${secretMode} mode` +
        (promoIsLive ? " — and the pricing page is advertising it right now." : "."),
    );
  } else {
    if (promo.active !== true && promoIsLive) {
      failures.push(
        `${LAUNCH_PROMO.code} exists but is inactive, while promo.ts says the offer is open. ` +
          `A writer typing it is told the code is invalid.`,
      );
    }
    if (promo.active === true && !promoIsLive) {
      warnings.push(
        `${LAUNCH_PROMO.code} is active in Stripe, but promo.ts says the offer is not open, so nothing advertises it. ` +
          `Redeemable by anyone who knows the string.`,
      );
    }

    const expires = typeof promo.expires_at === "number" ? promo.expires_at * 1000 : null;
    const declared = Date.parse(LAUNCH_PROMO.closesAt);
    if (expires !== null && Math.abs(expires - declared) > 60_000) {
      escalate(
        `${LAUNCH_PROMO.code} expires ${new Date(expires).toISOString()} in Stripe, but promo.ts says ` +
          `${new Date(declared).toISOString()}. The page would advertise a window Stripe will not honour.`,
      );
    }

    const promotion = promo.promotion as { coupon?: { percent_off?: number } } | undefined;
    const percent = promotion?.coupon?.percent_off;
    if (typeof percent === "number" && percent !== LAUNCH_PROMO.percentOff) {
      escalate(
        `${LAUNCH_PROMO.code} takes ${percent}% off in Stripe, but promo.ts advertises ${LAUNCH_PROMO.percentOff}%.`,
      );
    }
  }

  /* ---------------------------------------------------------------------------- report --- */

  console.log(`\nStripe ${secretMode} mode` + (publishableMode ? ` (publishable key: ${publishableMode})` : ""));
  for (const note of notes) console.log("  " + note);
  console.log("  promotion " + LAUNCH_PROMO.code + (promoIsLive ? " — offer is open" : " — offer is not open yet"));

  if (warnings.length > 0) {
    console.log(`\n${warnings.length} warning${warnings.length === 1 ? "" : "s"}:`);
    for (const warning of warnings) console.log(`  ! ${warning}`);
  }

  if (failures.length > 0) {
    console.error(`\nStripe check failed — ${failures.length} problem${failures.length === 1 ? "" : "s"}:\n`);
    for (const failure of failures) console.error(`  ✗ ${failure}`);
    console.error("");
    process.exit(1);
  }

  console.log("\nStripe check passed — keys agree, every price resolves and matches plans.ts.");
}

void main();
