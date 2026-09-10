# Stripe integration — remaining steps

The embedded Checkout form is wired up end to end. What is left is pasting three keys and
running one command; everything else below is reference.

This app already had a working **hosted** Checkout integration (a redirect to a Stripe-hosted
page). Checkout Studio configured an **embedded** form, so the session now returns a
`client_secret` instead of a `url` and the form renders inside this app. That is what changed,
and it is why a page and a route handler had to be added rather than only parameters edited.

---

## Values to Replace

No placeholder values were left in the source. The three items below are **environment
variables that are not yet set** — they are commented out in `.env`.

**Files containing them:**

- [.env](.env) — the real file, gitignored
- [.env.example](.env.example) — the documented template

| Variable | Current value | What to set |
| --- | --- | --- |
| `STRIPE_SECRET_KEY` | *(unset)* | Secret key from [the Stripe API keys page](https://dashboard.stripe.com/test/apikeys). Starts `sk_test_`. Server-only — **must not** be given a `NEXT_PUBLIC_` prefix. |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | *(unset)* | Publishable key from the same page. Starts `pk_test_`. The `NEXT_PUBLIC_` prefix is required — Next only exposes prefixed variables to the browser, and the embedded form runs in the browser. |
| `STRIPE_WEBHOOK_SECRET` | *(unset)* | Printed by `stripe listen` (below). Starts `whsec_`. Without it the webhook rejects every delivery, so **a completed payment never grants the plan**. |

Run `npm run config:check` at any point to see which of these are still missing.

### Not placeholders — already real

Two parameters the Checkout Studio brief treats as samples already hold real values in this
codebase, so they were **kept** rather than overwritten:

| Parameter | Value here | Why it is already correct |
| --- | --- | --- |
| `mode` | `"subscription"` | The Serial plan is recurring (monthly and yearly prices), so `subscription` is the correct mode — not `payment`. |
| `line_items[].price` | `process.env.STRIPE_PRICE_SERIAL_MONTHLY` / `_YEARLY` | Both are set in `.env` to real test-mode price IDs in the "Ko-fi" Stripe account: `price_1UEB61I6pGdxTDYia3zGlX9F` ($9/mo) and `price_1UEB6II6pGdxTDYiIy8Jt6G3` ($84/yr), on product `prod_VEeOok1SAChI6U`. |

---

## Configured Parameters

Set from Checkout Studio. **Change these in Studio, not by hand** — `integration_identifier`
is what ties the call back to that configuration.

**File containing these parameters:**

- [src/lib/billing/stripe.ts](src/lib/billing/stripe.ts) — in `createCheckoutSession`

| Parameter | Value |
| --- | --- |
| `ui_mode` | `form` |
| `billing_address_collection` | `auto` |
| `phone_number_collection` | `{ enabled: false }` |
| `automatic_tax` | `{ enabled: false }` |
| `payment_method_collection` | `always` |
| `submit_type` | `auto` |
| `tax_id_collection` | `{ enabled: true, required: "never" }` |
| `saved_payment_method_options` | `{ payment_method_save: "enabled" }` |
| `integration_identifier` | `custom_embedded_web_0001` |

The API version is pinned to `2026-03-25.dahlia; custom_checkout_payment_form_preview=v1` in
the same file. The beta flag is what makes `ui_mode: "form"` available; the session cannot be
created without it.

### Parameters removed

Absent from the Checkout Studio configuration, so no longer sent:

- `success_url`, `cancel_url` — incompatible with an embedded session, which has no page to
  redirect to. Replaced by a single `return_url` (see below).
- `allow_promotion_codes` — promotion codes are no longer offered at checkout. Re-enable it in
  Studio if you want them back.

### Parameters deliberately kept

These are **not** Checkout Studio settings, and removing them would break fulfilment. Each is
commented in the source with the same reasoning:

| Parameter | Why it stays |
| --- | --- |
| `client_reference_id` | Carries the user id. The webhook uses it to find the account to grant the plan to. Without it a payment succeeds and nothing happens. |
| `subscription_data.metadata.userId` | The same id on the subscription itself, so renewals and cancellations can be attributed later. |
| `customer` / `customer_email` | Reuses an existing Stripe customer, so a returning subscriber does not become a second customer with a separate card and invoice history. |
| `return_url` | Where redirect-based payment methods (iDEAL, Bancontact, a 3-D Secure challenge) come back to. Points at `/account?upgraded=1`, which only shows a thank-you — it grants nothing. |

---

## Setup

### 1. Keys

Paste the three values from **Values to Replace** into `.env`. No dependencies to install —
Stripe is called over `fetch` (see the note in `src/lib/billing/stripe.ts` about why there is
no `stripe` package), and Stripe.js is loaded from Stripe's CDN rather than bundled.

### 2. The webhook

The webhook is what grants the plan. Run this in a second terminal while developing:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Paste the `whsec_…` it prints into `STRIPE_WEBHOOK_SECRET` and restart the dev server.

Subscribe the endpoint to: `checkout.session.completed`,
`customer.subscription.created`, `customer.subscription.updated`,
`customer.subscription.deleted`.

### 3. Check

```bash
npm run config:check
```

---

## Files

New:

```
src/app/checkout/page.tsx                      the page hosting the form
src/app/api/create-checkout-session/route.ts   mints the session, returns {client_secret}
src/components/billing/checkout-form.tsx       loads Stripe.js, mounts the form
```

Changed:

```
src/lib/billing/stripe.ts     session parameters, API version, returns client_secret
src/lib/actions/billing.ts    now points the browser at /checkout instead of at Stripe
.env / .env.example           the publishable key
scripts/config-check.ts       reports the publishable key too
```

---

## How it works

1. A writer presses **Upgrade to Serial** on `/pricing` or `/account`.
2. `startCheckout` (`src/lib/actions/billing.ts`) checks they are signed in and not already on
   Serial, then returns `/checkout?interval=yearly`. It no longer creates the session.
   *If no `STRIPE_SECRET_KEY` is set it switches the plan directly instead and says plainly
   that nothing was charged — that fallback is refused in production.*
3. `/checkout` renders, guarded: signed out redirects to sign-in, already-subscribed redirects
   to `/account`.
4. `CheckoutForm` loads Stripe.js from `https://js.stripe.com/dahlia/stripe.js`, then POSTs to
   `/api/create-checkout-session`.
5. That route **re-checks authorization** — it is reachable directly, and a hidden button is
   not a control — creates the session, and returns `{client_secret}`.
6. The SDK builds the form from that secret and mounts it into `#checkout-form`. Card fields
   live in a Stripe-hosted iframe, so no card data touches this app.
7. On confirm, the SDK's own `confirm` action runs.
8. **Stripe calls `/api/stripe/webhook`, and that is what sets the plan.** The browser never
   does. Signature verification is mandatory there; an unverified request is a 400.

---

## Testing

With `stripe listen` running, use any future expiry, any CVC, any postcode:

| Card | Result |
| --- | --- |
| `4242 4242 4242 4242` | Succeeds |
| `4000 0025 0000 3155` | Requires 3-D Secure authentication |
| `4000 0000 0000 9995` | Declined — insufficient funds |

Confirm the plan actually changed on `/account` afterwards, not just that the form succeeded.
If the payment goes through and the plan does not change, the webhook is the thing to look at.

---

## Three things worth knowing

- **`ui_mode` and the SDK version.** The Studio brief ties `ui_mode` to the installed Stripe
  SDK version (`form` at 21.0.0+, `custom` below). **This project has no Stripe SDK** — it
  calls the REST API directly — so there was no version to read and `form` was used, which is
  correct for the pinned API version above. If you ever add the `stripe` package, this pairing
  is the thing to re-check.
- **`submit_type: "auto"` on a subscription is untested here.** Stripe has historically
  restricted `submit_type` to `payment` mode. It is set as Studio specified, but no live call
  has been made (no secret key yet). If the first real checkout returns an error naming
  `submit_type`, remove it in Studio — `auto` is the default anyway.
- **The appearance asks for the Lora typeface**, but a font has to be loaded *into* the Stripe
  iframe to be used there, via a `fonts` option that the Studio snippet does not include. As
  it stands the form will fall back to a system face. If Lora matters, add
  `fonts: [{ cssSrc: "https://fonts.googleapis.com/css2?family=Lora" }]` alongside `appearance`
  in `src/components/billing/checkout-form.tsx`.

---

## Next steps

- Move to live mode: create the same product and prices in live mode, swap all three keys for
  their `sk_live_`/`pk_live_` counterparts, and register a real webhook endpoint. The price IDs
  are different in live mode — test-mode IDs will not work.
- Fulfilment beyond the plan flag (receipts, a welcome email) belongs in the webhook handler,
  not on the return page.

## Resources

- [Stripe docs](https://docs.stripe.com)
- [Stripe MCP](https://docs.stripe.com/mcp)
- [Stripe support](https://support.stripe.com)
