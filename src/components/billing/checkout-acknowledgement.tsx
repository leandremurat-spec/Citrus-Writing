"use client";

import Link from "next/link";

import { currencyName, DEFAULT_CURRENCY, type Currency } from "@/lib/billing/currency";
import { formatPrice, perMonthCents, priceCents, type BillingInterval } from "@/lib/billing/plans";
import { CheckRow } from "@/components/auth/auth-parts";

/**
 * What a writer is told, and what they confirm, before they are charged.
 *
 * ── The summary ───────────────────────────────────────────────────────────────
 *
 * Price, what renews, when, and how to stop it — stated on the page where the money is taken
 * rather than only in a policy two clicks away. Consumer law in the UK and EU requires the main
 * characteristics, the total price and the arrangements for payment and duration to be given
 * *before* the order is placed, and US auto-renewal statutes (California's especially) require
 * the renewal terms to be clear and conspicuous next to the point of purchase. One block
 * satisfies both, and it is honest anyway.
 *
 * ── The acknowledgement ───────────────────────────────────────────────────────
 *
 * This is the tick box the [Refund and Subscription Policy](/legal/refunds#statutory) rests on,
 * and it is the reason this product can say "no refunds" to an international audience without
 * saying something unenforceable.
 *
 * A consumer buying a digital service at a distance in the UK or EU has 14 days to withdraw,
 * and no term in our documents can take that away. It falls away in exactly one lawful way:
 * where the consumer expressly requests that the service begin within those 14 days *and*
 * acknowledges that they lose the right once it has been fully performed. So that is what this
 * asks, in its own words, in a box the writer ticks themselves — never pre-ticked, because a
 * pre-ticked box is not consent and would leave the waiver worth nothing.
 *
 * `CheckoutForm` refuses to confirm the payment until it is ticked. That refusal is the control;
 * the box being visible is merely the courtesy.
 *
 * ── Discounts ─────────────────────────────────────────────────────────────────
 *
 * `discountOffCents` is what a redeemed promotion code takes off the *first* charge, and it has
 * to be said here rather than only on the payment form. An introductory price that converts to
 * a higher recurring one is precisely the case US auto-renewal statutes — California's ARL
 * most explicitly — require to be disclosed clearly and conspicuously before the order, and the
 * UK/EU pre-contract rules ask the same of the total price. A block that keeps reading
 * "$84.00 every year" while the writer is about to be charged $42.00 is not a smaller problem
 * than saying nothing; it is a false statement at the moment of sale.
 */
export function CheckoutAcknowledgement({
  interval,
  checked,
  onChange,
  discountOffCents = 0,
  currency = DEFAULT_CURRENCY,
}: {
  interval: BillingInterval;
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Taken off the first charge only. Zero when no code is applied. */
  discountOffCents?: number;
  /**
   * The currency the session is created with. This block states the total price before the
   * order, which is a pre-contract requirement in the UK and EU — so it has to name the
   * currency the card is actually charged in, not a house default.
   */
  currency?: Currency;
}) {
  const fullCents = priceCents("SERIAL", interval, currency);
  const total = formatPrice(fullCents, currency);
  const period = interval === "yearly" ? "year" : "month";
  const perMonth = formatPrice(perMonthCents("SERIAL", interval, currency), currency);

  const discounted = discountOffCents > 0;
  const firstTotal = formatPrice(Math.max(fullCents - discountOffCents, 0), currency);

  return (
    <div className="flex flex-col gap-3.5">
      <dl className="flex flex-col gap-1.5 text-2xs leading-relaxed text-neutral-800">
        <div className="flex gap-2">
          <dt className="w-28 shrink-0 text-subtle">You pay</dt>
          <dd>
            {discounted ? (
              <>
                <strong className="font-semibold text-foreground">
                  {firstTotal} for your first {period}
                </strong>
                , then {total} every {period}
              </>
            ) : (
              <>
                <strong className="font-semibold text-foreground">
                  {total} every {period}
                </strong>
                {interval === "yearly" ? ` — ${perMonth} a month` : ""}
              </>
            )}
            , plus tax where it applies. Charged in {currencyName(currency)}.
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-28 shrink-0 text-subtle">It renews</dt>
          <dd>
            Automatically, every {period}, until you cancel.
            {discounted ? ` The discount applies to your first ${period} only, so the next charge is ${total}.` : ""}{" "}
            Your card is charged again each time and Stripe emails you a receipt.
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-28 shrink-0 text-subtle">To stop it</dt>
          <dd>
            Cancel from your account page any day. You keep Serial to the end of the {period} you have paid for; the
            unused part is not refunded.
          </dd>
        </div>
      </dl>

      <CheckRow id="cw-checkout-ack" checked={checked} onChange={onChange}>
        I want my Serial subscription to start immediately, and I understand that once it has been fully provided I
        lose the right to cancel for a refund within 14 days. I have read the{" "}
        <Link
          href="/legal/refunds"
          target="_blank"
          className="focus-ring rounded-full text-press underline underline-offset-2 hover:text-press-800"
        >
          Refund and Subscription Policy
        </Link>
        .
      </CheckRow>
    </div>
  );
}
