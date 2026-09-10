import { NextResponse } from "next/server";

import { fetchSubscription, periodEnd, verifyWebhook, type StripeSubscription } from "@/lib/billing/stripe";
import { prisma } from "@/lib/db";

/**
 * Stripe's webhook: the only thing in this app that grants the Serial plan.
 *
 * The browser coming back from Checkout proves nothing — it can be replayed, edited, or simply
 * typed in — so the return URL says thank you and this endpoint changes the plan.
 *
 * Two things are load-bearing:
 *
 * **The raw body is read as text and never parsed first.** The signature is over the exact
 * bytes Stripe sent; `request.json()` would re-serialise them and every signature would fail.
 *
 * **An unverified request is a 400 and nothing else.** Without that this route is a public
 * "make me a subscriber" button.
 *
 * Delivery is at-least-once and out of order, so every handler below is written to be
 * idempotent: each one sets the account to the state the *subscription* is in, rather than
 * nudging it in a direction.
 */
export const dynamic = "force-dynamic";

interface StripeEvent {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
}

/** Stripe's statuses, narrowed to the three that change what a writer can reach. */
function planStatusFor(status: string): "ACTIVE" | "PAST_DUE" | "CANCELED" {
  if (status === "active" || status === "trialing") return "ACTIVE";
  if (status === "past_due" || status === "unpaid") return "PAST_DUE";
  return "CANCELED";
}

async function applySubscription(subscription: StripeSubscription, userIdHint?: string): Promise<void> {
  const userId =
    subscription.metadata?.userId ??
    userIdHint ??
    (
      await prisma.user.findFirst({
        where: { stripeCustomerId: subscription.customer },
        select: { id: true },
      })
    )?.id;

  if (!userId) {
    console.error("Stripe webhook: no account matches subscription", subscription.id);
    return;
  }

  const status = planStatusFor(subscription.status);
  await prisma.user.update({
    where: { id: userId },
    data: {
      // PAST_DUE keeps the plan: Stripe retries a failed card for days, and locking someone
      // out of their manuscript on the first retry would be a worse failure than the payment.
      plan: status === "CANCELED" ? "DRAWER" : "SERIAL",
      planStatus: status,
      planRenewsAt: periodEnd(subscription),
      stripeCustomerId: subscription.customer,
      stripeSubscriptionId: status === "CANCELED" ? null : subscription.id,
    },
  });
}

export async function POST(request: Request) {
  const raw = await request.text();

  if (!verifyWebhook(raw, request.headers.get("stripe-signature"))) {
    return new NextResponse("Invalid signature", { status: 400 });
  }

  let event: StripeEvent;
  try {
    event = JSON.parse(raw) as StripeEvent;
  } catch {
    return new NextResponse("Malformed payload", { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as {
          client_reference_id?: string;
          customer?: string;
          subscription?: string;
        };
        if (!session.subscription) break;
        const subscription = await fetchSubscription(session.subscription);
        await applySubscription(
          { ...subscription, customer: subscription.customer ?? session.customer ?? "" },
          session.client_reference_id,
        );
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        await applySubscription(event.data.object as unknown as StripeSubscription);
        break;
      }

      default:
        // Every other event type is acknowledged and ignored. Returning an error for events
        // this app does not handle would make Stripe retry them forever.
        break;
    }
  } catch (error) {
    // A 500 asks Stripe to retry, which is what we want for a transient database or API
    // failure — the event is not lost.
    console.error("Stripe webhook handler failed", event.type, error);
    return new NextResponse("Handler failed", { status: 500 });
  }

  return NextResponse.json({ received: true });
}
