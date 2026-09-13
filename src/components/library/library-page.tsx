"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ChartNoAxesColumn, ArrowRight, Plus } from "lucide-react";
import { toast } from "sonner";

import { createNovel } from "@/lib/actions/novels";
import { TitleDialog } from "@/components/binder/binder-dialogs";
import { WeekDots } from "@/components/command-center/progress-panel";
import { Button } from "@/components/ui/button";
import { AccountMenu, type AccountMenuUser } from "@/components/workspace/account-menu";
import { Wordmark } from "@/components/workspace/wordmark";
import type { ContinueWriting, NovelCard as NovelCardData } from "@/lib/data/novels";
import type { WeekDay, WritingSummary } from "@/lib/data/writing";
import { formatNumber, pluralize } from "@/lib/format";

import { MiniRunDots } from "./mini-run-dots";
import { NovelCard } from "./novel-card";

/**
 * "Wednesday evening · day 2" — the reader's own clock, so it can only be written after
 * hydration.
 *
 * This is the same rule as **Never read localStorage during render** in the Shell notes, and it
 * bites the same way: this is a client component, so `new Date()` runs once on the server and
 * again in the browser. A server in UTC and a writer in another timezone disagree about the
 * weekday and about morning/afternoon/evening, React finds different text than it rendered, and
 * hydration fails for the whole page — not just this line.
 */
const NEVER_CHANGES = () => () => {};

/**
 * False while the server renders and through the first client render, true afterwards.
 *
 * `useSyncExternalStore` rather than `useState` + `useEffect`: React sanctions this shape for a
 * value that differs between server and client, and re-renders after hydration without the
 * cascading-render warning that setting state in an effect earns. The appearance and layout
 * stores use the same three arguments for the same reason.
 */
function useHydrated(): boolean {
  return React.useSyncExternalStore(
    NEVER_CHANGES,
    () => true,
    () => false,
  );
}

function useDayKicker(streak: number): string | null {
  if (!useHydrated()) return null;
  const now = new Date();
  const dayPart = now.getHours() < 12 ? "morning" : now.getHours() < 18 ? "afternoon" : "evening";
  return `${format(now, "EEEE")} ${dayPart}${streak > 0 ? ` · day ${streak}` : ""}`;
}

/** The headline reads only server data, so it is stable across hydration and needs no guard. */
function heroHeadline(summary: WritingSummary): string {
  if (summary.todayWords >= summary.dailyGoal) return "Today's goal is met. Well earned.";
  if (summary.todayWords > 0) {
    return `${formatNumber(summary.dailyGoal - summary.todayWords)} words and the streak is yours.`;
  }
  return summary.streak > 0 ? "Nothing written yet — the streak is waiting." : "A blank page. Every streak starts here.";
}

export function LibraryPage({
  novels,
  continueWriting,
  summary,
  weekDays,
  user,
  canAddSerial,
  showBuffer,
  serialLimit,
}: {
  novels: NovelCardData[];
  continueWriting: ContinueWriting | null;
  summary: WritingSummary;
  weekDays: WeekDay[];
  user: AccountMenuUser;
  /** False once a Drawer writer is at their one serial. */
  canAddSerial: boolean;
  /** The Buffer is a Serial feature, so its entry points are not drawn without it. */
  showBuffer: boolean;
  serialLimit: number | null;
}) {
  const router = useRouter();
  const [creating, setCreating] = React.useState(false);
  const kicker = useDayKicker(summary.streak);
  const headline = heroHeadline(summary);
  /*
   * Words written *this week*, not words this writer has. It is a flow, and the difference
   * matters: each day's wordsWritten is a net floored at zero, so a day spent cutting counts as
   * nothing rather than as a loss, and the week's sum is therefore always at least the real
   * change in the manuscripts and usually more. Rewrite a 4,000-word chapter and you wrote
   * 4,000 words that week while ending with the same book.
   *
   * The sentence below used to read "N words across 2 serials", which is a claim about how big
   * the serials *are* — a stock — and read as plainly wrong the moment the two figures diverged.
   * The true totals are on the cards below, one per serial.
   */
  const weekWords = weekDays.reduce((sum, day) => sum + day.wordsWritten, 0);

  return (
    <main className="min-h-dvh bg-background">
      <nav className="flex items-center gap-3 px-8 py-5">
        <Link href="/" className="focus-ring rounded-md">
          <Wordmark />
        </Link>
        {/* Beside the wordmark rather than in the account menu: it is about the writing, not
            about the account, and it is the thing a writer opens on purpose. */}
        <Link
          href="/library/insights"
          className="focus-ring inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-2xs text-subtle transition-colors duration-tint ease-state hover:bg-muted hover:text-foreground"
        >
          <ChartNoAxesColumn className="size-3.5" aria-hidden="true" />
          Insights
        </Link>
        <span className="flex-1" />
        {canAddSerial ? (
          <Button onClick={() => setCreating(true)}>
            <Plus /> New serial
          </Button>
        ) : (
          /* At the plan's limit the button becomes the upgrade, rather than a disabled control
             with a tooltip explaining why it is disabled. The action a writer can actually take
             is the one worth rendering. */
          <Button variant="outline" render={<Link href="/pricing?from=serial-limit" />} nativeButton={false}>
            <Plus /> Add another serial
          </Button>
        )}
        <AccountMenu user={user} />
      </nav>

      <div className="mx-auto max-w-[68rem] px-8 pb-16">
        <p className="label-eyebrow mb-2 min-h-4">{kicker}</p>
        <h1 className="max-w-xl font-heading text-4xl leading-tight">{headline}</h1>

        <div className="mt-7 flex flex-wrap items-stretch gap-4">
          {continueWriting && (
            <div className="flex min-w-[340px] flex-[2] flex-col gap-3.5 rounded-[2rem] bg-card p-6 shadow-e0">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-ochre-100 px-2.5 py-0.5 text-2xs font-medium text-ochre-800">
                  Where you left off
                </span>
              </div>
              <div>
                <h2 className="font-heading text-2xl">{continueWriting.novelTitle}</h2>
                <p className="mt-1 text-base text-foreground/80">{continueWriting.chapterTitle}</p>
              </div>
              <MiniRunDots statuses={continueWriting.runStatuses} />
              <div className="mt-1 flex flex-wrap items-center gap-3">
                <Button onClick={() => router.push(`/novels/${continueWriting.novelId}/chapters/${continueWriting.chapterId}`)}>
                  Keep writing <ArrowRight />
                </Button>
                {showBuffer && (
                  <Button variant="outline" onClick={() => router.push(`/novels/${continueWriting.novelId}/buffer`)}>
                    Open the buffer
                  </Button>
                )}
              </div>
            </div>
          )}

          <div className="flex min-w-[260px] flex-1 flex-col gap-3 rounded-[2rem] bg-ochre-100 p-6">
            <h3 className="font-heading text-xl text-ochre-900">This week</h3>
            <WeekDots weekDays={weekDays} />
            <p className="text-sm leading-relaxed text-ochre-900">
              <strong className="font-heading text-2xl">{formatNumber(weekWords)}</strong> words written this
              week. Today: {formatNumber(summary.todayWords)} of {formatNumber(summary.dailyGoal)}.
            </p>
          </div>
        </div>

        <div className="mt-11 mb-4 flex flex-wrap items-baseline gap-2.5">
          <h2 className="font-heading text-2xl">Your serials</h2>
          <span className="text-sm text-muted-foreground">{pluralize(novels.length, "serial")}</span>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {novels.map((novel) => (
            <NovelCard key={novel.id} novel={novel} />
          ))}

          {canAddSerial ? (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="focus-ring flex min-h-[180px] flex-col items-center justify-center gap-2 rounded-[1.75rem] border-2 border-dashed border-neutral-600 text-sm text-neutral-700 transition-colors duration-tint ease-state hover:border-press hover:text-press"
            >
              <Plus className="size-6" />
              Start a new serial
            </button>
          ) : (
            <Link
              href="/pricing?from=serial-limit"
              className="focus-ring flex min-h-[180px] flex-col items-center justify-center gap-2 rounded-[1.75rem] bg-ochre-100 p-6 text-center text-sm text-ochre-900 transition-colors duration-tint ease-state hover:bg-ochre-200"
            >
              <span className="font-heading text-xl">
                {serialLimit === 1 ? "One serial on Drawer" : "Serial limit reached"}
              </span>
              <span className="max-w-[26ch] leading-relaxed">
                Serial makes it unlimited — and adds the buffer, the release schedule and arc export.
              </span>
              <span className="mt-1 font-medium text-ochre">See the plans</span>
            </Link>
          )}
        </div>

      </div>

      <TitleDialog
        open={creating}
        onOpenChange={setCreating}
        heading="New novel"
        initialValue=""
        submitLabel="Create novel"
        onSubmit={async (title) => {
          const response = await createNovel({ title });
          if (!response.ok) {
            toast.error(response.error);
            return false;
          }
          router.push(`/novels/${response.id}/chapters/${response.chapterId}`);
        }}
      />
    </main>
  );
}
