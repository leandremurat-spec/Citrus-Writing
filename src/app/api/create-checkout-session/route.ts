import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { authorize } from "@/lib/auth/guard";
import { createCheckoutSession, isConfigured, priceIdFor } from "@/lib/billing/stripe";

/**
 * Mints the embedded Checkout Session and hands back its `client_secret`.
 *
 * This is a route handler rather than a server action because Stripe's form SDK fetches the
 * secret itself — `initCheckoutFormSdk({clientSecret})` takes a promise for a plain string, so
 * there has to be something returning JSON at a URL. Server actions are not that.
 *
 * It is not a thin wrapper: it re-checks authorization and the plan, because this URL is
 * reachable directly and "the button was hidden" is not a control. `startCheckout` deciding a
 * writer may upgrade does not make this endpoint willing to mint a session for anyone else.
 *
 * The `client_secret` is deliberately never put in a URL or a redirect — it is returned to the
 * page that asked for it and used to build the form in place.
 */

export const dynamic = "force-dynamic";

const bodySchema = z.object({ interval: z.enum(["monthly", "yearly"]) });

export async function POST(request: Request) {
  const auth = await authorize();
  if (!auth.ok) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  if (auth.user.plan === "SERIAL" && auth.user.planStatus === "ACTIVE") {
    return NextResponse.json({ error: "You are already on Serial." }, { status: 409 });
  }

  // An unreadable body is treated as the default rather than an error: the SDK posts with no
  // body in some flows, and yearly is what the pricing page offers first.
  const raw = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse({ interval: "yearly", ...(raw as object) });
  if (!parsed.success) {
    return NextResponse.json({ error: "That billing interval is not recognised." }, { status: 400 });
  }

  const priceId = priceIdFor(parsed.data.interval);
  if (!isConfigured() || !priceId) {
    return NextResponse.json({ error: "Payments are not set up yet. Nothing was charged." }, { status: 503 });
  }

  const store = await headers();
  const host = store.get("x-forwarded-host") ?? store.get("host");
  const proto = store.get("x-forwarded-proto") ?? (process.env.NODE_ENV === "production" ? "https" : "http");

  try {
    const session = await createCheckoutSession({
      priceId,
      userId: auth.user.id,
      email: auth.user.email,
      customerId: auth.user.stripeCustomerId,
      // Only tells the account page to say thank you. The plan itself is granted by the
      // webhook, because a browser arriving here proves nothing about whether the payment
      // cleared.
      returnUrl: proto + "://" + host + "/account?upgraded=1",
    });
    return NextResponse.json({ client_secret: session.client_secret });
  } catch (error) {
    console.error("create-checkout-session failed", error);
    return NextResponse.json({ error: "The payment form could not be prepared." }, { status: 502 });
  }
}
