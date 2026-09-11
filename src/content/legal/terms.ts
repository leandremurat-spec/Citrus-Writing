import type { LegalDocument } from "./document";
import { legalDetails } from "./details";

/**
 * The terms of service.
 *
 * Rewritten to mirror Novlr's own terms — a real, standard, business-first SaaS agreement
 * rather than the more elaborate consumer-protection drafting this file carried before. That
 * earlier version reasoned every clause up from first principles (a statutory withdrawal
 * right, a French-language obligation, a notice-before-suspension promise) and the result was
 * heavier than a small app's terms need to be. Novlr's shape — flat, standard, "all sales
 * final," terminate with or without cause, a hard liability cap — is the one asked for here,
 * and it is a live document from a comparable writing tool rather than a guess at one.
 *
 * What still differs from a literal copy, and why:
 *
 * - No "Novlr Sites" section. That is a public-site-hosting feature this app does not have;
 *   mirroring the *shape* of working terms does not mean inventing a feature to write terms
 *   for. Sections 5 and 6 of Novlr's own terms (visitor responsibility, links to other sites)
 *   are the same kind of omission — they answer to a blog and embedded third-party content
 *   this app's marketing pages do not carry.
 * - The account section asks for what sign-up actually collects — pen name and email — rather
 *   than the "legal full name" Novlr's form asks for. A term describing a field the form does
 *   not have is a term nobody can comply with.
 * - `your-work` keeps its own identity rather than folding into Novlr's shorter "Adding content
 *   to your project" clause. The "we will never publish, license or train on it" promise is
 *   this product's actual differentiator and is true of the code today (see CLAUDE.md, "Your
 *   fiction, specifically"); trimming it back to match Novlr's more generic wording would lose
 *   the one sentence a novelist actually reads this document to find.
 * - Governing law is Quebec, because that is where the entity in `details.ts` actually is —
 *   Novlr's own clause names the UK for the same reason, being a UK company.
 *
 * ── The tone pass ─────────────────────────────────────────────────────────────
 *
 * Termination and account closure kept every right Novlr's version gives an operator — end an
 * account without notice, refuse a refund on the general rule, discretion over content removal
 * — and reworded only how those are said. "With or without cause, with or without notice" is
 * accurate and cold; "a last resort we keep in reserve, not a habit" is the same discretion,
 * read as an actual policy rather than a threat. Nothing here promises a notice period, a cure
 * window, or a refund the operative clauses do not already give — a forgiving *tone* is not a
 * forgiving *term*, and this file does not pretend otherwise.
 */

const { product, entity, address, country, contactEmail, siteUrl } = legalDetails;

export const terms: LegalDocument = {
  slug: "terms",
  title: "Terms of Service",
  summary: `The agreement between you and ${product}: what you may expect from us, and what we ask of you.`,
  footerLabel: "Terms",
  updated: "2026-09-11",

  gist: [
    "Your words are your words. You own them. We don't — we're just a writing tool.",
    "One account per person. Keep your password to yourself; you're responsible for what happens under it.",
    "Subscriptions renew automatically until you cancel — cancelling takes one step, any day, and there is no retention call. Sales are final, but a genuine billing mistake is always made right.",
    "We keep the right to suspend or close an account and to change the service, but we treat that as a last resort, not a first move.",
    "The service is provided as is, and our liability is capped at what you paid us in the past year.",
  ],

  sections: [
    {
      id: "agreement",
      heading: "Agreement",
      blocks: [
        `These terms and conditions govern all use of ${siteUrl} and all content, services and products available through it, including the ${product} writing workspace and the site itself (together, the “Website”). The Website is owned and operated by *${entity}*, of ${address}, ${country} (“we”, “us”, “${product}”).`,
        "The Website is offered subject to your acceptance, without modification, of everything here and of the other policies we publish from time to time — including the [Privacy Policy](/legal/privacy) and the [Refund and Subscription Policy](/legal/refunds) — together, the “Agreement”.",
        "Please read this Agreement before using the Website. By accessing or using any part of it, you agree to be bound by it. If you do not agree, you may not use the Website. The Website is available only to individuals who are at least 13 years old.",
        "Seriously breaking any of the terms below can mean losing access to your account — we would rather that never comes up, and for almost everyone it never will.",
      ],
    },

    {
      id: "account",
      heading: "Your account",
      blocks: [
        "If you create an account, you are responsible for maintaining its security and for all activity that happens under it. Tell us immediately if you become aware of any unauthorised use of your account.",
        {
          list: [
            "You must be a human. Accounts registered by bots or other automated means are not permitted.",
            "You must provide a valid email address, a pen name, and any other information requested to complete sign-up.",
            "Your login may only be used by one person. A single account shared between several people is not permitted.",
            "You are responsible for keeping your password secure. We cannot and will not be liable for loss or damage from your failure to do so.",
          ],
        },
      ],
    },

    {
      id: "your-work",
      heading: "Your work is yours",
      blocks: [
        "Let's be clear about this one before anything else: your words are your words. You own them. We don't. We are just a writing tool.",
        "By adding a chapter, a note or anything else to a serial, you represent and warrant that the work is yours, or that you hold whatever rights are needed to write it — that using it here will not infringe anyone else's copyright, trademark or other rights, and, if an employer might otherwise have a claim on it, that you have their permission or a waiver covering it.",
        `As long as that is true, ${product} will never publish your work, use it to train anything, or make it available to any third party, without your prior written authorisation. We store it, show it back to you, and produce the files your own export tools generate — nothing more.`,
        "If you delete a chapter or a serial, we will use reasonable efforts to remove it, but a routine backup can take a short time to catch up.",
        "On the rare occasion it is genuinely needed, we may remove content we reasonably believe is unlawful or otherwise objectionable, or suspend or end access to the Website — that is a discretion we keep rather than one we reach for. It does not carry a promise to refund what has already been paid.",
      ],
    },

    {
      id: "plans",
      heading: "Payment and renewal",
      blocks: [
        `Drawer is free. Serial is an optional paid Subscription, billed monthly or yearly as you choose. By subscribing you agree to pay the fee shown for that plan, charged on a pre-pay basis for the period it covers.`,
        "Unless you cancel before the end of the current period, your Subscription renews automatically, and you authorise us to charge the then-current fee — plus any applicable tax — to the card on file. You can cancel at any time from your account page; cancelling stops the *next* renewal, and you keep the plan through the period you have already paid for.",
        "*Subscription fees are not refundable*, though we would always rather make a genuine mistake right than hide behind that sentence — see the [Refund and Subscription Policy](/legal/refunds), which is part of this Agreement, for price, cancellation, and exactly what happens to your work if a Subscription lapses.",
      ],
    },

    {
      id: "copyright",
      heading: "Copyright infringement",
      blocks: [
        `As we ask others to respect our intellectual property, we respect the intellectual property of others. If you believe material on the Website infringes your copyright, notify us at [${contactEmail}](mailto:${contactEmail}). We will respond to a valid notice, including by removing the material where appropriate, and we will terminate the access of a user determined to be a repeat infringer.`,
      ],
    },

    {
      id: "our-ip",
      heading: "Our intellectual property",
      blocks: [
        `This Agreement does not transfer to you any of our intellectual property, or any third party's. All right, title and interest in the Website — the software, the design, the ${product} name and marks — remains with us. Your use of the Website grants you no licence to reproduce or otherwise use any of it.`,
      ],
    },

    {
      id: "changes",
      heading: "Changes",
      blocks: [
        "We may modify or replace this Agreement at any time, at our discretion. It is your responsibility to check it periodically. Continuing to use the Website after a change is posted is your acceptance of it.",
      ],
    },

    {
      id: "termination",
      heading: "Termination",
      blocks: [
        "If it is ever genuinely necessary, we may end an account without advance notice — but that is a last resort we keep in reserve, not a habit, and in practice it is almost always because something in the conduct or content rules above has gone wrong, not because we are looking for a reason. If you would rather leave on your own terms, closing your account from your account page does it in one step, or you can simply stop using the Website.",
        "Every provision of this Agreement that by its nature ought to survive termination does — ownership, warranty disclaimers, indemnification and the limitation of liability among them.",
      ],
    },

    {
      id: "warranty",
      heading: "Disclaimer of warranties",
      blocks: [
        "The Website is provided “as is”. We disclaim all warranties of any kind, express or implied, including the implied warranties of merchantability, fitness for a particular purpose and non-infringement. We do not warrant that the Website will be error-free or that access to it will be uninterrupted.",
      ],
    },

    {
      id: "liability",
      heading: "Limitation of liability",
      blocks: [
        `In no event will we, or our suppliers and licensors, be liable for any special, incidental or consequential damages, for the cost of procuring substitute services, or for interruption of use or loss or corruption of data — or, in any case, for more than the fees you paid us in the twelve months before the event giving rise to the claim. This applies to the fullest extent the law allows.`,
      ],
    },

    {
      id: "warranty-representation",
      heading: "Your representations",
      blocks: [
        "You represent and warrant that your use of the Website will comply with the Privacy Policy, this Agreement and all applicable laws, and that it will not infringe or misappropriate any third party's intellectual property.",
      ],
    },

    {
      id: "indemnity",
      heading: "Indemnification",
      blocks: [
        "You agree to indemnify and hold us, our contractors and our licensors, and our respective directors, officers, employees and agents, harmless from any claims and expenses — including reasonable legal fees — arising out of your use of the Website, including any breach of this Agreement.",
      ],
    },

    {
      id: "general",
      heading: "Miscellaneous",
      blocks: [
        `This Agreement constitutes the entire agreement between us concerning the Website, and may only be modified by a written amendment or by our posting of a revised version. Except where applicable law requires otherwise, it is governed by ${legalDetails.governingLaw}, and the proper venue for any dispute is ${legalDetails.forum}.`,
        "If any part of this Agreement is held invalid or unenforceable, the rest remains in force. A waiver of any term, in any one instance, does not waive that term or any later breach of it. You may not assign your rights under this Agreement without our consent; we may assign ours without condition. This Agreement binds and benefits both parties and their successors and permitted assigns.",
        {
          note: `We are established in ${legalDetails.province}, where the Charter of the French Language requires a contract of this kind to be available in French. A French version is being prepared; ask us for it at any time.`,
        },
      ],
    },
  ],
};
