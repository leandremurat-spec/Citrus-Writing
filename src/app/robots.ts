import type { MetadataRoute } from "next";

import { legalDetails } from "@/content/legal/details";

/**
 * What a crawler may look at.
 *
 * The disallow list is not about secrecy — every one of those routes already refuses an
 * unauthenticated request, and `/account` and the workspace redirect to sign-in. It is about
 * not spending a crawler's budget on redirects, and not having Google index a sign-in page as
 * though it were the product.
 *
 * `/api` is listed for the same reason: nothing there returns a page, and the webhook returns
 * 400 to anything unsigned.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/account", "/library", "/novels/", "/checkout", "/reset", "/forgot"],
    },
    sitemap: legalDetails.siteUrl + "/sitemap.xml",
  };
}
