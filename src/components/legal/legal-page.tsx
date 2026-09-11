import Link from "next/link";

import type { SessionUser } from "@/lib/auth/session";
import { formatLegalDate, legalHref, LEGAL_DOCUMENTS, type LegalBlock, type LegalDocument } from "@/content/legal";
import { MarketingFooter, MarketingNav, MarketingWidth } from "@/components/marketing/marketing-chrome";

import { LegalText } from "./legal-text";

/**
 * One renderer, three documents.
 *
 * It sits on the marketing chrome rather than the workspace's, because these pages have to be
 * readable by someone who has not signed up — which is most of the people who go looking for a
 * privacy policy — and because a legal page reached from the app footer should not feel like it
 * left the site.
 *
 * ── Colour ────────────────────────────────────────────────────────────────────
 *
 * Every pairing here is one `scripts/theme-check.ts` already enforces across all eight modes,
 * which is why this component adds no line to that table: body copy is `neutral-800`, headings
 * and bold runs are `--foreground`, links are `--press`, and the two tinted surfaces are the
 * ones the marketing and account pages already use — `ochre-900` on `ochre-100` for the gist,
 * `neutral-800` on `neutral-100` for a set-apart note. Reaching for an unaudited pairing on the
 * one page nobody re-reads after launch is how a palette quietly acquires an unreadable corner.
 *
 * ── Measure ───────────────────────────────────────────────────────────────────
 *
 * Body text is capped at 68 characters. The app already holds the manuscript to 46rem for the
 * same reason, and a licence clause set the full width of a 1200px column is the shape that
 * makes people stop reading — which, for the one document whose whole purpose is to be read
 * before it is agreed to, is a failure rather than a cosmetic complaint.
 *
 * ── `overflow-x-clip`, and why not `hidden` ───────────────────────────────────
 *
 * The decorative circle the marketing pages park in the top right is positioned at
 * `right: min(0px, 50vw - 760px)`, which puts it outside the viewport at any width under about
 * 1520px. Between roughly 1024px and there, that gave the page a horizontal scrollbar with
 * nothing but a background disc to scroll to — a fault this app's own inspector reports, and
 * one the pricing page had already shipped before these pages copied its decoration.
 *
 * `clip` rather than `hidden` because the two differ in a way that matters here: `overflow-x:
 * hidden` computes `overflow-y: auto`, which makes the element a scroll container and leaves
 * the "On this page" nav sticking to *that* rather than to the viewport — so it would scroll
 * away. `clip` establishes no scroll container, so the nav keeps working.
 */

function Blocks({ blocks }: { blocks: LegalBlock[] }) {
  return (
    <>
      {blocks.map((block, index) => {
        if (typeof block === "string") {
          return (
            <p key={index} className="mt-3.5 max-w-[68ch] text-[0.9375rem] leading-[1.7] text-neutral-800">
              <LegalText text={block} />
            </p>
          );
        }

        if ("list" in block) {
          return (
            <ul key={index} className="mt-3.5 flex max-w-[68ch] list-none flex-col gap-2.5">
              {block.list.map((item, itemIndex) => (
                <li
                  key={itemIndex}
                  className="relative pl-5 text-[0.9375rem] leading-[1.7] text-neutral-800 before:absolute before:top-[0.65em] before:left-0 before:size-1.5 before:rounded-full before:bg-ochre"
                >
                  <LegalText text={item} />
                </li>
              ))}
            </ul>
          );
        }

        if ("note" in block) {
          return (
            <p
              key={index}
              className="mt-4.5 max-w-[68ch] rounded-[var(--radius-lg)] bg-neutral-100 px-5 py-4 text-[0.9375rem] leading-[1.7] text-neutral-800 ring-1 ring-edge"
            >
              <LegalText text={block.note} />
            </p>
          );
        }

        return (
          <dl key={index} className="mt-4.5 max-w-[68ch] border-t border-divider">
            {block.definitions.rows.map((row) => (
              <div
                key={row.term}
                className="grid gap-x-5 gap-y-1 border-b border-edge py-3.5 sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)]"
              >
                <dt className="text-[0.9375rem] leading-[1.5] font-semibold text-foreground">{row.term}</dt>
                <dd className="text-[0.9375rem] leading-[1.7] text-neutral-800">
                  <LegalText text={row.detail} />
                </dd>
              </div>
            ))}
          </dl>
        );
      })}
    </>
  );
}

export function LegalPage({ document, user }: { document: LegalDocument; user: SessionUser | null }) {
  const others = LEGAL_DOCUMENTS.filter((other) => other.slug !== document.slug);

  return (
    <div className="min-h-dvh overflow-x-clip bg-background text-foreground [text-wrap:pretty]">
      <MarketingNav user={user} />

      <MarketingWidth>
        <header className="relative isolate pt-10 pb-7 sm:pt-14 lg:pt-19">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -top-65 -z-10 size-100 rounded-full bg-ochre-200 right-[min(0px,calc(50vw-760px))]"
          />

          <p className="label-eyebrow text-subtle">Legal</p>
          <h1 className="mt-2.5 -ml-[0.028em] font-heading text-[clamp(2.125rem,4.4vw,3.25rem)] leading-[1.1]">
            {document.title}
          </h1>
          <p className="mt-5 max-w-[56ch] text-[clamp(1rem,1.3vw,1.0625rem)] leading-[1.65] text-neutral-800">
            {document.summary}
          </p>
          <p className="mt-4 text-2xs text-subtle">
            Last updated <time dateTime={document.updated}>{formatLegalDate(document.updated)}</time>
          </p>
        </header>

        {/* --------------------------------------------------------------- gist */}
        <section
          aria-labelledby="legal-gist"
          className="rounded-[2.5rem] bg-ochre-100 px-6 py-6 sm:px-9 sm:py-8 lg:px-12 lg:py-10"
        >
          <h2 id="legal-gist" className="font-heading text-[1.25rem] leading-[1.25] text-ochre-900">
            In short
          </h2>
          <ul className="mt-4 flex flex-col gap-2.5">
            {document.gist.map((line) => (
              <li
                key={line}
                className="relative max-w-[64ch] pl-5 text-[0.9375rem] leading-[1.65] text-ochre-900 before:absolute before:top-[0.62em] before:left-0 before:size-1.5 before:rounded-full before:bg-ochre-700"
              >
                {line}
              </li>
            ))}
          </ul>
          <p className="mt-5 max-w-[64ch] text-2xs leading-relaxed text-ochre-900">
            This summary is here so that the document below is not the first time you meet what is in it. It is not a
            substitute for it — where the two differ, the document is what applies.
          </p>
        </section>

        {/* -------------------------------------------------- contents + document */}
        <div className="mt-8 grid gap-x-12 gap-y-8 pb-8 sm:mt-11 lg:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] lg:pb-13">
          <nav aria-label="On this page" className="lg:sticky lg:top-6 lg:self-start">
            <h2 className="label-section">On this page</h2>
            <ol className="mt-3 flex flex-col gap-1.5">
              {document.sections.map((section, index) => (
                <li key={section.id} className="flex gap-2.5 text-[0.8125rem] leading-[1.45]">
                  <span aria-hidden="true" className="w-4 shrink-0 text-right text-subtle tabular-nums">
                    {index + 1}
                  </span>
                  <Link
                    href={`#${section.id}`}
                    className="focus-ring rounded-full text-neutral-800 transition-colors duration-tint ease-state hover:text-press"
                  >
                    {section.heading}
                  </Link>
                </li>
              ))}
            </ol>
          </nav>

          <article className="min-w-0">
            {document.sections.map((section, index) => (
              <section
                key={section.id}
                id={section.id}
                aria-labelledby={`${section.id}-heading`}
                className="scroll-mt-6 border-t border-divider pt-6 first:border-t-0 first:pt-0 [&+section]:mt-8"
              >
                <h2
                  id={`${section.id}-heading`}
                  className="flex gap-3 font-heading text-[clamp(1.3125rem,1.9vw,1.5rem)] leading-[1.25]"
                >
                  <span aria-hidden="true" className="text-subtle tabular-nums">
                    {index + 1}
                  </span>
                  {section.heading}
                </h2>
                <Blocks blocks={section.blocks} />
              </section>
            ))}
          </article>
        </div>

        {/* ------------------------------------------------------ the other two */}
        <section aria-labelledby="legal-others" className="border-t border-divider py-8 lg:py-11">
          <h2 id="legal-others" className="label-section">
            The other documents
          </h2>
          <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-3.5">
            {others.map((other) => (
              <Link
                key={other.slug}
                href={legalHref(other.slug)}
                className="focus-ring rounded-[var(--radius-lg)] bg-card p-5 ring-1 ring-edge transition-colors duration-tint ease-state hover:bg-muted"
              >
                <span className="font-heading text-[1.125rem] leading-[1.25] text-press">{other.title}</span>
                <span className="mt-1.5 block text-[0.875rem] leading-[1.6] text-neutral-800">{other.summary}</span>
              </Link>
            ))}
          </div>
        </section>
      </MarketingWidth>

      <MarketingFooter note="Questions about any of this? Write to us — a person answers." />
    </div>
  );
}
