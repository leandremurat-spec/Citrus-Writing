/*
 * ═══════════════════════════════════════════════════════════════════════════
 *  THE FACTS THE LEGAL PAGES STATE ABOUT YOU.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  A privacy policy is only worth having if the person it names is real and
 *  reachable. UK/EU data protection law requires the controller's identity and
 *  a contact address (UK GDPR Art. 13), and consumer law requires a trader's
 *  name and geographic address before a sale. So these are not decoration —
 *  they are the parts that make the three documents operative.
 *
 *  ── BEFORE YOU GO LIVE ───────────────────────────────────────────────────
 *
 *  The values below are filled in. `npm run legal:check` verifies none of
 *  them is still the placeholder sentinel — it runs inside `npm run build`,
 *  so a deploy cannot quietly ship a policy that names nobody. Re-run it by
 *  hand after touching anything in this file.
 *
 *  Everything else on this page is read from the code that actually does the
 *  thing being described — the plan prices come from `lib/billing/plans.ts`,
 *  the cookie name from `lib/auth/session.ts` — so the documents cannot drift
 *  away from the software the way hand-written ones do.
 */

/** The sentinel. Anything still carrying it is unfilled, and `legal:check` says so. */
export const FILL_IN = "‹fill in›";

export const legalDetails = {
  /** The product, as the documents name it. */
  product: "Citrus Writing",

  /**
   * Who the contract is *with* and who answers for the data.
   *
   * If you trade as yourself rather than through a company, this is your own name — that is
   * normal and lawful for a sole trader, and it is what has to appear.
   */
  entity: "Citrus Writing Inc.",

  /**
   * A geographic address. Required: a PO box or an email alone does not satisfy either the
   * consumer-information rules or the controller-identity rule.
   *
   * City and province rather than a street address, at the operator's request — a home street
   * address published on a public terms page is a real privacy cost for a small company with
   * no separate office, and city-level detail is what the identity rules actually ask for
   * (UK GDPR Art. 13 wants "contact details," not a street; Law 25 wants the *contact* of the
   * person responsible published, not a mailing address). Where it is thinner is the *consumer*
   * side: a Quebec or EU consumer's right to a geographic address for complaints is usually
   * read to want more than a city, so if this is ever tested there, a registered-office or
   * mailbox-service address is the safer upgrade — not a home address, just a fuller one.
   */
  address: "Montreal, Quebec",

  /** Where you are established. Sets the governing law and which regulators have a say. */
  country: "Canada",

  /**
   * The province, which is the half that actually decides things here.
   *
   * Canada legislates privacy federally (PIPEDA) and consumer protection provincially, and
   * Quebec does both: Law 25 for personal information and the Consumer Protection Act for
   * what may be sold and how. Quebec is also the reason the language note exists — see
   * `terms.ts`, "Language".
   */
  province: "Quebec",

  /** How the governing-law clause names the law. Canadian contracts name both levels. */
  governingLaw: "the laws of the Province of Quebec and the federal laws of Canada applicable in it",

  /** Where a dispute is heard, absent a consumer's own right to sue closer to home. */
  forum: "the courts of the Province of Quebec, in the judicial district of Montreal",

  /**
   * The one inbox. Privacy requests, rights requests, billing and everything else.
   *
   * Has to be an address that is actually monitored: Quebec's Law 25 requires the contact
   * details of the person responsible for personal information to be *published*, CASL
   * requires a working contact on every commercial message, and the rights sections of the
   * privacy policy are worthless pointing at an inbox nobody reads.
   */
  contactEmail: "citruswritinginc@gmail.com",

  /**
   * The title published as the person responsible for protecting personal information.
   *
   * Law 25 requires this to be public. By default the role sits with the person having the
   * highest authority in the enterprise; it can be delegated in writing, and publishing a
   * title plus a contact address is what satisfies the requirement. Naming the individual is
   * better practice once there is more than one person to confuse.
   */
  privacyOfficerTitle: "Privacy Officer",

  /**
   * The site's own address, used in the documents and for the canonical links.
   * Change it when the real domain is in front of the deployment.
   */
  siteUrl: "https://citruswritinglab.com",

  /** The session cookie, named here so the privacy page names the real one. */
  sessionCookie: "cw_session",

  /** Browser storage keys. Preferences about a screen; they never leave the device. */
  deviceStorageKeys: ["pith:appearance", "pith:panel-sizes", "pith:panels-open", "citrus:palette"],

  /** How long a signed-in session lasts before it must be renewed. */
  sessionDays: 30,
} as const;

/**
 * Everyone outside this app that a writer's data reaches, why, and what they hold.
 *
 * Named individually rather than as "trusted partners", which is the phrase a privacy policy
 * uses when it does not want to be specific. A reader cannot assess a risk they are not
 * allowed to see, and a list this short is worth showing.
 */
export const subprocessors = [
  {
    name: "Supabase",
    role: "The Postgres database. Every account and every manuscript is stored here.",
    data: "Account details, all written work, writing history, billing identifiers.",
  },
  {
    name: "Railway",
    role: "Runs the application itself.",
    data: "Whatever passes through a request while it is being served. Nothing is stored here.",
  },
  {
    name: "Stripe",
    role: "Takes the payment, holds the card, runs the subscription and the billing portal.",
    data: "Name, email, card details, billing address, payment history. Card details are entered directly into Stripe and never reach us.",
  },
  {
    name: "Resend",
    role: "Sends the password-reset email, and the stale-chapter nudge if you asked for it.",
    data: "Your email address and the text of that message.",
  },
  {
    name: "Plausible Analytics",
    role: "Counts page views so we know which parts of the site are used. No cookies, no profile, no cross-site identifier.",
    data: "The page you viewed, roughly where in the world you are, and what kind of browser and device you used. Nothing that identifies you, and nothing tied to your account.",
  },
  {
    name: "Google / GitHub",
    role: "Only if you choose “continue with” one of them instead of a password.",
    data: "They tell us your account id, your email address and whether it is verified. We tell them nothing.",
  },
] as const;

export type Subprocessor = (typeof subprocessors)[number];
