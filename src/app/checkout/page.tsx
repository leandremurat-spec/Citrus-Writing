import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/session";
import { formatPrice, perMonthCents, PLANS, type BillingInterval } from "@/lib/billing/plans";
import { AuthWordmark } from "@/components/auth/auth-parts";
import { CheckoutForm } from "@/components/billing/checkout-form";

/**
 * Where the embedded payment form lives.
 *
 * This page exists because the form is embedded rather than hosted: with the old redirect there
 * was nothing of ours between the button and Stripe. What is on it is deliberately thin — what
 * is being bought, at what price, and the form — because a payment page that asks a second
 * question is a payment page people leave.
 *
 * The plan is *not* granted here, and this page cannot grant it. `/api/stripe/webhook` does
 * that, on Stripe's word rather than the browser's.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Checkout" };

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ interval?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?next=" + encodeURIComponent("/pricing"));
  if (user.plan === "SERIAL" && user.planStatus === "ACTIVE") redirect("/account");

  const { interval: raw } = await searchParams;
  const interval: BillingInterval = raw === "monthly" ? "monthly" : "yearly";
  const perMonth = formatPrice(perMonthCents("SERIAL", interval));

  return (
    <main className="relative isolate flex min-h-dvh items-start justify-center px-5 py-10 sm:px-10 lg:py-16">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -top-50 -z-10 size-100 rounded-full bg-ochre-200 right-[min(-60px,calc(50vw-700px))]"
      />

      <div className="w-full max-w-[560px]">
        <AuthWordmark />

        <h1 className="mt-6.5 -ml-[0.028em] font-heading text-[clamp(1.875rem,3.4vw,2.5rem)] leading-[1.1]">
          {PLANS.SERIAL.name}
        </h1>
        <p className="mt-3 text-[0.9375rem] leading-[1.6] text-neutral-800">
          {perMonth} a month{interval === "yearly" ? ", billed yearly" : ""}. Cancel from your account, any day.
        </p>

        <div className="mt-7 flex flex-col gap-4 rounded-[2rem] bg-neutral-100 p-5 ring-1 ring-edge sm:p-7">
          <CheckoutForm interval={interval} />
        </div>

        <p className="mt-5 text-2xs leading-relaxed text-subtle">
          <Link href="/pricing" className="focus-ring rounded-full text-press hover:text-press-800">
            Back to the plans
          </Link>
        </p>
      </div>
    </main>
  );
}
