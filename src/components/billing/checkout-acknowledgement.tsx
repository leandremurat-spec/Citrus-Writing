"use client";

import Link from "next/link";

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
 */
export function CheckoutAcknowledgement({
  interval,
  checked,
  onChange,
}: {
  interval: BillingInterval;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const total = formatPrice(priceCents("SERIAL", interval));
  const period = interval === "yearly" ? "year" : "month";
  const perMonth = formatPrice(perMonthCents("SERIAL", interval));

  return (
    <div className="flex flex-col gap-3.5">
      <dl className="flex flex-col gap-1.5 text-2xs leading-relaxed text-neutral-800">
        <div className="flex gap-2">
          <dt className="w-28 shrink-0 text-subtle">You pay</dt>
          <dd>
            <strong className="font-semibold text-foreground">
              {total} every {period}
            </strong>
            {interval === "yearly" ? ` — ${perMonth} a month` : ""}, plus tax where it applies. Charged in US dollars.
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-28 shrink-0 text-subtle">It renews</dt>
          <dd>
            Automatically, every {period}, until you cancel. Your card is charged again each time and Stripe emails you
            a receipt.
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
