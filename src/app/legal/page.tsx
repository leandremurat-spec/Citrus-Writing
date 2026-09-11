import type { Metadata } from "next";
import Link from "next/link";

import { getCurrentUser } from "@/lib/auth/session";
import { formatLegalDate, legalDetails, legalHref, LEGAL_DOCUMENTS } from "@/content/legal";
import { MarketingFooter, MarketingNav, MarketingWidth } from "@/components/marketing/marketing-chrome";

/**
 * The index the three documents hang off.
 *
 * It exists for two ordinary reasons and one that matters. The ordinary ones: a footer with
 * three legal links in it is a crowded footer, and "Legal" is the word people look for. The one
 * that matters is that an app-store review, a payment processor's onboarding check and a
 * business customer's procurement form all ask for *a* link to the legal terms, and handing
 * over three is how one of them goes unread.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Legal",
  description: `The terms, the privacy policy and the refund policy for ${legalDetails.product}.`,
};

export default async function LegalIndexPage() {
  const user = await getCurrentUser();

  return (
    <div className="min-h-dvh overflow-x-clip bg-background text-foreground [text-wrap:pretty]">
      <MarketingNav user={user} />

      <MarketingWidth>
        <section className="relative isolate pt-10 pb-9 sm:pt-14 lg:pt-19 lg:pb-13">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -top-65 -z-10 size-100 rounded-full bg-ochre-200 right-[min(0px,calc(50vw-760px))]"
          />

          <h1 className="-ml-[0.028em] font-heading text-[clamp(2.375rem,5vw,4rem)] leading-[1.08]">
            <span className="block">The small print,</span>
            <span className="block">written to be read.</span>
          </h1>
          <p className="mt-6.5 max-w-[54ch] text-[clamp(1rem,1.4vw,1.125rem)] leading-[1.65] text-neutral-800">
            Three documents. Each opens with a plain-English summary of what is in it, because a term you agreed to
            without reading is not much of an agreement.
          </p>

          <div className="mt-9 grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-3.5 sm:gap-5">
            {LEGAL_DOCUMENTS.map((document) => (
              <Link
                key={document.slug}
                href={legalHref(document.slug)}
                className="focus-ring flex flex-col rounded-[2rem] bg-card p-6 ring-1 ring-edge transition-colors duration-tint ease-state hover:bg-muted sm:p-7"
              >
                <span className="font-heading text-[1.375rem] leading-[1.2] text-press">{document.title}</span>
                <span className="mt-3 flex-1 text-[0.9375rem] leading-[1.6] text-neutral-800">{document.summary}</span>
                <span className="mt-5 text-2xs text-subtle">Updated {formatLegalDate(document.updated)}</span>
              </Link>
            ))}
          </div>

          <p className="mt-9 max-w-[54ch] text-[0.9375rem] leading-[1.65] text-neutral-800">
            Anything unclear, or anything you would like in writing before you sign up? Write to{" "}
            <a
              href={`mailto:${legalDetails.contactEmail}`}
              className="focus-ring rounded-full text-press underline decoration-press/35 underline-offset-2 hover:text-press-800"
            >
              {legalDetails.contactEmail}
            </a>
            .
          </p>
        </section>
      </MarketingWidth>

      <MarketingFooter note="Your words stay yours. Export everything, any time." />
    </div>
  );
}
