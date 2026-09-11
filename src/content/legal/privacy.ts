import type { LegalDocument } from "./document";
import { legalDetails, subprocessors } from "./details";

/**
 * The privacy policy.
 *
 * Written against what this codebase actually does, not against a template. Every factual claim
 * below is one someone could check by reading the source, and several are unusual enough to be
 * worth stating plainly: there is no analytics of any kind, the fonts are self-hosted so no
 * request leaves for Google, session rows carry no IP address or user agent, and the one cookie
 * is strictly necessary — which is why this app shows no cookie banner and does not need one.
 *
 * The rights section grants GDPR-grade rights to everybody rather than only to readers who
 * happen to live somewhere that mandates them. That is a deliberate choice for a product sold
 * internationally: two tiers of privacy right, sorted by the reader's address, is both more work
 * to build and worse to be on the wrong side of.
 */

const { product, contactEmail, sessionCookie, sessionDays, deviceStorageKeys } = legalDetails;

export const privacy: LegalDocument = {
  slug: "privacy",
  title: "Privacy Policy",
  summary: `What ${product} stores about you, why, who else sees it, and how to get it back or get rid of it.`,
  footerLabel: "Privacy",
  updated: "2026-09-11",

  gist: [
    "Your fiction is yours. It is never used to train a model, never sold, and never shown to anyone you have not shown it to.",
    "There is no analytics, no advertising and no tracking in this app. Not a lighter version of it — none.",
    "One cookie, and all it remembers is that you are signed in. That is why you were never asked to accept anything.",
    "You can export everything you have written at any time, and deleting your account really does delete it.",
    "We are in Montreal, and the servers holding your work are not — they are in the United States. Every company that touches it is named further down.",
  ],

  sections: [
    {
      id: "who-we-are",
      heading: "Who we are",
      blocks: [
        `${product} is operated by *${legalDetails.entity}*, of ${legalDetails.address}, ${legalDetails.country}. We are the ones who decide what is collected and why, and the ones answerable for it — the *controller* in European terms, the organisation *having custody* of the information in Quebec's.`,
        `We are established in ${legalDetails.province}, so Canada's federal Personal Information Protection and Electronic Documents Act (PIPEDA) and Quebec's Law 25 both apply to us. Because ${product} is sold internationally, this policy also gives every writer the rights the UK and EU GDPR grant, wherever they live — see [Your rights](/legal/privacy#your-rights).`,
        `Our *${legalDetails.privacyOfficerTitle}* is responsible for protecting the personal information described here, as Law 25 requires, and is reachable at [${contactEmail}](mailto:${contactEmail}). That is the same address as everything else on this page: privacy requests are not routed anywhere different from ordinary mail.`,
      ],
    },

    {
      id: "what-we-collect",
      heading: "What we collect",
      blocks: [
        "Four kinds of thing, and it is a short list because the app asks for very little.",
        {
          definitions: {
            rows: [
              {
                term: "Your account",
                detail:
                  "An email address, a pen name, and — if you set one — a password, stored only as a scrypt hash that cannot be turned back into the password. If you sign in with Google or GitHub instead, we store the account id they give us rather than a password.",
              },
              {
                term: "What you write",
                detail:
                  "Your serials: chapters, titles, notes, codex entries, the ties between them, and the earlier versions of a chapter the app keeps automatically so that a bad afternoon is recoverable.",
              },
              {
                term: "Your writing history",
                detail:
                  "Word counts per day and per serial, the daily goal and sweet-spot range you set, and your streak. This is what the progress panel draws. It describes your work, not you.",
              },
              {
                term: "Billing",
                detail:
                  "If you subscribe: a Stripe customer id, a subscription id, which plan you are on and when it renews. We do not store your card — see “Payments” below.",
              },
            ],
          },
        },
        {
          note: "What we do not collect is worth saying too. No IP address is written to your session record, no device fingerprint, no browsing history across other sites, no location, and nothing about you bought from a data broker.",
        },
      ],
    },

    {
      id: "your-fiction",
      heading: "Your fiction, specifically",
      blocks: [
        "This is the part that matters most in a writing app, so it gets its own section rather than a clause buried in the middle of another one.",
        {
          list: [
            "*Your work is never used to train a model.* Not ours, not anyone else's, on any plan, with no setting to check and no exception for “anonymised” or “aggregated” text. There is no model reading your manuscript.",
            "*It is never sold, licensed, rented or shared* with anyone for any purpose of theirs.",
            `*Nobody at ${product} reads it casually.* Access to the database is limited to what is needed to run the service, and a person would look at the content of your chapters only where you have asked us to — you report a bug we cannot reproduce without looking — or where the law compels it. In the second case we will tell you unless we are forbidden to.`,
            "*You can take it out whenever you like.* Export gives you your text as HTML, Markdown or plain text, and nothing about that depends on you still paying us.",
          ],
        },
        "You keep every intellectual property right in what you write. We acquire no ownership of it. The narrow permission you do give us — to store it, show it back to you and produce your exports — is set out in the [Terms of Service](/legal/terms#your-work), and it exists only so that displaying your own chapter to you is not a breach of your copyright.",
      ],
    },

    {
      id: "why",
      heading: "Why we hold it, and on what basis",
      blocks: [
        "Canadian law asks us to name the purposes we collect information for and to limit ourselves to them; UK and EU law asks for a lawful basis on top of that. Both answers are in the same table, and there is no fifth purpose hiding behind a phrase like “business purposes”.",
        {
          definitions: {
            rows: [
              {
                term: "To run the service",
                detail:
                  "Keeping your account, storing and returning what you write, counting words, keeping versions. Basis: performance of our contract with you. Without this data there is no product.",
              },
              {
                term: "To take payment",
                detail:
                  "Processing a subscription, renewing it, ending it. Basis: performance of our contract, and our legal obligation to keep tax and accounting records.",
              },
              {
                term: "To keep the service secure",
                detail:
                  "Session handling and preventing abuse. Basis: our legitimate interest in a service that is not broken into, weighed against the very small amount of data it takes to do it.",
              },
              {
                term: "To email you a nudge",
                detail:
                  "The “a chapter has sat untouched” note, if you ticked the box. Basis: your consent, which you can withdraw at any time from your account page or by replying to say so.",
              },
            ],
          },
        },
        `There is no marketing basis in that list because there is no marketing email. Subscribing to ${product} does not put you on a list, and there is nothing to unsubscribe from.`,
        "Being exact about that last row: *we are not yet sending the stale-chapter nudge at all.* The box records your preference and nothing goes out. When it does, it will carry our name, our postal address and a way to switch it off in one press, which is what Canada's anti-spam law requires of a commercial electronic message — and you will have opted in before it arrives. The only mail we send today is the password reset, which you have to ask for each time.",
      ],
    },

    {
      id: "cookies",
      heading: "Cookies, and what your browser stores",
      blocks: [
        `One cookie. It is called *${sessionCookie}*, it holds a random token meaning “this browser is signed in”, and it is set only when you sign in. It is marked HttpOnly — so no script can read it — along with SameSite=Lax and Secure, and it expires after ${sessionDays} days.`,
        "That cookie is strictly necessary to provide a service you asked for, which is the category that does not require consent under the UK and EU e-privacy rules. That is the whole reason this site has never shown you a cookie banner: there is nothing here to consent to. No analytics cookie, no advertising cookie, no third-party tracker of any kind.",
        "The app also keeps a few preferences in your browser's own storage, which never leave your device and are never sent to us:",
        { list: deviceStorageKeys.map((key) => key) },
        "Those hold your theme, type size, page brightness and panel widths — facts about a screen rather than about you. Clearing your browser data resets them and loses nothing else.",
        "Two notes about fonts and scripts, because both are places where other sites leak data and this one does not. The typefaces are downloaded when the app is built and served from our own domain, so loading a page makes no request to Google Fonts and no IP address of yours reaches them. The only third-party script anywhere in the app is Stripe's, and it loads *on the checkout page alone* — see below.",
      ],
    },

    {
      id: "payments",
      heading: "Payments",
      blocks: [
        "Card details are typed into a form that belongs to Stripe, running inside a frame Stripe controls, and they go straight to Stripe. They do not pass through our servers and we could not store them if we wanted to. What comes back to us is a customer id, a subscription id and whether it is paid.",
        "On the checkout page, and only there, Stripe's script runs in your browser to build that form and to make the fraud checks a card payment requires. Stripe may set its own identifiers as part of that, and it acts as an independent controller for what it does with them. Their handling is covered by [Stripe's privacy policy](https://stripe.com/privacy).",
      ],
    },

    {
      id: "who-else",
      heading: "Who else touches it",
      blocks: [
        "The complete list — not a sample, and not “trusted partners”. Each is bound by a contract permitting them to process this data only in order to provide their service to us.",
        {
          definitions: {
            rows: subprocessors.map((processor) => ({
              term: processor.name,
              detail: `${processor.role} ${processor.data}`,
            })),
          },
        },
        "Beyond those, we disclose personal data only where we are legally required to — a valid court order, or a lawful demand from an authority. We will tell you if that happens to your account unless we are prohibited from telling you.",
        "If the business is ever sold or transferred, your data would move with it, and you would be told before that happened, in time to take your work out and leave if you would rather.",
      ],
    },

    {
      id: "transfers",
      heading: "Where it goes",
      blocks: [
        `We are in ${legalDetails.province}, and our providers are not. *Your information is stored and processed outside Quebec, and outside Canada — principally in the United States.* Saying so plainly is a requirement rather than a courtesy: Law 25 obliges us to inform you of it, and to have assessed before we do it that the information will receive adequate protection where it lands.`,
        "What that assessment turns on is the same short list for each provider — how sensitive the information is, what it will be used for, what the provider is contractually bound to do with it, and the legal regime it sits under. Every provider in the list above is bound by a contract permitting them to process this data only to provide their service to us.",
        "For writers in the UK and the EEA the same movement is covered by the safeguards that law provides: the UK and EU Standard Contractual Clauses and the UK Addendum, or the provider's certification under the EU–US and UK–US Data Privacy Framework, as applicable to each. Canada also holds an EU adequacy decision for commercial organisations, which is what lets your information reach us here in the first place.",
        "Ask us which safeguard applies to a particular provider and we will tell you.",
      ],
    },

    {
      id: "how-long",
      heading: "How long we keep it",
      blocks: [
        {
          definitions: {
            rows: [
              {
                term: "Your account and your work",
                detail:
                  "For as long as your account exists. If you delete it, everything goes with it immediately — see below.",
              },
              {
                term: "Sign-in sessions",
                detail: `${sessionDays} days, then the record expires and the cookie stops working. Signing out removes it straight away.`,
              },
              {
                term: "Password reset links",
                detail: "Thirty minutes, and one use. Redeeming one also ends every other session on the account.",
              },
              {
                term: "Earlier versions of a chapter",
                detail:
                  "Twenty per chapter on the free plan, and kept while you are subscribed on Serial. Deleting a chapter deletes its history with it.",
              },
              {
                term: "Billing and tax records",
                detail:
                  "For as long as tax law requires after the payment, which is typically six years. This is the one category we cannot delete on request, and the reason is a legal obligation rather than a preference.",
              },
            ],
          },
        },
      ],
    },

    {
      id: "deleting",
      heading: "Deleting your account",
      blocks: [
        "From your [account page](/account), under “Delete your account”. You are asked to type your email address, because a confirmation you can click through by accident is not a confirmation.",
        "It removes your account, every serial, every chapter and its earlier versions, your codex, your notes, your writing history, your settings and your sign-in sessions. It is immediate and it cannot be undone — there is no thirty-day grace period in which we quietly still have it. *Export anything you want to keep before you press it.*",
        "Your subscription, if you have one, ends at the same time. Billing records we are legally required to retain survive, as described above, and nothing else does.",
      ],
    },

    {
      id: "security",
      heading: "How it is protected",
      blocks: [
        {
          list: [
            "Passwords are stored as scrypt hashes with a per-password salt, never as text and never recoverable — which is why a reset link replaces your password rather than reminding you of it.",
            "The token in your session cookie is stored only as a SHA-256 hash, so a copy of our database is not a drawer full of working cookies.",
            "Everything travels over HTTPS.",
            "Card data never reaches us at all.",
            "Every read of your work is scoped to your account in the code itself, so a request for someone else's chapter has no route to succeed.",
          ],
        },
        "No system is perfectly secure, and a policy that told you otherwise would be lying. If a breach ever affects your personal information and presents a risk of serious injury to you, we will tell you promptly and we will notify the regulators we answer to — in Quebec the Commission d'accès à l'information, federally the Office of the Privacy Commissioner of Canada, and for writers in the UK or the EEA the relevant supervisory authority within 72 hours. We keep a register of such incidents, as Law 25 requires, whether or not any one of them turns out to be notifiable.",
      ],
    },

    {
      id: "your-rights",
      heading: "Your rights",
      blocks: [
        `These are the rights Canadian and Quebec law give you, plus the ones UK and EU law adds, and we extend all of them to everyone who uses ${product}, wherever you live. Sorting people into tiers by their address would be both more work and worse.`,
        {
          list: [
            "*See it* — ask for a copy of the personal data we hold about you.",
            "*Correct it* — your pen name and email are editable from your account page; ask us for anything else.",
            "*Delete it* — the account page does this yourself, immediately.",
            "*Take it with you* — export your work in three formats, any time, on any plan. Quebec's Law 25 calls this portability and gives you a right to receive computerised personal information in a structured, commonly used technological format; the export tools have always done it, and they do it without asking us.",
            "*Ask us to stop* — Law 25 also lets you ask that information be de-indexed or that its dissemination cease where it causes you serious injury. Nothing you write here is published by us, so the situation should not arise; the right is yours regardless.",
            "*Restrict or object* — ask us to stop a particular use, including anything we do on the basis of legitimate interests.",
            "*Withdraw consent* — untick the email nudge at any time, without affecting anything else.",
            "*Not be profiled* — there is no automated decision-making here that has a legal or similarly significant effect on you. Nothing about your account is decided by a model.",
          ],
        },
        `Ask at [${contactEmail}](mailto:${contactEmail}). We will answer within one month, free of charge. We may need to check the request is really from you, which for an email request means replying from the address on the account.`,
        "If you think we have got it wrong, you can complain to a regulator, and you do not have to come to us first — though we would rather you did.",
        {
          list: [
            "*In Quebec*, the Commission d'accès à l'information du Québec, at [cai.gouv.qc.ca](https://www.cai.gouv.qc.ca).",
            "*Elsewhere in Canada*, the Office of the Privacy Commissioner of Canada, at [priv.gc.ca](https://www.priv.gc.ca).",
            "*In the UK*, the Information Commissioner's Office, at [ico.org.uk](https://ico.org.uk).",
            "*In the EEA*, your own country's data protection authority.",
          ],
        },
      ],
    },

    {
      id: "california",
      heading: "If you are in California",
      blocks: [
        "The CCPA, as amended by the CPRA, gives you rights to know what is collected, to delete it, to correct it, and to opt out of its sale or sharing. The rights section above already covers the first three, and they are yours on request.",
        "On the fourth: *we do not sell your personal information and we do not share it for cross-context behavioural advertising.* We have not done so in the past twelve months, and the app contains no advertising technology with which we could. There is consequently no “Do Not Sell or Share My Personal Information” link, because there is nothing for it to switch off.",
        "We will not treat you differently for exercising any of these rights. There is no worse version of the product for people who ask.",
      ],
    },

    {
      id: "children",
      heading: "Children",
      blocks: [
        `${product} is not intended for children. You must be at least 16 to have an account, or 13 if you are in a country that sets the age there and your parent or guardian agrees.`,
        `Quebec's Law 25 draws its line at 14: below that age, consent to collecting personal information has to come from a parent or guardian rather than from the child. Our threshold sits above it, so this should not arise — but if you believe a child has an account, tell us at [${contactEmail}](mailto:${contactEmail}) and we will remove it.`,
      ],
    },

    {
      id: "changes",
      heading: "Changes to this policy",
      blocks: [
        "When this changes, the date at the top changes with it. If a change materially affects your rights or what we do with your data, we will email you before it takes effect rather than relying on you to notice a new date — and if the change is one you are not willing to accept, you can export your work and close your account.",
      ],
    },
  ],
};
