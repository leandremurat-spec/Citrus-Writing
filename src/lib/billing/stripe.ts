import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Stripe, over `fetch`.
 *
 * Stripe because it is what comparable writing tools use and because Checkout plus the Billing
 * Portal means this app never touches a card number, never renders a payment form, and never
 * has to think about tax, SCA, dunning or receipts — all of which would otherwise be work, and
 * some of which would be *compliance* work.
 *
 * Hand-rolled against the REST API rather than through the `stripe` package, for the reason
 * that keeps recurring in this project: a dependency here is not free (Windows on ARM64, an
 * `&` in the folder name that breaks npm's shims — see CLAUDE.md). The surface actually used is
 * three POSTs and one HMAC, and the API is form-encoded, so `URLSearchParams` is the client.
 *
 * **Everything is optional.** With no `STRIPE_SECRET_KEY`, `isConfigured()` is false and the
 * upgrade path falls back to a direct plan switch (see `lib/actions/billing.ts`), so the plan
 * gates can be exercised end to end without an account. Nothing here throws at import time.
 */

const API = "https://api.stripe.com/v1";

/**
 * The pinned API version, sent on every call.
 *
 * Pinning means Stripe changing its default cannot silently reshape the webhook payloads this
 * app reads. The `custom_checkout_payment_form_preview=v1` beta flag is what makes
 * `ui_mode: "form"` — the embedded custom payment form — available on a Checkout Session; the
 * form cannot be created without it.
 *
 * Note this is a *preview* version. `periodEnd()` below already reads `current_period_end` from
 * either of the two places Stripe has put it across versions, which is the one bit of drift
 * this pin was protecting against.
 */
const API_VERSION = "2026-03-25.dahlia; custom_checkout_payment_form_preview=v1";

export function isConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

/** The price ids for the Serial plan, per interval. Both must exist for checkout to be offered. */
export function priceIdFor(interval: "monthly" | "yearly"): string | null {
  const id =
    interval === "yearly" ? process.env.STRIPE_PRICE_SERIAL_YEARLY : process.env.STRIPE_PRICE_SERIAL_MONTHLY;
  return id || null;
}

/** Flattens `{ a: { b: 1 }, c: [x] }` into Stripe's `a[b]=1&c[0]=x` form encoding. */
function encode(params: Record<string, unknown>, prefix = ""): URLSearchParams {
  const out = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    const name = prefix ? prefix + "[" + key + "]" : key;
    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        const nested = encode(item as Record<string, unknown>, name + "[" + index + "]");
        nested.forEach((v, k) => out.append(k, v));
      });
    } else if (typeof value === "object") {
      encode(value as Record<string, unknown>, name).forEach((v, k) => out.append(k, v));
    } else {
      out.append(name, String(value));
    }
  }
  return out;
}

async function call<T>(path: string, params: Record<string, unknown>): Promise<T> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Stripe is not configured.");

  const response = await fetch(API + path, {
    method: "POST",
    headers: {
      authorization: "Bearer " + key,
      "content-type": "application/x-www-form-urlencoded",
      "Stripe-Version": API_VERSION,
    },
    body: encode(params),
  });

  const body = (await response.json()) as { error?: { message?: string } };
  if (!response.ok) {
    throw new Error(body.error?.message ?? "Stripe rejected the request.");
  }
  return body as T;
}

export interface CheckoutSession {
  id: string;
  /** Embedded sessions return this instead of a `url`; the browser form is built from it. */
  client_secret: string;
}

/**
 * An **embedded** Checkout session for the Serial plan.
 *
 * The presentation parameters here were configured in Stripe's Checkout Studio and should be
 * changed there rather than by hand — `integration_identifier` is what ties this call back to
 * that configuration. `ui_mode: "form"` is what makes the session render as a payment form
 * inside this app (in a Stripe-hosted iframe) instead of redirecting to a page Stripe hosts,
 * which is why there is no longer a `success_url`/`cancel_url` pair and no `url` to send a
 * browser to.
 *
 * `client_reference_id` and the subscription metadata both carry the user id, so the webhook
 * can find the account again without trusting anything the browser reports — a browser
 * finishing the form is not proof that a payment cleared, and the webhook is. Those two, and
 * the customer reuse below, are deliberately kept: they are identity and fulfilment plumbing
 * rather than anything Checkout Studio configures, and dropping them would leave a completed
 * payment with no account to grant the plan to.
 */
export async function createCheckoutSession(options: {
  priceId: string;
  userId: string;
  email: string;
  customerId: string | null;
  returnUrl: string;
  /**
   * Which of the price's `currency_options` to charge in.
   *
   * Passed explicitly rather than left to Stripe, which would otherwise choose from the
   * customer's location at confirmation time — after the page has already quoted a figure. That
   * is how "$6 a month" became a CAD 8.00 charge. The app decides once and both sides follow.
   */
  currency: string;
}): Promise<CheckoutSession> {
  return call<CheckoutSession>("/checkout/sessions", {
    // ---------------------------------------------- configured in Checkout Studio
    //
    // Studio now configures this integration as the embedded form it already was, so `ui_mode`
    // no longer needs an argument made for it here. `payment_method_collection` stays because
    // the mode is `subscription`, which is the only mode Stripe applies it in.
    ui_mode: "form",
    billing_address_collection: "auto",
    phone_number_collection: { enabled: false },
    automatic_tax: { enabled: false },
    payment_method_collection: "always",
    submit_type: "auto",
    saved_payment_method_options: { payment_method_save: "enabled" },
    integration_identifier: "custom_embedded_web_0002",

    // Not a Checkout Studio setting — this is what lets a launch discount exist at all.
    // Without it `applyPromotionCode` is refused by the session, so the field in
    // `checkout-form.tsx` would have nothing to talk to.
    allow_promotion_codes: true,

    // ------------------------------------------------------- what is being sold
    mode: "subscription",
    currency: options.currency,
    line_items: [{ price: options.priceId, quantity: 1 }],

    // -------------------------------------------- identity, so the webhook can act
    client_reference_id: options.userId,
    // An existing customer is reused so a returning subscriber does not become a second one
    // with its own payment methods and its own invoice history.
    ...(options.customerId ? { customer: options.customerId } : { customer_email: options.email }),
    subscription_data: { metadata: { userId: options.userId } },
    // Where a redirect-based payment method (iDEAL, Bancontact, a 3DS challenge) comes back to.
    // Not a Studio setting, and not the old `success_url`: nothing is granted by arriving here.
    return_url: options.returnUrl,
  });
}

/** The Billing Portal: card changes, invoices and cancellation, all hosted by Stripe. */
export async function createPortalSession(customerId: string, returnUrl: string): Promise<{ url: string }> {
  return call<{ url: string }>("/billing_portal/sessions", { customer: customerId, return_url: returnUrl });
}

export interface StripeSubscription {
  id: string;
  status: string;
  customer: string;
  /** Unix seconds. Stripe moved this onto the item in 2025's API versions; both are read. */
  current_period_end?: number;
  cancel_at_period_end?: boolean;
  items?: { data?: { current_period_end?: number }[] };
  metadata?: { userId?: string };
}

export async function fetchSubscription(subscriptionId: string): Promise<StripeSubscription> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Stripe is not configured.");
  const response = await fetch(API + "/subscriptions/" + subscriptionId, {
    headers: { authorization: "Bearer " + key, "Stripe-Version": API_VERSION },
  });
  const body = (await response.json()) as StripeSubscription & { error?: { message?: string } };
  if (!response.ok) throw new Error(body.error?.message ?? "Stripe rejected the request.");
  return body;
}

/**
 * Verifies a webhook's `stripe-signature` header against the raw body.
 *
 * Without this, the webhook endpoint is an unauthenticated "make me a subscriber" button.
 * Three things have to hold: the signature is over `timestamp.body` exactly as received (which
 * is why the route reads `request.text()` and never `request.json()`), the comparison is
 * constant-time, and the timestamp is recent — otherwise a captured request stays replayable
 * forever.
 */
export function verifyWebhook(rawBody: string, header: string | null, toleranceSeconds = 300): boolean {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !header) return false;

  const parts = Object.fromEntries(
    header.split(",").map((piece) => {
      const index = piece.indexOf("=");
      return [piece.slice(0, index), piece.slice(index + 1)];
    }),
  );
  const timestamp = Number(parts.t);
  const signature = parts.v1;
  if (!Number.isFinite(timestamp) || !signature) return false;
  if (Math.abs(Date.now() / 1000 - timestamp) > toleranceSeconds) return false;

  const expected = createHmac("sha256", secret).update(parts.t + "." + rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Unix seconds → Date, taking the period end from wherever this API version puts it. */
export function periodEnd(subscription: StripeSubscription): Date | null {
  const seconds = subscription.current_period_end ?? subscription.items?.data?.[0]?.current_period_end;
  return seconds ? new Date(seconds * 1000) : null;
}
