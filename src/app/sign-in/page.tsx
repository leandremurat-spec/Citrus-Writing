import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { availableProviders } from "@/lib/auth/oauth";
import { safeNext } from "@/lib/auth/safe-next";
import { getCurrentUser } from "@/lib/auth/session";
import { AuthWordmark } from "@/components/auth/auth-parts";
import { SignInForm } from "@/components/auth/sign-in-form";
import { signIn as copy } from "@/content/site-copy";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: copy.meta.title };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const user = await getCurrentUser();
  const { next, error } = await searchParams;
  const destination = safeNext(next, "/library");

  // Already signed in and arriving here by hand: go where they were headed. Not done when the
  // URL carries an `error`, because that means the OAuth callback just bounced them back and
  // they need to see why.
  if (user && !error) redirect(destination);

  return (
    <main className="relative isolate flex min-h-dvh items-center justify-center bg-[radial-gradient(46%_32%_at_50%_0%,var(--press-200),transparent_72%)] px-5 py-10 sm:px-10 lg:px-[72px] lg:py-22">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-45 -z-10 size-105 rounded-full bg-ochre-100 left-[min(-120px,calc(-50vw+40px))]"
      />

      <div className="w-full max-w-[440px]">
        <AuthWordmark />

        <h1 className="mt-6.5 -ml-[0.028em] font-heading text-[clamp(1.875rem,3.4vw,2.5rem)] leading-[1.1]">
          {copy.headline}
        </h1>

        <div className="mt-6.5">
          <SignInForm providers={availableProviders()} next={destination} oauthError={error} />
        </div>

        <p className="mt-5 text-2xs leading-relaxed text-subtle">
          {copy.noAccount}{" "}
          <Link href="/sign-up" className="focus-ring rounded-full text-press hover:text-press-800">
            {copy.noAccountLink}
          </Link>{" "}
          {copy.noAccountTail}
        </p>
      </div>
    </main>
  );
}
