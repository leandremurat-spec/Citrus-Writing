# Stripe Integration — TODO

**Scenario A.** This app already had a working Stripe Checkout integration, so this pass applied
the Checkout Studio configuration to the **existing** call rather than building a new one. Two
files changed, and only parameter values inside them:

- [src/lib/billing/stripe.ts](src/lib/billing/stripe.ts) — the Checkout Session parameters
- [src/components/billing/checkout-form.tsx](src/components/billing/checkout-form.tsx) — the `appearance` object

No new routes, no new files, no refactoring. The webhook, the checkout API route, the
acknowledgement component and everything else were left untouched.

> **Note on the previous pass.** An earlier Studio sync against this repo produced a *hosted
> page* configuration, which did not fit this app's embedded form; that mismatch was documented
> at length and the app stayed embedded. This configuration is the embedded one
> (`custom_embedded_web_0002`), so that divergence is now closed — Studio and the code agree.

## Values to Replace

**None.** Every `sample_only` parameter already carries a real, non-placeholder value.

**Files containing placeholders:** none.

| Field | Current value | Status |
|---|---|---|
| `mode` | `"subscription"` | Real. Serial is a recurring plan, so `subscription` is correct and `payment_method_collection` is legitimately included (Stripe applies it in that mode only). Unchanged. |
| `line_items` | `[{ price: options.priceId, quantity: 1 }]` | Real. `priceId` resolves through `priceIdFor()` to the `STRIPE_PRICE_SERIAL_MONTHLY` / `STRIPE_PRICE_SERIAL_YEARLY` environment variables. Unchanged. |

## Configured Parameters

Configured in Checkout Studio and now set on the session.

**Files containing these parameters:**
- [src/lib/billing/stripe.ts](src/lib/billing/stripe.ts)

| Parameter | Value | Change this pass |
|---|---|---|
| `ui_mode` | `"form"` | Unchanged — and now matches Studio. See the SDK-version note below. |
| `billing_address_collection` | `"auto"` | Unchanged. |
| `phone_number_collection` | `{ enabled: false }` | Unchanged. |
| `automatic_tax` | `{ enabled: false }` | Unchanged. |
| `payment_method_collection` | `"always"` | Unchanged. |
| `submit_type` | `"auto"` | Unchanged. |
| `saved_payment_method_options` | `{ payment_method_save: "enabled" }` | Unchanged. |
| `integration_identifier` | `"custom_embedded_web_0002"` | **Changed** from `custom_embedded_web_0001`. |

### Removed, because they are no longer configured

Two parameters an earlier Studio sync had added are absent from this configuration and were
removed. One of them is a real behaviour change — check that you want it gone:

| Parameter | Was | What removing it does |
|---|---|---|
| `allow_promotion_codes` | `true` | **Customers can no longer enter a promotion code at checkout.** If you run launch discounts or referral codes, this is the line to put back. |
| `origin_context` | `"web"` | No practical effect here — `web` is the default for a browser session. |

(`tax_id_collection` was removed by the previous pass for the same reason and stays removed.
Nothing in this app ever read or displayed a collected tax ID.)

### Not touched, and deliberately

`mode`, `line_items`, `client_reference_id`, `customer` / `customer_email`, `subscription_data`
and `return_url` are identity and fulfilment plumbing — how the webhook finds the right account
after a payment clears — not Checkout Studio presentation settings. Removing them would leave a
completed payment with no account to grant the plan to, so they stayed exactly as they were.

## Client-side (Part 2)

The embedded form was already wired correctly. Only the `appearance` object changed, to the
values configured in Studio:

| Variable | Was | Now |
|---|---|---|
| `theme` | `stripe` | `flat` in light mode, `night` in dark — see below |
| `labels` | `auto` | `above` |
| `inputs` | `spaced` | `condensed` |
| `borderRadius` | `4px` | `24px` |
| `colorPrimary` | `#ed930a` | `#ee9013` |
| `colorSuccess` | `#a7d463` | `#00c853` |
| `fontFamily` | `Lora` | `"Segoe UI"` |
| `spacingUnit` | `4px` | `8px` |
| `fontSizeBase` | — | unchanged |
| `colorBackground`, `colorText`, `colorDanger` | set | **removed**, which is what makes both themes coherent |

This matches Stripe's generated `checkout.js` exactly. The HTML and JS in that snippet were
already implemented — `<div id="checkout-form">`, the `dahlia` script tag, the beta flag, the
`clientSecret` promise, `createForm({layout:'expanded'})`, `mount`, `loadActions` and the
`confirm` handler are all in [checkout-form.tsx](src/components/billing/checkout-form.tsx),
inside a React component with one addition Stripe's sample does not have: the `confirm` handler
refuses unless the withdrawal-right box is ticked.

Everything else the client checklist asks for was already in place and needed no edit:

- Stripe.js loaded from `https://js.stripe.com/dahlia/stripe.js`, never bundled (PCI).
- `Stripe(key, { betas: ["custom_checkout_payment_form_1"] })`.
- `/api/create-checkout-session` returns `{ client_secret }` as JSON, not a redirect.
- `stripe.initCheckoutFormSdk({ clientSecret, appearance })`, with the promise handed in unresolved.
- `<div id="checkout-form" />` as the mount target.
- `checkout.createForm({ layout: "expanded" })`, then `mount("#checkout-form")`, `loadActions()`, `form.on("confirm", ...)`.

### The appearance is per mode, and that is now settled

**Resolved.** The form is a Stripe-hosted iframe, so it cannot inherit the palette the way every
other surface does — the appearance has to be chosen before the SDK is built.
`appearanceForCurrentTheme()` reads `.dark` off `<html>` once at mount and picks the theme.

Everything except `theme` is identical between the two, so this is Studio's one configuration
with its theme swapped — not two designs that can drift apart.

**Why it had to be per mode.** `labels: "above"` puts the section headings *outside* the fields,
on the checkout card — `bg-neutral-100`, cream in light and near-black in dark. A single theme
therefore cannot serve both:

| | on the light card `#f9f4ed` | on the dark card `#2b241d` |
|---|---|---|
| `night` headings (near-white) | ~1.1:1 — invisible | ~15:1 — correct |
| `flat` headings (near-black) | ~12:1 — correct | ~1.2:1 — invisible |

Both pairings were rendered against the real grounds and screenshotted; the fix was verified the
same way, with `flat` on cream and `night` on near-black both reading correctly.

**Removing the colour overrides is what made this work.** Earlier revisions set
`colorBackground: "#ffffff"` and a `colorText` alongside `theme: "night"`, which fought the
theme instead of using it — white field backgrounds under a theme that expects dark ones. With
both removed, each theme supplies its own internally consistent palette and only the two brand
accents are overridden.

One deliberate limitation: the theme is read **once**, when the form is built, and does not
follow a later theme change. Rebuilding the SDK would unmount a payment form someone may be
halfway through, and losing a half-typed card number is worse than chrome that briefly does not
match.

### A note on `"Segoe UI"`

Unlike the `Be Vietnam Pro` this replaced, Segoe UI is a **system** font, so the Stripe iframe
can use it with no webfont request. That matters here beyond convenience: loading a family from
Google Fonts would have contradicted the privacy policy's claim that the typefaces are
self-hosted and no request leaves for Google. It renders natively on Windows and falls back
gracefully elsewhere, which is the right trade for a payment form.

### SDK version and `ui_mode`

The rule is `form` for Stripe SDK 21.0.0 and above, `custom` below it. **This project installs no
Stripe SDK at all** — `src/lib/billing/stripe.ts` is hand-rolled against the REST API with
`fetch` (see that file's own comment for why), so there is no `package.json` entry to read a
version from.

`form` is correct here regardless, and not merely by default: the browser side calls
`initCheckoutFormSdk` from the `dahlia` build of Stripe.js, which *is* the `form` path — `custom`
belongs to the older Custom Checkout SDK this app does not use. If you ever add the `stripe` npm
package for the server side, this value still does not change.

## Setup

### Environment variables

All five are already named consistently between [.env.example](.env.example) and the code. This
is Next.js, not Vite, so the browser-visible key takes the `NEXT_PUBLIC_` prefix and the
server-only ones must not.

| Variable | Where it is read | Notes |
|---|---|---|
| `STRIPE_SECRET_KEY` | `src/lib/billing/stripe.ts` | Server only. Its absence is a supported state — see below. |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `src/components/billing/checkout-form.tsx` | Browser. `pk_test_...` / `pk_live_...`. |
| `STRIPE_WEBHOOK_SECRET` | `src/lib/billing/stripe.ts` (`verifyWebhook`) | `whsec_...`. Without it every webhook is rejected. |
| `STRIPE_PRICE_SERIAL_MONTHLY` | `priceIdFor("monthly")` | `price_...` from the Dashboard. |
| `STRIPE_PRICE_SERIAL_YEARLY` | `priceIdFor("yearly")` | `price_...` from the Dashboard. |

There is no `DOMAIN` variable: the return URL is built from the request's own
`x-forwarded-host` / `host` headers in the checkout route.

**With no `STRIPE_SECRET_KEY`, upgrading switches the plan directly and says so**, so every plan
gate can be exercised end to end before a Stripe account exists. That fallback is refused in
production, so a deploy missing its keys cannot quietly give the paid plan away.

### Dependencies

None to install. No `stripe` package server-side (REST over `fetch`); no `@stripe/stripe-js`
client-side (loaded from `js.stripe.com` by `<Script>`, which is the PCI-required form).

### Webhook

Point a Stripe webhook endpoint at `/api/stripe/webhook`. Locally:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

**Subscribe the endpoint to these four**, which are the ones the code acts on:

| Event | What it does here |
|---|---|
| `checkout.session.completed` | First payment — fetches the subscription and grants Serial. |
| `customer.subscription.created` | Same, by the other route Stripe can take. |
| `customer.subscription.updated` | Renewal, cancellation-at-period-end, and `past_due`. |
| `customer.subscription.deleted` | Subscription ended — drops to Drawer. |

Everything else is acknowledged with a 200 and ignored, deliberately: returning an error for an
unhandled type would make Stripe retry it forever.

**On Stripe's two other "recommended" events, `invoice.paid` and `invoice.payment_failed`** —
they are not handled, and adding them today would be dead code. Every state change they signal
already arrives through `customer.subscription.updated`:

- a renewal that succeeds advances the subscription's period, which updates `planRenewsAt`;
- a renewal that fails moves the subscription to `past_due`, which sets `PAST_DUE` — and
  deliberately *keeps* the plan, because Stripe retries a failed card for days.

The invoice events become worth handling the day this app sends a receipt or a dunning email.
It sends neither right now — the only mail it sends at all is the password reset. Subscribing to
them in the Dashboard is harmless either way; writing handlers that do nothing is not.

`payment_intent.succeeded` and `setup_intent.succeeded` are lower-level still and are covered by
the same reasoning.

## How it works

1. A writer presses upgrade, and `/checkout` renders `CheckoutForm`.
2. The form POSTs `/api/create-checkout-session` with the billing interval. That route
   re-checks the session and the plan (it is reachable directly, so a hidden button is not a
   control), then calls `createCheckoutSession()`.
3. Stripe returns a `client_secret`, which comes back as JSON — never in a URL or a redirect —
   and is handed to `initCheckoutFormSdk`.
4. The form mounts in a Stripe-hosted iframe. Card data never touches this app.
5. On `confirm`, the handler refuses unless the EU/UK withdrawal-right acknowledgement is
   ticked (read from a ref, not state — the handler is registered once), then calls
   `actions.confirm({ formConfirmEvent })`.
6. **The webhook grants the plan; the browser never does.** `?upgraded=1` on the return URL only
   makes the account page say thank you. `/api/stripe/webhook` verifies the signature over the
   raw bytes, then sets the account to whatever state the *subscription* is in — handlers are
   idempotent because delivery is at-least-once and out of order.

## Testing

Use test-mode keys (`sk_test_...` / `pk_test_...`) and these numbers with any future expiry, any
CVC, and any postcode:

| Card | Result |
|---|---|
| `4242 4242 4242 4242` | Succeeds |
| `4000 0025 0000 3155` | Requires 3D Secure authentication |
| `4000 0000 0000 9995` | Declined — insufficient funds |
| `4000 0000 0000 0002` | Declined — generic |
| `4000 0000 0000 0341` | Attaches, then fails when charged (exercises the past-due path) |

Worth exercising specifically, because they are this app's own rules rather than Stripe's:

- Pay **without** ticking the acknowledgement — the confirmation must be refused, in-form.
- Let a renewal fail (`4000 0000 0000 0341`) — the account must **keep** the Serial plan on
  `PAST_DUE`, since Stripe retries for days and locking someone out of their manuscript on the
  first retry is the worse failure.
- Cancel, then check that a downgraded writer keeps every serial they already have and simply
  cannot create a new one.

## The launch discount

A 50% welcome code on the annual plan: **$84 → $42 for the first year**, then $84 a year after
that. New customers only, redeemable for six months.

### What had to be built

The embedded form is not hosted Checkout — it renders payment fields and nothing else, so there
is no promotion-code box to switch on. Verified against the live SDK rather than assumed:
`loadActions()` returns `applyPromotionCode`, `removePromotionCode` and `getSession`, so the
mechanism exists but the **UI is ours to build**.

| Change | Where |
|---|---|
| `allow_promotion_codes: true` on the session | [lib/billing/stripe.ts](src/lib/billing/stripe.ts) — without it `applyPromotionCode` is refused |
| Code field, Apply/Remove, error surface | [checkout-form.tsx](src/components/billing/checkout-form.tsx) |
| The discount disclosed in the pre-purchase block | [checkout-acknowledgement.tsx](src/components/billing/checkout-acknowledgement.tsx) |

Proven end to end in test mode before the UI was written:

```
before →  subtotal $84.00   discount  $0.00
apply  →  applyPromotionCode("WELCOME50") → type: "success"
after  →  subtotal $84.00   discount $42.00
```

### The disclosure is not optional

The acknowledgement block stated "**$84.00 every year**". With a code applied that becomes a
false statement at the moment of sale — the writer is charged $42. An introductory price that
converts to a higher recurring one is exactly the case US auto-renewal statutes (California's
ARL most explicitly) require to be disclosed clearly and conspicuously *before* the order, and
the UK/EU pre-contract rules ask the same of the total price.

So with a code applied the block now reads "**$42.00 for your first year**, then $84.00 every
year", and the renewal row adds that the discount covers the first year only. This is why the
promotion field and the disclosure had to ship together rather than one then the other.

### Live now, to 31 December 2026

**`WELCOME30` — 30% off the first charge, new customers only.**

| | first charge | then |
|---|---|---|
| Yearly | **$33.60** | $48 a year |
| Monthly | **$4.20** | $6 a month |

The live objects, created 12 September 2026:

| | |
|---|---|
| Coupon | `JwTmRcJ6` — 30% off, `duration: once`, scoped to `prod_VF8FUDY5Tfq5LG` |
| Promotion code | `WELCOME30` — active, `first_time_transaction`, expires 31 Dec 2026 |

`expires_at` is `1798779599` — 31 December 23:59:59 Montreal. Note the offsets differ across the
window: it opened in EDT (UTC−4) and closes in EST (UTC−5), because DST ends on 1 November.

**The code names its own rate.** If the 30% ever changes, the string changes with it: a code
reading WELCOME50 that takes 30% off is a number the customer was shown and did not get.

**Stripe promotion codes have no start date** — only `expires_at`. That does not matter here
because the offer opened immediately, and the closing enforces itself. It would matter for a
dated campaign, which would have to be created inactive and switched on by hand.

**Order matters when opening one.** The Stripe objects come first, then `promo.ts`. Opening the
window while the code does not exist puts a code on the pricing page that Stripe rejects —
`stripe:check` treats exactly that as fatal rather than a warning, and blocked this change until
the coupon existed.

### Creating it in live mode

With a live `sk_live_` key. The coupon first:

```bash
curl https://api.stripe.com/v1/coupons -u "$STRIPE_SECRET_KEY:"   -d name="Welcome 50% (launch)"   -d percent_off=50   -d duration=once   -d "applies_to[products][0]=<live Serial product id>"   -d redeem_by=1798779599
```

Then the code, with `active` set to whichever approach you picked above:

```bash
curl https://api.stripe.com/v1/promotion_codes -u "$STRIPE_SECRET_KEY:"   -d "promotion[type]=coupon"   -d "promotion[coupon]=<coupon id from above>"   -d code=WELCOME50   -d "restrictions[first_time_transaction]=true"   -d expires_at=1798779599   -d active=false
```

`1798779599` is 31 December 2026, 23:59:59 Montreal. Note the coupon's `redeem_by` is set to the
same instant here rather than March — in live mode there is no reason for the backstop to outlast
the promotion.

### How a writer finds out about it

[`lib/billing/promo.ts`](src/lib/billing/promo.ts) is the app's one declaration of the offer —
the code, the percentage and the window. It is a *description* of the Stripe objects, not a
source of truth: Stripe decides what applies. So the same rule `plans.ts` follows holds here,
**every money figure is derived, never restated**. The page computes $42 from `priceCents` and
the percentage rather than carrying a hard-coded number that could drift from the coupon.

Two surfaces, both gated on the window:

| Where | What it does |
|---|---|
| [Pricing](src/components/marketing/pricing-plans.tsx) | A line on the Serial card: "**$42 for your first year** with the code WELCOME50 at checkout." It follows the monthly/yearly switch, so picking Monthly reads $4.50 for your first month. |
| [Checkout](src/components/billing/checkout-form.tsx) | The discount field **starts filled in** with the code. The offer is ours, so making a writer transcribe it is friction we invented. It stays editable; clearing it is how you decline. |

Two decisions inside that:

- **It is only shown to someone who could redeem it.** The Stripe code is
  `first_time_transaction`, so an existing subscriber seeing it would be an offer refused at the
  till. The pricing line is hidden when the visitor already has a plan.
- **The window is resolved on the server**, in the two `force-dynamic` pages, and passed down as
  a prop. Reading the clock inside the client components would disagree with what the server
  rendered and break hydration for the whole page — the same failure the Library's own
  "Wednesday evening" kicker hit once already, and the reason that lesson is in CLAUDE.md.

Boundaries are tested: inactive one second before it opens, active on the instant, active on the
final second, inactive one second later.

### Kept current

- [x] Live coupon and code created.
- [x] Prices reconciled — `plans.ts` matches Stripe at $6 / $48.
- [ ] `STRIPE_PRICE_SERIAL_MONTHLY` must be `price_1UEyJ8RNAvYg7P922Q3YwX7q` in **both** `.env`
      and Railway. Consolidating the two products onto one created a new monthly price and
      archived the old; the old id is what both still carried.
- [ ] Run `npm run stripe:check` after any Stripe change. It has now caught two live breakages
      that nothing else would have: a price id from the wrong ledger, and this archived one.

