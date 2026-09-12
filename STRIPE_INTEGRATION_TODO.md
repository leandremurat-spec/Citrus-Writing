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

### The window: 1 October – 31 December 2026

Three months, Montreal time. `expires_at` is set to **2027-01-01T04:59:59Z**, which is
31 December 23:59:59 EST. The offset is not a typo — the window opens in EDT (UTC−4) and closes
in EST (UTC−5), because North American DST ends on 1 November.

**Stripe promotion codes have no start date.** There is an `expires_at` and nothing that says
"activates on". So the code is created with `active: false` and has to be switched on when the
promotion opens. Verified rather than assumed — applying it in its current state returns
`type: "error"`, "This promotion code is invalid.", and the discount stays at $0.00. Nobody can
redeem it early.

That leaves two ways to run it, and the second is less to remember:

1. **Pre-stage it** (what test mode is doing now): create it inactive, then flip `active=true` on
   1 October. One switch to forget.
2. **Create it on the day**, already active with the same `expires_at`. Nothing to flip, nothing
   to remember, and the expiry still closes it on its own.

Either way the *closing* is automatic. Only the opening needs a person.

### The Stripe objects

**Test mode only** — live mode is a separate ledger and needs its own copies.

| | |
|---|---|
| Coupon | `fDk6D8Ol` — 50% off, `duration: once`, restricted to the Serial product |
| Promotion code | `WELCOME50` — `first_time_transaction: true`, inactive, expires 31 Dec 2026 |

`duration: "once"` means the first *invoice*, which on an annual plan is the first year. On the
monthly plan the same coupon would discount one month, which is why it is restricted to the
product rather than left open.

**The API shape has changed and the docs you find first will be wrong.** On this account's
version (`2026-08-26.dahlia`) `POST /v1/promotion_codes` rejects the long-standing `coupon`
parameter outright. It now takes `promotion[type]=coupon` plus `promotion[coupon]`.

Three more things learned the hard way, all of which will cost an hour if rediscovered:

- **`expires_at` is create-only** on a promotion code. To change a window you deactivate and
  recreate.
- **A code string can be reused** once the old holder is deactivated, so `WELCOME50` survives a
  recreate.
- **A promotion code's `expires_at` may not be later than its coupon's `redeem_by`.** The coupon
  above runs to March 2027, comfortably past the window, so it is a harmless backstop.

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

### Before the code goes out

- [ ] Create both objects in **live** mode.
- [ ] Put 1 October in a calendar if you pre-stage it. An inactive code fails silently from the
      customer's side — they see "invalid", not "not yet".
- [ ] Decide whether the pricing page mentions the code during the window. Nothing surfaces it
      today; a writer has to be told it exists.
- [ ] If the code is advertised with an end date, honour that date. A stated expiry is a
      representation to the consumer, and Quebec's CPA is strict about it.

## Going live

Everything below is configuration and account setup — **no further code changes are required**
to take payments. Verified locally before writing this: `npm run build`, `typecheck`, `lint`,
`theme:check` (624 pairings), `export:check` and `legal:check` all pass.

### 0. The domain — settled, and already live

**`citruswritinglab.com`**, which is what
[`src/content/legal/details.ts`](src/content/legal/details.ts) already declares as `siteUrl`, so
the Terms, Privacy Policy and Refund Policy name the right service. No change needed.

It is already serving, through Cloudflare to Railway, on a valid Let's Encrypt certificate
(TLSv1.3, correct SANs) with an http → https 301 and no mixed content. Two gaps found while
checking, neither blocking a launch:

- **`www.citruswritinglab.com` does not resolve** — anyone typing `www.` gets a DNS failure
  rather than a redirect. Add the record.
- **No security headers at all** — no HSTS, CSP, `X-Frame-Options`, `X-Content-Type-Options` or
  `Referrer-Policy`. No browser calls this "not secure", but without HSTS the first request over
  http is interceptable, which is worth closing on a site taking card payments.

### 1. Activate the Stripe account

Live keys do not exist until the account is activated — business details, and a bank account for
payouts. The entity is Canadian (Montreal), so expect GST/QST questions; the refund policy
already states that prices are USD and that Canadian customers are charged tax.

### 2. Create the two live Prices

**Test price IDs do not work in live mode** — they are separate objects in a separate ledger.
Create a monthly and a yearly Price in live mode, and make the amounts match what
[`src/lib/billing/plans.ts`](src/lib/billing/plans.ts) advertises. The pricing page *and* the
refund policy both read their figures from that file, so a mismatch is not a stale label — it is
a refund policy quoting a price you do not charge.

### 3. Register the live webhook

Endpoint `https://<domain>/api/stripe/webhook`, subscribed to the four events in the Webhook
section above. Live mode issues its **own** signing secret — a test-mode `whsec_` will reject
every live event with a 400.

### 4. Set the live variables on Railway

Project `believable-spirit`, service `Citrus-Writing`, production environment.

| Variable | Value |
|---|---|
| `STRIPE_SECRET_KEY` | `sk_live_...` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_live_...` |
| `STRIPE_PRICE_SERIAL_MONTHLY` | live monthly Price id |
| `STRIPE_PRICE_SERIAL_YEARLY` | live yearly Price id |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` from the **live** endpoint |
| `RESEND_API_KEY`, `MAIL_FROM` | otherwise password-reset links are only printed to the server log |

**`NEXT_PUBLIC_` variables are inlined at build time, not read at runtime.** Changing the
publishable key needs a *redeploy*, not a restart — setting it and restarting will silently keep
serving the old key.

### 5. Point the domain at Railway

The service currently answers on `citrus-writing-production.up.railway.app`. Add `<domain>` as a
custom domain and set the DNS record Railway asks for. Nothing in the app hardcodes a host — the
checkout return URL is built from the request's own `x-forwarded-host` — so no code changes.

### 6. OAuth redirect URIs, if you use them

Only if `GOOGLE_CLIENT_ID`/`SECRET` or `GITHUB_CLIENT_ID`/`SECRET` are set. A provider missing
either variable does not render a button and its route 404s, so this is optional. If used,
register `https://<domain>/api/auth/oauth/google/callback` and the GitHub equivalent.

### 7. Take one real payment, then refund it

A live card, end to end: the plan should flip to Serial **from the webhook**, not from the
browser returning. Then refund it from the Dashboard and confirm the account drops back. This
exercises the one path no test-mode run can fully prove.

### A safety property worth knowing

Without `STRIPE_SECRET_KEY`, this app falls back to switching the plan directly — and **that
fallback is refused in production**. A deploy that is missing its keys therefore fails the
upgrade loudly instead of quietly handing out the paid plan.

## Next steps

- [x] ~~Contrast on the payment form~~ — resolved by making the appearance per mode.
- [x] ~~The app's typeface in the form~~ — `"Segoe UI"` is a system font, so it needs no `fonts`
      option and makes no external request.
- [ ] **A one-time price would be taken and not granted.** The webhook's
      `checkout.session.completed` handler opens with `if (!session.subscription) break;`, so a
      `mode: "payment"` session is acknowledged and ignored. Whoever adds the $39 launch offer
      must handle that branch, or the money arrives with no plan attached. Also needs
      `mode: "payment"` and `payment_method_collection` dropped, which Stripe applies only to
      subscriptions.
- [ ] Decide whether `allow_promotion_codes` should come back (see "Removed" above). If yes, set
      it in Checkout Studio rather than by hand, so the next sync does not strip it again.
      Relevant to any launch discount.
- [ ] Confirm the **live-mode** price IDs. Test and live are separate ledgers — the two Serial
      prices verified here ($9/month, $84/year, matching `lib/billing/plans.ts`) exist in test
      mode; live mode needs its own.
- [ ] Register the production webhook endpoint and put its `whsec_...` value in the deploy
      environment.
- [ ] `RESEND_API_KEY` and a verified sending domain. Without them the password-reset link is
      only printed to the server log, which leaves a locked-out writer with no way back in.
- [ ] Fulfilment beyond the plan grant (receipts, onboarding email) is not wired — the only mail
      this app sends today is the password reset.

## Resources

- Stripe docs — https://docs.stripe.com
- Stripe MCP — https://docs.stripe.com/mcp
- Support — https://support.stripe.com
- Prices in the Dashboard — https://dashboard.stripe.com/prices
- Webhooks in the Dashboard — https://dashboard.stripe.com/workbench/webhooks
