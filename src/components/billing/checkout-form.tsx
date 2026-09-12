"use client";

import * as React from "react";
import Script from "next/script";

import { DEFAULT_CURRENCY, type Currency } from "@/lib/billing/currency";
import { formatPrice, type BillingInterval } from "@/lib/billing/plans";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckoutAcknowledgement } from "./checkout-acknowledgement";

/** Shown when someone presses pay without ticking the box, and cleared when they tick it. */
const ACK_REQUIRED = "Please confirm the box above before paying — it is what starts your subscription today.";

/**
 * The embedded Stripe payment form.
 *
 * Stripe.js is loaded straight from `js.stripe.com` and never bundled — that is a PCI
 * requirement, not a preference, and it is why this uses a `<Script>` tag rather than an npm
 * package. The `dahlia` build is the one carrying `initCheckoutFormSdk`.
 *
 * Everything below the script is ordinary: fetch a `client_secret`, hand it to the SDK, mount
 * the form it builds into a div, and forward its `confirm` event to the SDK's own confirm
 * action. The card fields themselves live in a Stripe-hosted iframe, so no card data ever
 * touches this app — the same property the hosted redirect had, kept.
 *
 * Guarded against double-mounting: React's development StrictMode runs effects twice, and
 * mounting two forms into one node leaves a duplicate iframe behind.
 */

interface ConfirmEvent {
  [key: string]: unknown;
}

interface CheckoutFormHandle {
  mount(selector: string): void;
  unmount(): void;
  on(event: "confirm", handler: (event: ConfirmEvent) => void | Promise<void>): void;
}

/** A money figure as the SDK reports it: a formatted string plus the integer minor units. */
interface SdkAmount {
  amount?: string;
  minorUnitsAmount?: number;
}

interface SdkSession {
  total?: { subtotal?: SdkAmount; discount?: SdkAmount };
}

interface PromotionResult {
  type: "success" | "error";
  error?: { message?: string };
}

interface CheckoutActions {
  confirm(options: { formConfirmEvent: ConfirmEvent }): Promise<void>;
  applyPromotionCode(code: string): Promise<PromotionResult>;
  removePromotionCode(): Promise<PromotionResult>;
  getSession(): Promise<SdkSession>;
}

interface LoadActionsResult {
  type: "success" | "error";
  actions?: CheckoutActions;
}

interface CheckoutSdk {
  createForm(options: { layout: string }): CheckoutFormHandle;
  loadActions(): Promise<LoadActionsResult>;
}

interface StripeInstance {
  initCheckoutFormSdk(options: { clientSecret: Promise<string>; appearance: unknown }): CheckoutSdk;
}

declare global {
  interface Window {
    Stripe?: (key: string, options?: { betas?: string[] }) => StripeInstance;
  }
}

/**
 * Configured in Checkout Studio — one appearance per mode.
 *
 * The form is a Stripe-hosted iframe, so it cannot inherit this app's palette the way every
 * other surface does; the appearance has to be chosen before the SDK is built. Everything
 * except `theme` is identical between the two, so this is Studio's one configuration with its
 * theme swapped, not two designs that can drift apart.
 *
 * It has to be per mode because `labels: "above"` places the section headings *outside* the
 * fields, on the checkout card — which is `bg-neutral-100`, cream in light and near-black in
 * dark. Measured on the real grounds: `night` renders those headings near-white, which is
 * 15:1 on the dark card and 1.1:1 on the light one, where they simply vanish. The fields
 * themselves are legible either way, which is what made the failure easy to miss.
 */
const APPEARANCE = {
  labels: "above",
  inputs: "condensed",
  variables: {
    borderRadius: "24px",
    colorPrimary: "#ee9013",
    colorSuccess: "#00c853",
    fontFamily: '"Segoe UI"',
    fontSizeBase: "16px",
    spacingUnit: "8px",
  },
} as const;

/**
 * Read once, when the form is built. It deliberately does not follow a later theme change:
 * rebuilding the SDK would unmount a payment form someone may be halfway through filling in,
 * and losing a half-typed card number is worse than a form that does not match the chrome.
 */
function appearanceForCurrentTheme() {
  const dark =
    typeof document !== "undefined" && document.documentElement.classList.contains("dark");
  return { ...APPEARANCE, theme: dark ? "night" : "flat" };
}

export function CheckoutForm({
  interval,
  suggestedCode = null,
  currency = DEFAULT_CURRENCY,
}: {
  interval: BillingInterval;
  /** The currency this writer is quoted in, and the one the session is created with. */
  currency?: Currency;
  /**
   * The launch code, when one is running. The field starts filled in with it rather than the
   * writer being told a code and asked to retype it — the offer is ours, so making them
   * transcribe it is friction we invented. It stays editable, and clearing it is how you
   * decline.
   */
  suggestedCode?: string | null;
}) {
  const [error, setError] = React.useState<string | null>(null);
  const started = React.useRef(false);
  const formRef = React.useRef<CheckoutFormHandle | null>(null);

  /*
   * The withdrawal-right acknowledgement, held twice on purpose.
   *
   * The state drives the tick box. The ref is what the `confirm` handler reads, because that
   * handler is registered once while the SDK is being built and would otherwise close over
   * whatever the value was at that moment — which is always `false`, since the form mounts
   * before anyone has had a chance to tick anything.
   */
  const [acknowledged, setAcknowledged] = React.useState(false);
  const acknowledgedRef = React.useRef(false);
  const acknowledge = (next: boolean) => {
    acknowledgedRef.current = next;
    setAcknowledged(next);
    if (next) setError((current) => (current === ACK_REQUIRED ? null : current));
  };

  /*
   * The discount code.
   *
   * `actionsRef` is how this reaches the SDK: the actions are only available inside `start`,
   * and the field renders outside it. `canRedeem` gates the control on `loadActions` having
   * actually succeeded, so the field cannot be typed into before there is anything to apply it
   * to.
   *
   * The applied discount is held as minor units rather than the SDK's formatted string, so the
   * price shown in the acknowledgement can be computed with this app's own `formatPrice`
   * instead of two formatters disagreeing about currency.
   */
  const actionsRef = React.useRef<CheckoutActions | null>(null);
  const [canRedeem, setCanRedeem] = React.useState(false);
  const [codeInput, setCodeInput] = React.useState(suggestedCode ?? "");
  const [redeeming, setRedeeming] = React.useState(false);
  const [promoError, setPromoError] = React.useState<string | null>(null);
  const [discount, setDiscount] = React.useState<{ code: string; offCents: number } | null>(null);

  const readDiscount = React.useCallback(async (code: string) => {
    const session = await actionsRef.current?.getSession();
    const off = session?.total?.discount?.minorUnitsAmount ?? 0;
    setDiscount(off > 0 ? { code, offCents: off } : null);
  }, []);

  const applyCode = React.useCallback(async () => {
    const code = codeInput.trim();
    if (!code || !actionsRef.current) return;
    setRedeeming(true);
    setPromoError(null);
    try {
      const result = await actionsRef.current.applyPromotionCode(code);
      if (result.type !== "success") {
        setPromoError(result.error?.message ?? "That code could not be applied.");
        return;
      }
      await readDiscount(code.toUpperCase());
      setCodeInput("");
    } catch {
      setPromoError("That code could not be applied.");
    } finally {
      setRedeeming(false);
    }
  }, [codeInput, readDiscount]);

  const removeCode = React.useCallback(async () => {
    if (!actionsRef.current) return;
    setRedeeming(true);
    setPromoError(null);
    try {
      await actionsRef.current.removePromotionCode();
      setDiscount(null);
    } catch {
      setPromoError("That code could not be removed.");
    } finally {
      setRedeeming(false);
    }
  }, []);

  const start = React.useCallback(async () => {
    if (started.current) return;
    started.current = true;

    const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    if (!publishableKey) {
      setError("No Stripe publishable key is set, so the payment form cannot load.");
      return;
    }
    if (!window.Stripe) {
      setError("Stripe.js did not load.");
      return;
    }

    const stripe = window.Stripe(publishableKey, { betas: ["custom_checkout_payment_form_1"] });

    // The SDK takes the promise, not the resolved value, so it can start building while the
    // request is still in flight. A failure here has to be turned into a rejection, or the SDK
    // waits forever on a secret that is never coming.
    const clientSecret = fetch("/api/create-checkout-session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ interval }),
    })
      .then(async (response) => {
        const json = (await response.json()) as { client_secret?: string; error?: string };
        if (!response.ok || !json.client_secret) {
          throw new Error(json.error ?? "The payment form could not be prepared.");
        }
        return json.client_secret;
      })
      .catch((cause: Error) => {
        setError(cause.message);
        throw cause;
      });

    try {
      const checkout = stripe.initCheckoutFormSdk({
        clientSecret,
        appearance: appearanceForCurrentTheme(),
      });

      const form = checkout.createForm({ layout: "expanded" });
      form.mount("#checkout-form");
      formRef.current = form;

      const loadActionsResult = await checkout.loadActions();
      if (loadActionsResult.type === "success" && loadActionsResult.actions) {
        const { actions } = loadActionsResult;
        // The discount field needs these too, and it lives outside this callback.
        actionsRef.current = actions;
        setCanRedeem(true);
        form.on("confirm", async (event) => {
          // The control, rather than the courtesy. Stripe's own submit button lives inside its
          // iframe and cannot be disabled from here, so refusing the confirmation is the only
          // place the acknowledgement can actually be required — and it is the place that
          // matters, because it is the step that takes the money.
          if (!acknowledgedRef.current) {
            setError(ACK_REQUIRED);
            return;
          }

          try {
            await actions.confirm({ formConfirmEvent: event });
          } catch (cause) {
            console.error("Payment confirmation error:", cause);
            setError("That payment could not be confirmed. Nothing was charged.");
          }
        });
      }
    } catch {
      // The fetch failure above has already set a message; anything else is the SDK itself.
      setError((current) => current ?? "The payment form could not be started.");
    }
  }, [interval]);

  React.useEffect(() => {
    return () => {
      formRef.current?.unmount();
      formRef.current = null;
    };
  }, []);

  return (
    <>
      <Script src="https://js.stripe.com/dahlia/stripe.js" strategy="afterInteractive" onReady={() => void start()} />

      {canRedeem ? (
        <div className="flex flex-col gap-2">
          {discount ? (
            <div className="flex items-center justify-between gap-3 rounded-full bg-ochre-100 px-4 py-2 text-2xs text-ochre-900">
              <span>
                <strong className="font-semibold">{discount.code}</strong> — {formatPrice(discount.offCents, currency)} off
              </span>
              <button
                type="button"
                onClick={() => void removeCode()}
                disabled={redeeming}
                className="focus-ring rounded-full underline underline-offset-2 disabled:opacity-60"
              >
                Remove
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Input
                value={codeInput}
                onChange={(event) => setCodeInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void applyCode();
                  }
                }}
                placeholder="Discount code"
                aria-label="Discount code"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                className="h-9 flex-1 text-sm"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => void applyCode()}
                disabled={redeeming || codeInput.trim().length === 0}
                className="h-9"
              >
                Apply
              </Button>
            </div>
          )}

          {promoError ? (
            <p role="alert" className="px-1 text-2xs text-proof">
              {promoError}
            </p>
          ) : null}
        </div>
      ) : null}

      <CheckoutAcknowledgement
        interval={interval}
        checked={acknowledged}
        onChange={acknowledge}
        discountOffCents={discount?.offCents ?? 0}
        currency={currency}
      />

      {error ? (
        <p role="alert" className="rounded-md bg-proof/5 px-4 py-3 text-sm text-proof">
          {error}
        </p>
      ) : null}

      <div id="checkout-form" />
    </>
  );
}
