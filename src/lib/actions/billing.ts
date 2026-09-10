"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";

import { fail, type ActionResult } from "@/lib/actions/result";
import { authorize } from "@/lib/auth/guard";
import { createPortalSession, isConfigured, priceIdFor } from "@/lib/billing/stripe";
import { prisma } from "@/lib/db";

/**
 * Upgrading, and managing the subscription afterwards.
 *
 * The plan a writer is *on* is only ever written by two things: Stripe's webhook, and the
 * development fallback below. Nothing a browser posts can set it directly, which is the point
 * of routing an upgrade through a Checkout session rather than a "make me a subscriber" action.
 *
 * **The development fallback is deliberate and it is loud.** With no `STRIPE_SECRET_KEY`, an
 * upgrade switches the plan straight away and reports that no payment was taken, so every plan
 * gate in the app can be exercised end to end before any Stripe account exists. It is refused
 * outright in production: a build that ships with the keys missing must not quietly give the
 * paid plan away.
 */

/** The app's own origin, taken from the request rather than an environment variable, so the
    Stripe return URLs are right on localhost, on a preview deploy and in production alike. */
async function origin(): Promise<string> {
  const store = await headers();
  const host = store.get("x-forwarded-host") ?? store.get("host");
  const proto = store.get("x-forwarded-proto") ?? (process.env.NODE_ENV === "production" ? "https" : "http");
  return proto + "://" + host;
}

const checkoutSchema = z.object({ interval: z.enum(["monthly", "yearly"]) });

export type CheckoutOutcome =
  /**
   * Send the browser here. Since the move to an embedded payment form this is `/checkout`, a
   * page of this app's own, rather than a page on Stripe — the form renders there, in a
   * Stripe-hosted iframe, and the session itself is created by `/api/create-checkout-session`
   * once that page asks for it.
   */
  | { ok: true; kind: "redirect"; url: string }
  /** No payment provider configured: the plan was switched directly. */
  | { ok: true; kind: "switched" }
  | { ok: false; error: string };

export async function startCheckout(input: z.input<typeof checkoutSchema>): Promise<CheckoutOutcome> {
  const auth = await authorize();
  if (!auth.ok) return auth;

  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) return fail("That billing interval is not recognised.");

  if (auth.user.plan === "SERIAL" && auth.user.planStatus === "ACTIVE") {
    return fail("You are already on Serial.");
  }

  const priceId = priceIdFor(parsed.data.interval);

  if (!isConfigured() || !priceId) {
    if (process.env.NODE_ENV === "production") {
      return fail("Payments are not set up yet. Nothing was charged and nothing changed.");
    }
    await prisma.user.update({
      where: { id: auth.user.id },
      data: { plan: "SERIAL", planStatus: "ACTIVE", planRenewsAt: null },
    });
    revalidatePath("/", "layout");
    return { ok: true, kind: "switched" };
  }

  // The session is no longer created here. An embedded form is built in the browser from a
  // `client_secret`, and Stripe's SDK wants to fetch that itself — so `/checkout` renders the
  // form and `/api/create-checkout-session` mints the session when that page asks for it.
  // This action's remaining job is to decide *whether* checkout should happen at all.
  return { ok: true, kind: "redirect", url: "/checkout?interval=" + parsed.data.interval };
}

/** Stripe's own Billing Portal: cards, invoices, and cancelling. */
export async function openBillingPortal(): Promise<ActionResult<{ url: string }>> {
  const auth = await authorize();
  if (!auth.ok) return auth;

  if (!isConfigured() || !auth.user.stripeCustomerId) {
    return fail("There is no billing account to manage yet.");
  }

  try {
    const session = await createPortalSession(auth.user.stripeCustomerId, (await origin()) + "/account");
    return { ok: true, url: session.url };
  } catch (error) {
    console.error("openBillingPortal failed", error);
    return fail("The billing portal could not be opened.");
  }
}

/**
 * Drops back to Drawer without a payment provider — the other half of the development
 * fallback, and the only way to test the free plan's gates once an account has been upgraded.
 *
 * A real subscription is never cancelled here: with Stripe configured this refuses and points
 * at the portal, so the app can never believe someone has stopped paying while Stripe still
 * thinks they are.
 */
export async function downgradeToDrawer(): Promise<ActionResult> {
  const auth = await authorize();
  if (!auth.ok) return auth;

  if (isConfigured() && auth.user.stripeCustomerId) {
    return fail("Cancel from the billing portal, so the subscription itself ends too.");
  }
  if (process.env.NODE_ENV === "production" && isConfigured()) {
    return fail("Cancel from the billing portal.");
  }

  await prisma.user.update({
    where: { id: auth.user.id },
    data: { plan: "DRAWER", planStatus: "NONE", planRenewsAt: null },
  });
  revalidatePath("/", "layout");
  return { ok: true };
}
