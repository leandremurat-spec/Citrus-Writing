"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { toast } from "sonner";

import { startCheckout } from "@/lib/actions/billing";
import {
  formatPrice,
  perMonthCents,
  PLANS,
  yearlySavingCents,
  type BillingInterval,
  type PlanId,
} from "@/lib/billing/plans";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Emphasis } from "@/components/marketing/emphasis";
import { Segmented, type SegmentedOption } from "@/components/ui/segmented";
import { pricing } from "@/content/site-copy";

/**
 * The two plan cards and the interval switch above them.
 *
 * Client-side because the switch is, and because the Serial button has three different jobs
 * depending on who is looking: sign up, upgrade, or "this is your plan". Rendering the wrong
 * one of those is the difference between a working pricing page and a confusing one, so the
 * decision is made here from the signed-in writer's own plan rather than guessed.
 *
 * Prices come from `lib/billing/plans.ts` — the same object the server enforces against — so
 * the page cannot advertise a limit the backend does not keep.
 */

const INTERVALS: SegmentedOption<BillingInterval>[] = [
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

function Tick({ included, tone }: { included: boolean; tone: string }) {
  const Icon = included ? Check : X;
  return (
    <Icon
      aria-hidden="true"
      strokeWidth={2.75}
      className={cn("mt-0.5 size-4.5 flex-none", included ? tone : "text-neutral-500")}
    />
  );
}

export function PricingPlans({ currentPlan }: { currentPlan: PlanId | null }) {
  const router = useRouter();
  const [interval, setInterval] = React.useState<BillingInterval>("yearly");
  const [pending, setPending] = React.useState(false);

  const serialPerMonth = formatPrice(perMonthCents("SERIAL", interval));
  const saving = formatPrice(yearlySavingCents("SERIAL"));

  const upgrade = async () => {
    if (pending) return;
    // Signed out: there is no account to attach a subscription to yet, so the plan choice
    // rides along to sign-up and the upgrade happens from the account page afterwards.
    if (!currentPlan) {
      router.push("/sign-up?next=" + encodeURIComponent("/account#plan"));
      return;
    }
    setPending(true);
    const response = await startCheckout({ interval });
    if (!response.ok) {
      toast.error(response.error);
      setPending(false);
      return;
    }
    if (response.kind === "redirect") {
      window.location.href = response.url;
      return;
    }
    toast.success("You are on Serial.", {
      description: "No payment provider is configured, so nothing was charged.",
    });
    router.push("/library");
    router.refresh();
  };

  return (
    <>
      <div className="mt-7 flex flex-wrap items-center gap-3.5">
        <Segmented label="Billing interval" options={INTERVALS} value={interval} onChange={setInterval} />
        <span className="inline-flex h-6.5 items-center rounded-full bg-ochre-100 px-3.5 text-3xs text-ochre-800">
          {pricing.yearlyBadge.replace("{saving}", saving)}
        </span>
      </div>

      <section
        aria-label="Plans"
        className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] items-start gap-3.5 pt-8 pb-8 sm:gap-5 sm:pb-11 lg:pb-13"
      >
        {/* ------------------------------------------------------------ Drawer */}
        <div className="flex flex-col gap-4.5 rounded-[3.5rem] bg-neutral-100 p-5.5 ring-1 ring-edge sm:p-7">
          <div>
            <h2 className="font-heading text-[1.625rem] leading-[1.15]">{PLANS.DRAWER.name}</h2>
            <p className="mt-2 text-sm leading-[1.5] text-neutral-800">{PLANS.DRAWER.tagline}</p>
          </div>

          <p className="flex items-baseline gap-2">
            <span className="font-heading text-[2.75rem] leading-none">Free</span>
            <span className="text-2xs text-subtle">always</span>
          </p>

          {currentPlan === "DRAWER" ? (
            <Button disabled variant="outline" className="h-11 bg-transparent text-[0.9375rem]">
              {pricing.planCta.currentPlan}
            </Button>
          ) : (
            <Button
              variant="outline"
              render={<Link href={currentPlan ? "/library" : "/sign-up"} />}
              nativeButton={false}
              className="h-11 bg-transparent text-[0.9375rem]"
            >
              {currentPlan ? pricing.planCta.backToLibrary : pricing.planCta.signedOut}
            </Button>
          )}

          <ul className="flex list-none flex-col gap-2.75 p-0">
            {pricing.planLines.DRAWER.map((line, index) => (
              <li
                key={index}
                className={cn("flex gap-2.5 text-sm leading-[1.5]", line.included ? "text-neutral-900" : "text-subtle")}
              >
                <Tick included={line.included} tone="text-press" />
                <span>
                  <Emphasis text={line.text} />
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* ------------------------------------------------------------ Serial */}
        <div className="flex flex-col gap-4.5 rounded-[3.5rem] bg-press-100 p-5.5 shadow-e3 sm:p-7">
          <div className="flex items-start gap-2.5">
            <div className="min-w-0 flex-1">
              <h2 className="font-heading text-[1.625rem] leading-[1.15] text-press-900">{PLANS.SERIAL.name}</h2>
              <p className="mt-2 text-sm leading-[1.5] text-press-800">{PLANS.SERIAL.tagline}</p>
            </div>
            <span className="inline-flex h-6 flex-none items-center rounded-full bg-press px-3 text-3xs text-press-foreground">
              Most writers
            </span>
          </div>

          <p className="flex flex-wrap items-baseline gap-2">
            <span className="font-heading text-[2.75rem] leading-none text-press-900">{serialPerMonth}</span>
            <span className="text-2xs text-press-800">
              a month{interval === "yearly" ? ", billed yearly" : ""}
            </span>
          </p>

          {currentPlan === "SERIAL" ? (
            <Button disabled className="h-11 bg-press text-[0.9375rem] text-press-foreground">
              {pricing.planCta.currentPlan}
            </Button>
          ) : (
            <Button
              disabled={pending}
              onClick={() => void upgrade()}
              className="h-11 bg-press text-[0.9375rem] text-press-foreground hover:bg-press-600"
            >
              {pending
                ? pricing.planCta.upgradePending
                : currentPlan
                  ? pricing.planCta.upgrade
                  : pricing.planCta.signedOut}
            </Button>
          )}

          <ul className="flex list-none flex-col gap-2.75 p-0">
            {pricing.planLines.SERIAL.map((line, index) => (
              <li key={index} className="flex gap-2.5 text-sm leading-[1.5] text-press-900">
                <Tick included tone="text-press-800" />
                <span>
                  <Emphasis text={line.text} />
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
