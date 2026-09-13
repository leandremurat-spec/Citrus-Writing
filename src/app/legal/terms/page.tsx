import type { Metadata } from "next";

import { getCurrentUser } from "@/lib/auth/session";
import { terms } from "@/content/legal";
import { LegalPage } from "@/components/legal/legal-page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  alternates: { canonical: "/legal/terms" },
  title: terms.title,
  description: terms.summary,
};

export default async function TermsPage() {
  return <LegalPage document={terms} user={await getCurrentUser()} />;
}
