import type { Metadata } from "next";
import Link from "next/link";

import { getCurrentUser } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { Emphasis } from "@/components/marketing/emphasis";
import { MarketingFooter, MarketingNav, MarketingWidth } from "@/components/marketing/marketing-chrome";
import { RunLegend, RunStrand } from "@/components/marketing/run-strand";
import { landing } from "@/content/site-copy";

/**
 * The landing page.
 *
 * `/` was the Library until accounts landed; the Library is `/library` now and this is what a
 * signed-out visitor meets. A *signed-in* writer is deliberately **not** redirected away — the
 * nav simply offers "Your library" instead of "Start writing". Bouncing them would mean the
 * person most likely to link someone here is the one person who cannot look at it.
 *
 * **Every word on this page comes from `src/content/site-copy.ts`**, so rewording it never means
 * editing a layout. What stays here is what a sentence cannot decide: which disc is tinted press
 * and which ochre, which two of the four sit lower on a wide screen. See the note on
 * FIGURE_STYLES below for how the two halves are matched up.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: landing.meta.title,
  description: landing.meta.description,
};

/**
 * The look of each figure disc, paired with `landing.figures` by position.
 *
 * Kept apart from the copy because none of it is a writing decision, and cycled with `%` so the
 * copy file's promise holds: add a fifth figure and it is styled like the first rather than
 * crashing on an undefined tone. Alternating `lift` is what gives the row its scatter.
 */
const FIGURE_STYLES = [
  { tone: "bg-press-100 text-press", size: "max-w-[240px] p-[26px]", lift: false },
  { tone: "bg-ochre-300 text-ochre-800", size: "max-w-[215px] p-6", lift: true },
  { tone: "bg-press-200 text-press", size: "max-w-[240px] p-[26px]", lift: false },
  { tone: "bg-ochre-100 text-ochre", size: "max-w-[200px] p-6", lift: true },
];

export default async function LandingPage() {
  const user = await getCurrentUser();

  return (
    <div className="min-h-dvh bg-background text-foreground [text-wrap:pretty]">
      <MarketingNav
        user={user}
        links={[
          { href: "#run", label: landing.run.eyebrow },
          { href: "#buffer", label: landing.buffer.eyebrow },
        ]}
      />

      <MarketingWidth>
        {/* ---------------------------------------------------------- hero */}
        <section className="pt-13 pb-9 sm:pt-16 sm:pb-12 lg:pt-26 lg:pb-16">
          <h1 className="-ml-[0.028em] font-heading text-[clamp(2.5rem,5.8vw,4.75rem)] leading-[1.08]">
            <span className="block">{landing.hero.headlineLine1}</span>
            <span className="block">{landing.hero.headlineLine2}</span>
          </h1>

          <p className="mt-7 max-w-[52ch] text-[clamp(1.0625rem,1.5vw,1.1875rem)] leading-[1.65] text-neutral-800">
            {landing.hero.intro}
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <Button
              render={<Link href={user ? "/library" : "/sign-up"} />}
              nativeButton={false}
              className="h-12 bg-press px-6.5 text-base text-press-foreground hover:bg-press-600"
            >
              {user ? landing.hero.primaryCtaSignedIn : landing.hero.primaryCta}
            </Button>
            <Button
              variant="ghost"
              render={<Link href="#run" />}
              nativeButton={false}
              className="h-12 px-5.5 text-base text-press hover:bg-press-100"
            >
              {landing.hero.secondaryCta}
            </Button>
          </div>
        </section>

        {/* ----------------------------------------------------------- run */}
        <section id="run" className="scroll-mt-6 pt-5 pb-9 sm:pb-12 lg:pt-10 lg:pb-16">
          <div className="flex flex-col gap-5.5 rounded-[3.5rem] bg-neutral-100 p-5.5 shadow-e2 ring-1 ring-edge sm:p-8 lg:p-9.5">
            <div className="flex flex-wrap items-baseline gap-x-4.5 gap-y-2.5">
              <span className="label-eyebrow text-press">{landing.run.eyebrow}</span>
              <span className="text-[0.9375rem] text-neutral-800">{landing.run.blurb}</span>
            </div>

            <RunStrand />
            <RunLegend />
          </div>
        </section>

        {/* ------------------------------------------------------- figures */}
        <section
          aria-label="Citrus Writing, by the numbers"
          className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] justify-items-center gap-3.5 pt-6 pb-9 sm:gap-6 sm:pb-12 lg:pt-11 lg:pb-16"
        >
          {landing.figures.map((figure, index) => {
            const style = FIGURE_STYLES[index % FIGURE_STYLES.length];
            return (
              <div
                key={figure.label}
                className={[
                  "box-border grid aspect-square w-full place-content-center rounded-full text-center",
                  style.tone,
                  style.size,
                  style.lift ? "lg:translate-y-5" : "",
                ].join(" ")}
              >
                <p className="font-heading text-[clamp(2.125rem,3.4vw,3rem)] leading-[1.15]">{figure.value}</p>
                <p className="mt-3 text-2xs leading-[1.3] font-semibold tracking-label text-neutral-800 uppercase [text-wrap:balance]">
                  <Emphasis text={figure.label} />
                </p>
              </div>
            );
          })}
        </section>

        {/* -------------------------------------------------- capabilities */}
        <section className="pt-7.5 pb-6 sm:pt-10 sm:pb-9 lg:pt-14 lg:pb-11">
          <span className="label-eyebrow mb-5.5 block text-press">{landing.capabilities.eyebrow}</span>

          {landing.capabilities.items.map((item) => (
            <div
              key={item.heading}
              className="grid grid-cols-1 items-baseline gap-x-6 gap-y-4 py-5.5 sm:grid-cols-[minmax(0,420px)_minmax(0,1fr)] lg:gap-x-18"
            >
              <h2 className="font-heading text-[1.625rem] leading-[1.2]">{item.heading}</h2>
              <p className="max-w-[52ch] text-[0.96875rem] leading-[1.65] text-neutral-800">{item.body}</p>
            </div>
          ))}
        </section>

        {/* -------------------------------------------------------- buffer */}
        <section
          id="buffer"
          className="grid scroll-mt-6 grid-cols-[repeat(auto-fit,minmax(300px,1fr))] items-center gap-6 pt-7.5 pb-9 sm:gap-10 sm:pb-12 lg:gap-16 lg:pt-14 lg:pb-16"
        >
          <div>
            <span className="label-eyebrow mb-3.5 block text-press">{landing.buffer.eyebrow}</span>
            <h2 className="font-heading text-[clamp(1.75rem,3vw,2.25rem)] leading-[1.18]">{landing.buffer.heading}</h2>
            <p className="mt-5.5 max-w-[48ch] text-[0.96875rem] leading-[1.65] text-neutral-800">
              {landing.buffer.body1}
            </p>
            <p className="mt-4.5 max-w-[48ch] text-[0.96875rem] leading-[1.65] text-neutral-800">
              {landing.buffer.body2}
            </p>
          </div>

          <RunwayCard />
        </section>

        {/* --------------------------------------------------------- quote */}
        <section className="pt-7.5 pb-9 sm:pt-10 sm:pb-12 lg:pt-14 lg:pb-16">
          <figure>
            <blockquote className="max-w-[32ch] font-heading text-[clamp(1.5rem,2.6vw,2rem)] leading-[1.4]">
              {landing.quote.text}
            </blockquote>
            <figcaption className="mt-7 text-[0.96875rem] leading-[1.65] text-subtle">
              {landing.quote.attribution}
            </figcaption>
          </figure>
        </section>

        {/* ----------------------------------------------------------- cta */}
        <section className="pb-7.5 sm:pb-10 lg:pb-14">
          <div className="rounded-[3.5rem] bg-ochre-100 px-6 py-7 sm:px-10 sm:py-10 lg:px-16 lg:py-13">
            <h2 className="font-heading text-[clamp(1.5rem,2.4vw,1.875rem)] leading-[1.2] text-ochre-900">
              {landing.closing.heading}
            </h2>
            <p className="mt-5 max-w-[54ch] text-[0.96875rem] leading-[1.65] text-ochre-900">{landing.closing.body}</p>
            <div className="mt-6.5 flex flex-wrap gap-3">
              <Button
                render={<Link href={user ? "/library" : "/sign-up"} />}
                nativeButton={false}
                className="h-11.5 bg-ochre px-6 text-[0.9375rem] text-background hover:bg-ochre-600"
              >
                {user ? landing.closing.primaryCtaSignedIn : landing.closing.primaryCta}
              </Button>
              <Button
                variant="outline"
                render={<Link href="/pricing" />}
                nativeButton={false}
                className="h-11.5 border-ochre-600 bg-transparent px-5.5 text-[0.9375rem] text-ochre-900 hover:bg-ochre-200"
              >
                {landing.closing.secondaryCta}
              </Button>
            </div>
          </div>
        </section>
      </MarketingWidth>

      <MarketingFooter note={landing.footerNote} />
    </div>
  );
}

/**
 * The Buffer, shown rather than described: a runway bar against a target, and the next three
 * release slots with the third still empty. Static illustration — the real one is
 * `schedule/buffer-board.tsx` and needs a serial to read from.
 *
 * The slot rows carry a `status` in the copy file rather than a colour, so renaming a chapter
 * there cannot accidentally repaint the row.
 */
function RunwayCard() {
  const { runwayCard } = landing;

  const slotTone = {
    queued: {
      row: "bg-press-100",
      dot: "bg-press-200 shadow-[inset_0_0_0_2px_var(--press)]",
      title: "text-press-900",
      words: "text-press-800",
    },
    edited: {
      row: "bg-ochre-100",
      dot: "bg-ochre-600",
      title: "text-ochre-900",
      words: "text-ochre-800",
    },
  } as const;

  return (
    <div className="flex flex-col gap-4 rounded-[3.5rem] bg-neutral-100 p-5 shadow-e2 ring-1 ring-edge sm:p-7">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-[1.375rem]">{runwayCard.title}</h3>
        <span className="font-heading text-2xl leading-none whitespace-nowrap text-ochre-800">
          {runwayCard.weeksDone}{" "}
          <span className="font-sans text-2xs font-semibold text-subtle">{runwayCard.weeksTarget}</span>
        </span>
      </div>

      <div
        role="progressbar"
        aria-label={runwayCard.title}
        aria-valuenow={2}
        aria-valuemin={0}
        aria-valuemax={4}
        aria-valuetext={`${runwayCard.weeksDone} ${runwayCard.weeksTarget}`}
        className="relative h-5.5 rounded-full bg-neutral-300"
      >
        <div className="absolute inset-y-0 left-0 w-1/2 rounded-full bg-ochre-600" />
        <div aria-hidden="true" className="absolute -top-1.5 -bottom-1.5 left-3/4 w-[3px] rounded-full bg-press-800" />
      </div>
      <div aria-hidden="true" className="flex justify-between text-2xs text-subtle">
        <span>now</span>
        <span>1 wk</span>
        <span>2 wk</span>
        <span className="font-bold text-press-800">target 3</span>
        <span>4</span>
      </div>

      <div className="mt-0.5 flex flex-col gap-1.5">
        {runwayCard.slots.map((slot) => {
          const tone = slotTone[slot.status as keyof typeof slotTone] ?? slotTone.queued;
          return (
            <div key={slot.chapter} className={`flex items-center gap-2.5 rounded-[20px] px-3.5 py-2.5 ${tone.row}`}>
              <span className={`size-2.75 flex-none rounded-full ${tone.dot}`} />
              <span className={`min-w-0 flex-1 truncate text-2xs font-semibold ${tone.title}`}>
                {slot.date} · {slot.chapter}
              </span>
              <span className={`flex-none text-3xs tabular-nums ${tone.words}`}>{slot.words}</span>
            </div>
          );
        })}
        <div className="flex items-center gap-2.5 rounded-[20px] border-2 border-dashed border-neutral-600 px-3.5 py-2.5">
          <span className="min-w-0 flex-1 text-2xs text-subtle">{runwayCard.emptySlot}</span>
        </div>
      </div>
    </div>
  );
}
