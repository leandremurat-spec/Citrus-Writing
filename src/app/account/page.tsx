import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { requireUser } from "@/lib/auth/session";
import type { PlanId } from "@/lib/billing/plans";
import { getSettings } from "@/lib/data/novels";
import { AccountSettings } from "@/components/account/account-settings";
import { AccountMenu } from "@/components/workspace/account-menu";
import { Wordmark } from "@/components/workspace/wordmark";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ upgraded?: string }> }) {
  const user = await requireUser("/account");
  const [settings, { upgraded }] = await Promise.all([getSettings(user.id), searchParams]);

  return (
    <main className="min-h-dvh bg-background">
      <nav className="flex items-center gap-3 px-8 py-5">
        <Link href="/library" className="focus-ring rounded-md">
          <Wordmark />
        </Link>
        {/* The wordmark already goes here, but a mark is a thing you learn is a link rather
            than a thing you see is one. This says so. */}
        <Link
          href="/library"
          className="focus-ring inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-2xs text-subtle transition-colors duration-tint ease-state hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          Your library
        </Link>
        <span className="flex-1" />
        <AccountMenu user={{ penName: user.penName, email: user.email, plan: user.plan as PlanId }} />
      </nav>

      <div className="mx-auto max-w-[52rem] px-8 pb-16">
        <h1 className="mb-6 font-heading text-4xl leading-tight">Your account</h1>

        <AccountSettings
          upgraded={upgraded === "1"}
          user={{
            penName: user.penName,
            email: user.email,
            plan: user.plan as PlanId,
            planStatus: user.planStatus,
            // Serialized here rather than passed as a Date: this crosses into a client
            // component, and the boundary only carries plain data.
            planRenewsAt: user.planRenewsAt ? user.planRenewsAt.toISOString() : null,
            hasPassword: user.hasPassword,
            notifyStale: user.notifyStale,
            hasBillingAccount: user.stripeCustomerId !== null,
          }}
          targets={{
            dailyGoal: settings.dailyGoal,
            sweetSpotMin: settings.sweetSpotMin,
            sweetSpotMax: settings.sweetSpotMax,
          }}
        />
      </div>
    </main>
  );
}
