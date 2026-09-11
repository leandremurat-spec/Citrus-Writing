/**
 * Checks the three legal documents for the two ways they can be quietly wrong.
 * Run: npm run legal:check
 *
 * It runs ahead of `npm run build`, because both faults are invisible on the page and fatal in
 * substance — a policy that names nobody is not a policy, and a cross-reference that lands on
 * nothing is a clause the reader cannot follow.
 *
 * 1. PLACEHOLDERS. `content/legal/details.ts` names the values only the operator can fill in —
 *    the legal entity, its address, its country and a contact address. Data protection law
 *    requires the first three (the controller's identity, and a geographic address) and the
 *    rights sections are worthless without the fourth. This fails while any is still the
 *    `FILL_IN` sentinel, and guards against a *future* field regressing to it too.
 *
 * 2. DEAD CROSS-REFERENCES. The documents link to each other by `[label](/legal/slug#anchor)`,
 *    and anchors get renamed. Every internal link is resolved against the real section ids here,
 *    so a rename that breaks one is caught by a script rather than by a reader.
 */
import { LEGAL_DOCUMENTS, legalDetails, FILL_IN, type LegalBlock } from "../src/content/legal";

const failures: string[] = [];

/* ------------------------------------------------------------------ placeholders --- */

const REQUIRED: { key: keyof typeof legalDetails; what: string }[] = [
  { key: "entity", what: "the legal name of whoever the contract is with" },
  { key: "address", what: "a geographic address — a PO box or an email does not satisfy the rule" },
  { key: "country", what: "where you are established; it sets the governing law" },
  { key: "contactEmail", what: "the inbox that answers rights, billing and everything else" },
];

for (const { key, what } of REQUIRED) {
  // Cast to string: once every field is filled in, `legalDetails` (as const) types each one
  // as its own literal, and TS correctly flags a literal-vs-placeholder comparison as having
  // no overlap. That narrowing is exactly right for the app's own code, which should never be
  // able to see a placeholder value in a type — but this script's job is to check for the
  // placeholder having survived, including a future field that regresses to one, so it reads
  // the value as a plain string rather than trusting the type not to lie to it.
  if ((legalDetails[key] as string) === FILL_IN) {
    failures.push(`details.ts → ${key} is still the placeholder. Set ${what}.`);
  }
}

/* ------------------------------------------------------------------ dead anchors --- */

/** Every `#anchor` that exists, as `/legal/slug#anchor`, plus the bare `/legal/slug`. */
const anchors = new Set<string>();
for (const document of LEGAL_DOCUMENTS) {
  anchors.add(`/legal/${document.slug}`);
  for (const section of document.sections) {
    anchors.add(`/legal/${document.slug}#${section.id}`);
  }
}

/** The routes a legal document is allowed to point at outside the legal set. */
const KNOWN_ROUTES = new Set(["/account", "/pricing", "/library", "/sign-in", "/sign-up", "/legal"]);

const LINK = /\[[^\]]+\]\(([^)]+)\)/g;

function strings(block: LegalBlock): string[] {
  if (typeof block === "string") return [block];
  if ("list" in block) return block.list;
  if ("note" in block) return [block.note];
  return block.definitions.rows.flatMap((row) => [row.term, row.detail]);
}

for (const document of LEGAL_DOCUMENTS) {
  const seen = new Set<string>();

  for (const section of document.sections) {
    if (seen.has(section.id)) {
      failures.push(`${document.slug} → two sections share the id "${section.id}"; anchors must be unique.`);
    }
    seen.add(section.id);

    for (const text of section.blocks.flatMap(strings)) {
      for (const match of text.matchAll(LINK)) {
        const href = match[1];
        if (!href.startsWith("/")) continue; // external and mailto: are not ours to verify.
        const [route] = href.split("#");
        if (anchors.has(href) || KNOWN_ROUTES.has(route)) continue;
        failures.push(`${document.slug}#${section.id} → link to ${href} does not resolve.`);
      }
    }
  }

  if (document.gist.length === 0) {
    failures.push(`${document.slug} → has no plain-English summary.`);
  }
  if (Number.isNaN(Date.parse(document.updated))) {
    failures.push(`${document.slug} → "updated" is not a date: ${document.updated}`);
  }
}

/* ------------------------------------------------------------------------ report --- */

if (failures.length > 0) {
  console.error(`\nLegal check failed — ${failures.length} problem${failures.length === 1 ? "" : "s"}:\n`);
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  console.error("");
  process.exit(1);
}

const sections = LEGAL_DOCUMENTS.reduce((total, document) => total + document.sections.length, 0);
console.log(`Legal check passed — ${LEGAL_DOCUMENTS.length} documents, ${sections} sections, every link resolves.`);
