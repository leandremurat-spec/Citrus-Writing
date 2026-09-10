import type { Metadata } from "next";
import Link from "next/link";

import { AuthWordmark } from "@/components/auth/auth-parts";
import { ResetForm } from "@/components/auth/reset-forms";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Set a new password" };

/**
 * The far end of the reset link.
 *
 * The token is not checked here, only its presence. Verifying it on render would mean either
 * consuming it (so a refresh breaks the page) or leaking whether it is valid before anyone has
 * chosen a password. `completePasswordReset` is where it is redeemed, once, atomically.
 */
export default async function ResetPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;

  return (
    <main className="relative isolate flex min-h-dvh flex-col items-center justify-center gap-8 bg-[radial-gradient(46%_32%_at_50%_0%,var(--press-200),transparent_72%)] px-5 py-10 sm:px-10 lg:py-22">
      <AuthWordmark />
      {token ? (
        <ResetForm token={token} />
      ) : (
        <div className="w-full max-w-[440px] text-center">
          <h1 className="font-heading text-3xl leading-tight">That link is incomplete</h1>
          <p className="mt-3 text-[0.96875rem] leading-[1.6] text-neutral-800">
            Reset links carry a one-time token. Ask for a fresh one and open it straight from the email.
          </p>
          <Link
            href="/forgot"
            className="focus-ring mt-6 inline-flex h-11 items-center rounded-full bg-press px-5 text-sm text-press-foreground hover:bg-press-600"
          >
            Send a new link
          </Link>
        </div>
      )}
    </main>
  );
}
