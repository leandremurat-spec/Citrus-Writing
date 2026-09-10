import type { Metadata } from "next";

import { requireUser } from "@/lib/auth/session";
import { capabilitiesFor, type PlanId } from "@/lib/billing/plans";
import { LibraryPage } from "@/components/library/library-page";
import { Welcome } from "@/components/workspace/welcome";
import { getContinueWriting, listNovelCards } from "@/lib/data/novels";
import { getCurrentWeekDays, getWritingSummary } from "@/lib/data/writing";

/**
 * The Library — what `/` used to be, before `/` became the landing page.
 *
 * Behind `requireUser`, so every read below is already scoped to a writer who exists. A
 * brand-new account has no serials and lands on `Welcome`, which asks for a title and calls
 * `createNovel` — that is where the "an Arc 1 and a Chapter 1 straight away" the sign-up
 * screen promises actually comes from.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Library" };

export default async function Library() {
  const user = await requireUser("/library");
  const novels = await listNovelCards(user.id);
  const capabilities = capabilitiesFor(user.plan as PlanId);

  if (novels.length === 0) return <Welcome penName={user.penName} />;

  const [continueWriting, summary, weekDays] = await Promise.all([
    getContinueWriting(user.id),
    getWritingSummary(user.id, null),
    getCurrentWeekDays(user.id),
  ]);

  return (
    <LibraryPage
      novels={novels}
      continueWriting={continueWriting}
      summary={summary}
      weekDays={weekDays}
      user={{ penName: user.penName, email: user.email, plan: user.plan as PlanId }}
      canAddSerial={capabilities.maxNovels === null || novels.length < capabilities.maxNovels}
      showBuffer={capabilities.buffer}
      serialLimit={capabilities.maxNovels}
    />
  );
}
