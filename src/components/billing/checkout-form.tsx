"use client";

import * as React from "react";
import Script from "next/script";

import type { BillingInterval } from "@/lib/billing/plans";
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

interface LoadActionsResult {
  type: "success" | "error";
  actions?: { confirm(options: { formConfirmEvent: ConfirmEvent }): Promise<void> };
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

/** Configured in Checkout Studio. Change it there rather than here. */
const appearance = {
  theme: "stripe",
  labels: "auto",
  inputs: "spaced",
  variables: {
    borderRadius: "4px",
    colorBackground: "#ffffff",
    colorDanger: "#df1b41",
    colorPrimary: "#ed930a",
    colorSuccess: "#a7d463",
    colorText: "#17120e",
    fontFamily: "Lora",
    fontSizeBase: "16px",
    spacingUnit: "4px",
  },
};

export function CheckoutForm({ interval }: { interval: BillingInterval }) {
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
      const checkout = stripe.initCheckoutFormSdk({ clientSecret, appearance });

      const form = checkout.createForm({ layout: "expanded" });
      form.mount("#checkout-form");
      formRef.current = form;

      const loadActionsResult = await checkout.loadActions();
      if (loadActionsResult.type === "success" && loadActionsResult.actions) {
        const { actions } = loadActionsResult;
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

      <CheckoutAcknowledgement interval={interval} checked={acknowledged} onChange={acknowledge} />

      {error ? (
        <p role="alert" className="rounded-md bg-proof/5 px-4 py-3 text-sm text-proof">
          {error}
        </p>
      ) : null}

      <div id="checkout-form" />
    </>
  );
}
