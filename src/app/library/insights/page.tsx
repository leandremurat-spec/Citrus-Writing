import type { Metadata } from "next";

import { requireUser } from "@/lib/auth/session";
import { capabilitiesFor, type PlanId } from "@/lib/billing/plans";
import { getInsights } from "@/lib/data/insights";
import { getWritingSummary } from "@/lib/data/writing";
import { InsightsPage } from "@/components/insights/insights-page";

/**
 * How the writing is actually going, across every serial.
 *
 * The Buffer answers "how is this serial doing"; nothing answered "how am I doing", which is the
 * question a writer with two of them has. It lives under the Library rather than inside a novel
 * for the same reason.
 *
 * Split along the line `plans.ts` already draws: **writing feedback is free, schedule analysis
 * is Serial.** The streak, the daily history, the weekday habits and the goal are the first
 * kind, and taking them away would make Drawer bad at the one thing it exists to be good at.
 * Runway and the projections are the second — they are the Buffer, read across novels — and sit
 * behind the same `buffer` capability the Buffer itself does, rather than a second flag that
 * would have to be kept in step with it.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Insights",
  description: "Your writing rhythm, and how far ahead of your readers you are.",
};

export default async function Insights() {
  const user = await requireUser("/library/insights");
  const capabilities = capabilitiesFor(user.plan as PlanId);

  const [insights, summary] = await Promise.all([
    getInsights(user.id),
    getWritingSummary(user.id, null),
  ]);

  return (
    <InsightsPage
      insights={insights}
      summary={summary}
      showPace={capabilities.buffer}
      penName={user.penName}
    />
  );
}
