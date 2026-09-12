import type { MetadataRoute } from "next";

import { legalDetails } from "@/content/legal/details";
import { LEGAL_DOCUMENTS } from "@/content/legal";

/**
 * Only the pages a stranger can actually read.
 *
 * Everything else in this app is behind sign-in, so listing it would be advertising doors that
 * do not open. That leaves the marketing surfaces and the legal documents — and the legal ones
 * are worth including rather than hiding: a policy that can be found and read is part of
 * looking like a business somebody can buy from.
 *
 * `lastModified` for those comes from each document's own `updated` date, which is already
 * maintained because the pages display it. Nothing here is a second copy of anything.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const site = legalDetails.siteUrl;

  return [
    { url: site, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    { url: site + "/pricing", lastModified: new Date(), changeFrequency: "monthly", priority: 0.9 },
    { url: site + "/sign-up", lastModified: new Date(), changeFrequency: "monthly", priority: 0.7 },
    { url: site + "/legal", lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
    ...LEGAL_DOCUMENTS.map((document) => ({
      url: site + "/legal/" + document.slug,
      lastModified: new Date(document.updated),
      changeFrequency: "yearly" as const,
      priority: 0.3,
    })),
  ];
}
