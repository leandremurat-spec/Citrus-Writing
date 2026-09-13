import type { Metadata } from "next";

import { getCurrentUser } from "@/lib/auth/session";
import { refunds } from "@/content/legal";
import { LegalPage } from "@/components/legal/legal-page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  alternates: { canonical: "/legal/refunds" },
  title: refunds.title,
  description: refunds.summary,
};

export default async function RefundsPage() {
  return <LegalPage document={refunds} user={await getCurrentUser()} />;
}
