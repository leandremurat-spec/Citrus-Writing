/**
 * The shape of a legal document, and nothing else.
 *
 * Three documents share one renderer, so they share one type. A section is an anchor plus a
 * heading plus blocks; a block is a paragraph, a list, a set-apart note, or a run of term-and-
 * detail pairs for the places where prose is the wrong shape — a retention schedule, a list of
 * who else touches the data. Those render as a description list, which is what they are.
 *
 * Deliberately not HTML strings and deliberately not Markdown, for the same reason the
 * marketing copy is neither: a document that can carry arbitrary markup is a document that can
 * break the page, and these are the pages that must not be broken. Inline formatting is the two
 * rules in `LegalText` — `*bold*` and `[a link](/somewhere)` — and an unmatched star is a star.
 */

export type LegalBlock =
  | string
  | { list: string[] }
  | { note: string }
  | { definitions: { rows: { term: string; detail: string }[] } };

export interface LegalSection {
  /** The `#anchor`, and the key the contents list links to. Keep them stable: people cite these. */
  id: string;
  heading: string;
  blocks: LegalBlock[];
}

export interface LegalDocument {
  slug: LegalSlug;
  title: string;
  /** One sentence, under the title and in the meta description. */
  summary: string;
  /**
   * The short name a footer uses.
   *
   * "Refund and Subscription Policy" is the right title at the top of the document and the
   * wrong thing to put in a row of six footer links, where it wraps and swamps its neighbours.
   * Both names are needed, so both are stored.
   */
  footerLabel: string;
  /**
   * The plain-English gist, shown in a panel above the contents.
   *
   * Not a substitute for the document and said so on the page — but the alternative is a reader
   * who agrees to something they never read, which serves nobody. GDPR Art. 12 asks for clear
   * and plain language; this is where that is taken seriously rather than claimed.
   */
  gist: string[];
  /** ISO `YYYY-MM-DD`. Rendered long-form, and it is the date the terms took effect. */
  updated: string;
  sections: LegalSection[];
}

export type LegalSlug = "terms" | "privacy" | "refunds";
