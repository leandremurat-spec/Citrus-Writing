import Link from "next/link";
import { ArrowLeft, Lock } from "lucide-react";

import type { Insights, SerialPace } from "@/lib/data/insights";
import type { WritingSummary } from "@/lib/data/writing";
import { Wordmark } from "@/components/workspace/wordmark";
import { Button } from "@/components/ui/button";

/**
 * The insights surface.
 *
 * A server component throughout. Nothing here is interactive — it is a page you read — and
 * keeping it off the client means the dates are formatted once, on the server, rather than
 * differing between what was rendered and what hydrates. That is the same clock problem the
 * Library's "Wednesday evening" kicker hit, avoided by not having a client to disagree with.
 */

const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatDay(day: string): string {
  return new Date(day + "T12:00:00Z").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

function Figure({ value, label, tone }: { value: string; label: string; tone?: "brand" }) {
  return (
    <div className="flex flex-col gap-1 rounded-[1.5rem] bg-card p-5 ring-1 ring-edge">
      <span
        className={
          "font-heading text-[2rem] leading-none " + (tone === "brand" ? "text-press-900" : "text-foreground")
        }
      >
        {value}
      </span>
      <span className="text-2xs text-subtle">{label}</span>
    </div>
  );
}

/**
 * Ninety days of daily word counts.
 *
 * Bars are scaled against the best day rather than the goal, because a goal-scaled chart clips
 * every good day to the same height and hides exactly the thing a writer wants to see.
 *
 * The rungs are the ones the app already audits for graphical marks — ochre-600 and neutral-600,
 * both asserted at 3:1 against every ground by `theme:check`. Reaching for a prettier rung would
 * mean a pairing nothing checks, in four palettes at once.
 *
 * A day with no words draws nothing at all. It could carry a faint tick, but every neutral pale
 * enough to read as "nothing" is below the 3:1 floor, and an absence that looks like an absence
 * is the better answer than a mark too quiet to be seen.
 */
function DailyChart({ daily }: { daily: Insights["daily"] }) {
  const best = daily.reduce((max, d) => Math.max(max, d.words), 0);
  if (daily.length === 0 || best === 0) {
    return <p className="text-sm text-subtle">Nothing written yet — this fills in as you go.</p>;
  }

  return (
    <div className="flex h-28 items-end gap-[2px] overflow-x-auto">
      {daily.map((day) => {
        if (day.words === 0) {
          return <div key={day.day} className="min-w-[3px] flex-1" aria-hidden="true" />;
        }
        const height = Math.max(4, Math.round((day.words / best) * 100));
        return (
          <div
            key={day.day}
            title={`${formatDay(day.day)} — ${day.words.toLocaleString("en-GB")} words`}
            style={{ height: `${height}%` }}
            className={
              "min-w-[3px] flex-1 rounded-t-[2px] " + (day.goalMet ? "bg-ochre-600" : "bg-neutral-600")
            }
          />
        );
      })}
    </div>
  );
}

/** Which days of the week the writing actually happens on. */
function WeekdayBars({ weekdays }: { weekdays: Insights["weekdays"] }) {
  const best = weekdays.reduce((max, w) => Math.max(max, w.averageWords), 0);

  return (
    <div className="flex flex-col gap-2">
      {weekdays.map((weekday) => (
        <div key={weekday.weekday} className="flex items-center gap-3">
          <span className="w-9 shrink-0 text-2xs text-subtle">{WEEKDAY_NAMES[weekday.weekday]}</span>
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-ochre-600"
              style={{ width: best > 0 ? `${Math.round((weekday.averageWords / best) * 100)}%` : "0%" }}
            />
          </div>
          <span className="w-20 shrink-0 text-right text-2xs tabular-nums text-subtle">
            {weekday.averageWords.toLocaleString("en-GB")} avg
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * One serial's pace, and what it means for the buffer.
 *
 * The sentence is the point. "0.4 chapters a week ahead" is arithmetic the reader has to finish;
 * a date is an answer. Where there is no honest date — the pace is flat, or the target is
 * already met — it says so rather than printing a number that implies more certainty than the
 * eight weeks behind it can carry.
 */
function SerialRow({ serial }: { serial: SerialPace }) {
  const net = serial.netChaptersPerWeek;
  const ahead = serial.runwayWeeks >= serial.targetWeeks;

  const verdict = ahead
    ? `Ahead of your ${serial.targetWeeks}-week target.`
    : serial.reachesTargetOn
      ? `At this pace you reach ${serial.targetWeeks} weeks of buffer around ${formatDay(serial.reachesTargetOn)}.`
      : serial.emptiesOn
        ? `The buffer is draining — it runs out around ${formatDay(serial.emptiesOn)}.`
        : "Writing and publishing at about the same rate, so the buffer is holding where it is.";

  return (
    <div className="flex flex-col gap-3 rounded-[1.5rem] bg-card p-5 ring-1 ring-edge">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <Link
          href={`/novels/${serial.novelId}/buffer`}
          className="focus-ring rounded-md font-heading text-lg text-foreground hover:text-press"
        >
          {serial.title}
        </Link>
        <span className="text-2xs text-subtle">
          {serial.runwayWeeks.toFixed(1)} of {serial.targetWeeks} weeks
        </span>
      </div>

      <p className="text-sm leading-relaxed text-neutral-800">{verdict}</p>

      <dl className="grid grid-cols-3 gap-3 text-2xs">
        <div>
          <dt className="text-subtle">Writing</dt>
          <dd className="tabular-nums text-foreground">
            {serial.averageWordsPerWeek.toLocaleString("en-GB")} words a week
          </dd>
        </div>
        <div>
          <dt className="text-subtle">A chapter costs</dt>
          <dd className="tabular-nums text-foreground">
            {serial.averageChapterWords.toLocaleString("en-GB")} words
          </dd>
        </div>
        <div>
          <dt className="text-subtle">Net</dt>
          <dd className={"tabular-nums " + (net >= 0 ? "text-ochre-900" : "text-proof")}>
            {net >= 0 ? "+" : ""}
            {net.toFixed(2)} chapters a week
          </dd>
        </div>
      </dl>
    </div>
  );
}

export function InsightsPage({
  insights,
  summary,
  showPace,
  penName,
}: {
  insights: Insights;
  summary: WritingSummary;
  showPace: boolean;
  penName: string;
}) {
  const consistency = Math.round(insights.consistency * 100);

  return (
    <main className="min-h-dvh bg-background">
      <nav className="flex items-center gap-3 px-8 py-5">
        <Link href="/library" className="focus-ring rounded-md">
          <Wordmark />
        </Link>
        <Link
          href="/library"
          className="focus-ring inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-2xs text-subtle transition-colors duration-tint ease-state hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          Your library
        </Link>
      </nav>

      <div className="mx-auto max-w-[58rem] px-8 pb-16">
        <h1 className="mb-1 font-heading text-4xl leading-tight">How it is going</h1>
        <p className="mb-8 text-sm text-subtle">
          {penName}&rsquo;s last {insights.daysObserved || 0} days, across every serial.
        </p>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Figure value={summary.streak.toLocaleString("en-GB")} label="day streak" tone="brand" />
          <Figure value={insights.totalWords.toLocaleString("en-GB")} label="words in the window" />
          <Figure
            value={insights.averageWordsPerWritingDay.toLocaleString("en-GB")}
            label="average writing day"
          />
          <Figure value={`${consistency}%`} label="of days written on" />
        </div>

        <section className="mt-10">
          <h2 className="label-section mb-3">Every day</h2>
          <DailyChart daily={insights.daily} />
          {insights.bestDay ? (
            <p className="mt-3 text-2xs text-subtle">
              Best day was {formatDay(insights.bestDay.day)} —{" "}
              {insights.bestDay.words.toLocaleString("en-GB")} words.
            </p>
          ) : null}
        </section>

        <section className="mt-10">
          <h2 className="label-section mb-3">Which days you write</h2>
          <WeekdayBars weekdays={insights.weekdays} />
        </section>

        <section className="mt-10">
          <h2 className="label-section mb-3">Staying ahead</h2>

          {!showPace ? (
            /*
             * Padlocked rather than hidden, the same way a locked export scope is. A Drawer
             * writer who has just built a backlog should be able to see that this is a thing the
             * app does — hiding it entirely means the only people who know are the ones who
             * already pay.
             */
            <div className="flex flex-col items-start gap-3 rounded-[1.5rem] bg-ochre-100 p-5 text-ochre-900">
              <Lock className="size-4" aria-hidden="true" />
              <p className="max-w-[54ch] text-sm leading-relaxed">
                Runway and pace projections come with Serial — how far ahead of your readers you
                are, and when you reach the buffer you are aiming for at your current rate.
              </p>
              <Button
                render={<Link href="/pricing?from=insights" />}
                nativeButton={false}
                className="h-9 bg-press text-press-foreground"
              >
                See Serial
              </Button>
            </div>
          ) : insights.serials === null ? (
            <p className="max-w-[54ch] text-sm leading-relaxed text-subtle">
              Not enough history yet to project a pace honestly. A fortnight of writing is about
              the point where the average stops being a guess — check back then.
            </p>
          ) : insights.serials.length === 0 ? (
            <p className="text-sm text-subtle">No serials yet.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {insights.serials.map((serial) => (
                <SerialRow key={serial.novelId} serial={serial} />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
