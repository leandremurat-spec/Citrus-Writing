import type { Metadata } from "next";

import { getCurrentUser } from "@/lib/auth/session";
import { privacy } from "@/content/legal";
import { LegalPage } from "@/components/legal/legal-page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: privacy.title,
  description: privacy.summary,
};

export default async function PrivacyPage() {
  return <LegalPage document={privacy} user={await getCurrentUser()} />;
}
