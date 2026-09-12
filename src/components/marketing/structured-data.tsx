import { legalDetails } from "@/content/legal/details";
import { everyCurrency, PLANS, priceCents } from "@/lib/billing/plans";

/**
 * JSON-LD describing the product, for search results.
 *
 * The point of this is the `offers` block: it is what lets a search result carry a price, and a
 * result with a price attached is qualified traffic — someone who clicks it has already decided
 * the number is acceptable. Without it, a search engine has to guess, and often guesses nothing.
 *
 * **Every figure comes from `plans.ts`**, the same object the checkout enforces against, for the
 * reason that rule exists everywhere else in this app: a price that is advertised and not
 * charged is a misrepresentation, and structured data is advertising that outlives the page it
 * sits on — Google caches it, and it can be shown long after the page changed.
 *
 * Deliberately **not** marked up with `aggregateRating` or `review`. There are no reviews yet,
 * and inventing them is both a policy violation and the kind of thing that is very hard to walk
 * back once it has been indexed.
 */
export function StructuredData() {
  const site = legalDetails.siteUrl;

  const offers = everyCurrency().flatMap((currency) =>
    (["monthly", "yearly"] as const).map((interval) => ({
      "@type": "Offer",
      name: `Serial — billed ${interval}`,
      price: (priceCents("SERIAL", interval, currency) / 100).toFixed(2),
      priceCurrency: currency.toUpperCase(),
      availability: "https://schema.org/InStock",
      url: site + "/pricing",
    })),
  );

  const data = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Citrus Writing",
    applicationCategory: "BusinessApplication",
    applicationSubCategory: "Writing software",
    operatingSystem: "Web",
    url: site,
    description:
      "A writing and publishing workspace for webnovel and serial fiction authors: chapters, arcs, a release buffer, a codex and clean export.",
    inLanguage: "en",
    publisher: {
      "@type": "Organization",
      name: legalDetails.entity,
      url: site,
    },
    offers: [
      {
        "@type": "Offer",
        name: PLANS.DRAWER.name,
        price: "0",
        priceCurrency: "USD",
        availability: "https://schema.org/InStock",
        url: site + "/pricing",
        description: `${PLANS.DRAWER.tagline} Free forever, one serial.`,
      },
      ...offers,
    ],
    featureList: [
      "Chapter-based manuscript with volumes and arcs",
      "Release schedule with runway and pace",
      "Codex of characters, locations and items with @mentions",
      "Version history for every chapter",
      "Export to HTML, Markdown and plain text",
    ],
  };

  return (
    <script
      type="application/ld+json"
      // A fixed object built from this app's own data — no user input reaches it. The escape is
      // belt and braces against a future edit that forgets that.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\u003c") }}
    />
  );
}
