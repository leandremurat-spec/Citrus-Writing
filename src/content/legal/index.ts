import type { LegalDocument, LegalSlug } from "./document";
import { privacy } from "./privacy";
import { refunds } from "./refunds";
import { terms } from "./terms";

export type { LegalBlock, LegalDocument, LegalSection, LegalSlug } from "./document";
export { legalDetails, subprocessors, FILL_IN } from "./details";
export { privacy, refunds, terms };

/**
 * The three documents, in the order they are offered everywhere: the footer, the index page,
 * and the contents list. One array, so a fourth document is added in one place rather than in
 * four — which is how the six section labels this app already had to unify got out of step.
 */
export const LEGAL_DOCUMENTS: readonly LegalDocument[] = [terms, privacy, refunds];

export const LEGAL_BY_SLUG: Record<LegalSlug, LegalDocument> = {
  terms,
  privacy,
  refunds,
};

/** `/legal/privacy`, and so on. The one place a legal URL is spelled. */
export function legalHref(slug: LegalSlug): string {
  return `/legal/${slug}`;
}

/**
 * "11 September 2026" — the long form, unambiguous in every country that reads this page.
 *
 * A numeric date is the one format to avoid here: 09/11/2026 is two different days depending on
 * which side of the Atlantic the reader is on, and "when did these terms change" is a question
 * whose answer must not depend on that.
 */
export function formatLegalDate(iso: string): string {
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
