import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Check } from "lucide-react";

import { availableProviders } from "@/lib/auth/oauth";
import { getCurrentUser } from "@/lib/auth/session";
import { safeNext } from "@/lib/auth/safe-next";
import { AuthWordmark } from "@/components/auth/auth-parts";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { signUp as copy } from "@/content/site-copy";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: copy.meta.title };

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect("/library");

  const { next } = await searchParams;
  const destination = safeNext(next, "/library");

  return (
    <main className="relative isolate grid min-h-dvh grid-cols-[repeat(auto-fit,minmax(320px,1fr))] items-center gap-7 px-5 py-8 sm:gap-12 sm:px-10 lg:gap-20 lg:px-[72px] lg:py-18">
      {/* The handoff's sage disc, bleeding off the top-right corner. Decorative and behind
          everything, so it is aria-hidden and z-negative rather than a background image. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -top-50 -z-10 size-100 rounded-full bg-ochre-200 right-[min(-60px,calc(50vw-700px))]"
      />

      <div className="min-w-0 max-w-[38rem]">
        <AuthWordmark />

        <h1 className="mt-6.5 -ml-[0.028em] font-heading text-[clamp(2.125rem,4.2vw,3.375rem)] leading-[1.08] sm:mt-8 lg:mt-10.5">
          <span className="block">{copy.headlineLine1}</span>
          <span className="block">{copy.headlineLine2}</span>
        </h1>
        <p className="mt-5.5 max-w-[46ch] text-base leading-[1.65] text-neutral-800">{copy.intro}</p>

        <ul className="mt-6 flex list-none flex-col gap-3.5 p-0 lg:mt-9">
          {copy.promises.map((promise) => (
            <li key={promise} className="flex items-start gap-3">
              <span className="flex size-8.5 flex-none items-center justify-center rounded-full bg-ochre-100 text-ochre-800">
                <Check className="size-4.5" strokeWidth={2.75} />
              </span>
              <span className="min-w-0 flex-1 text-[0.9375rem] leading-[1.55]">{promise}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="min-w-0 justify-self-stretch lg:max-w-[34rem] lg:justify-self-end">
        <SignUpForm providers={availableProviders()} next={destination} />
      </div>
    </main>
  );
}
