import type { Metadata } from "next";
import Link from "next/link";

import { getCurrentUser } from "@/lib/auth/session";
import type { PlanId } from "@/lib/billing/plans";
import { Button } from "@/components/ui/button";
import { MarketingFooter, MarketingNav, MarketingWidth } from "@/components/marketing/marketing-chrome";
import { PricingPlans } from "@/components/marketing/pricing-plans";
import { pricing } from "@/content/site-copy";

/**
 * The pricing page.
 *
 * Words come from `src/content/site-copy.ts`; the *numbers* do not — the plan cards read the real
 * prices and limits from `lib/billing/plans.ts`, which is the same object the server enforces.
 * That split is the whole point: copy that can be edited freely cannot make the page advertise a
 * price the checkout will not charge.
 *
 * Two plans where the handoff drew three. Studio's five seats need shared novels, per-seat
 * permissions and chapter comments — none of which exist — and a plan that cannot be delivered
 * does not belong on a pricing page.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: pricing.meta.title,
  description: pricing.meta.description,
};

export default async function PricingPage() {
  const user = await getCurrentUser();

  return (
    <div className="min-h-dvh overflow-x-clip bg-background text-foreground [text-wrap:pretty]">
      <MarketingNav user={user} />

      <MarketingWidth>
        <section className="relative isolate pt-10 pb-7 sm:pt-14 sm:pb-9 lg:pt-19 lg:pb-11">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -top-65 -z-10 size-100 rounded-full bg-ochre-200 right-[min(0px,calc(50vw-760px))]"
          />

          <h1 className="-ml-[0.028em] font-heading text-[clamp(2.375rem,5vw,4rem)] leading-[1.08]">
            <span className="block">{pricing.hero.headlineLine1}</span>
            <span className="block">{pricing.hero.headlineLine2}</span>
          </h1>
          <p className="mt-6.5 max-w-[52ch] text-[clamp(1rem,1.4vw,1.125rem)] leading-[1.65] text-neutral-800">
            {pricing.hero.intro}
          </p>

          <PricingPlans currentPlan={user ? (user.plan as PlanId) : null} />
        </section>

        {/* ------------------------------------------------------ comparison */}
        <section className="pb-8 sm:pb-11 lg:pb-13">
          <h2 className="mb-4.5 font-heading text-[clamp(1.5rem,2.4vw,1.875rem)] leading-[1.2]">
            {pricing.comparison.heading}
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] border-collapse text-sm">
              <thead>
                <tr>
                  <th scope="col" className="label-eyebrow border-b border-divider p-2.5 text-left">
                    &nbsp;
                  </th>
                  <th scope="col" className="label-eyebrow border-b border-divider p-2.5 text-left whitespace-nowrap">
                    Drawer
                  </th>
                  <th scope="col" className="label-eyebrow border-b border-divider p-2.5 text-left whitespace-nowrap">
                    Serial
                  </th>
                </tr>
              </thead>
              <tbody>
                {pricing.comparison.rows.map((row) => (
                  <tr key={row.label} className="transition-colors duration-tint ease-state hover:bg-muted/50">
                    <th scope="row" className="border-b border-edge p-2.5 text-left font-semibold">
                      {row.label}
                    </th>
                    <td
                      className={
                        row.drawer === "—" ? "border-b border-edge p-2.5 text-subtle" : "border-b border-edge p-2.5"
                      }
                    >
                      {row.drawer}
                    </td>
                    <td className="border-b border-edge p-2.5">{row.serial}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ------------------------------------------------------------- faq */}
        <section className="pb-8 sm:pb-11 lg:pb-13">
          <h2 className="font-heading text-[clamp(1.5rem,2.4vw,1.875rem)] leading-[1.2]">{pricing.faq.heading}</h2>
          <div className="mt-5.5 grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-3.5 sm:gap-5.5">
            {pricing.faq.items.map((item) => (
              <div key={item.question}>
                <h3 className="font-heading text-[1.1875rem] leading-[1.25]">{item.question}</h3>
                <p className="mt-2.5 text-[0.9375rem] leading-[1.6] text-neutral-800">{item.answer}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ------------------------------------------------------------- cta */}
        <section className="pb-8 sm:pb-11 lg:pb-13">
          <div className="rounded-[3.5rem] bg-ochre-100 px-6 py-7 sm:px-10 sm:py-10 lg:px-16 lg:py-13">
            <h2 className="font-heading text-[clamp(1.5rem,2.4vw,1.875rem)] leading-[1.2] text-ochre-900">
              {pricing.closing.heading}
            </h2>
            <p className="mt-5 max-w-[54ch] text-[0.96875rem] leading-[1.65] text-ochre-900">{pricing.closing.body}</p>
            <div className="mt-6.5 flex flex-wrap gap-3">
              <Button
                render={<Link href={user ? "/library" : "/sign-up"} />}
                nativeButton={false}
                className="h-11.5 bg-ochre px-6 text-[0.9375rem] text-background hover:bg-ochre-600"
              >
                {user ? pricing.closing.primaryCtaSignedIn : pricing.closing.primaryCta}
              </Button>
              <Button
                variant="outline"
                render={<Link href="/" />}
                nativeButton={false}
                className="h-11.5 border-ochre-600 bg-transparent px-5.5 text-[0.9375rem] text-ochre-900 hover:bg-ochre-200"
              >
                {pricing.closing.secondaryCta}
              </Button>
            </div>
          </div>
        </section>
      </MarketingWidth>

      <MarketingFooter note={pricing.footerNote} />
    </div>
  );
}
