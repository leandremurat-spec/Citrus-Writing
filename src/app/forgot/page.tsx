import type { Metadata } from "next";

import { ForgotForm } from "@/components/auth/reset-forms";
import { AuthWordmark } from "@/components/auth/auth-parts";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Forgotten password" };

export default function ForgotPage() {
  return (
    <main className="relative isolate flex min-h-dvh flex-col items-center justify-center gap-8 bg-[radial-gradient(46%_32%_at_50%_0%,var(--press-200),transparent_72%)] px-5 py-10 sm:px-10 lg:py-22">
      <AuthWordmark />
      <ForgotForm />
    </main>
  );
}
