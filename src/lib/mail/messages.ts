/**
 * The messages themselves — the words, as opposed to the shell they are set in.
 *
 * Each builder returns a subject and both bodies, so a caller does one thing: pick a message,
 * hand it an address, pass it to `deliver`. Nothing here touches the database or the session,
 * and nothing here decides *whether* to send: that is the action's business, and keeping it
 * there is what lets `npm run mail:preview` render every message without one.
 *
 * The voice is the app's own — plain, unhurried, and never explaining itself twice. See
 * CLAUDE.md, "Explanatory copy earns its place or goes". A transactional email gets a little
 * more latitude than a panel does, because its reader has no UI in front of them to look at,
 * but not much: every sentence below is either the thing that happened, the thing to do about
 * it, or the reassurance that makes a frightened reader stop worrying.
 */

import { legalDetails } from "@/content/legal/details";

import { renderEmail, type EmailContent, type RenderOptions } from "./template";

/** A message ready for `deliver`, except for who it goes to. */
export interface ComposedEmail {
  subject: string;
  text: string;
  html: string;
}

/**
 * Who the footer says this came from. Read from the legal details rather than restated, for
 * the same reason the refund policy reads its prices out of `plans.ts`: a company address that
 * disagrees with the one on the terms page is worse than no address at all, and CASL wants a
 * working contact on every commercial message this app might one day send.
 */
const sender: RenderOptions["sender"] = {
  name: legalDetails.product,
  entity: legalDetails.entity,
  address: legalDetails.address,
  contactEmail: legalDetails.contactEmail,
};

function compose(content: EmailContent, origin?: string): ComposedEmail {
  const rendered = renderEmail(content, { origin: origin ?? legalDetails.siteUrl, sender });
  return { subject: content.subject, text: rendered.text, html: rendered.html };
}

/* ────────────────────────────────────────────────────────────────────────────────────────── */
/*  Forgotten password.                                                                        */
/* ────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The reset link.
 *
 * Two things this has to get right, and they pull in opposite directions. It must be **easy to
 * act on**, because the person reading it is locked out of their own manuscripts. And it must
 * be **safe to ignore**, because the other reader of this message is someone who did not ask
 * for it — either a mistyped address or the early stage of somebody else's attempt on the
 * account. The note at the foot is for that second reader, and it is why the message never
 * says "your account" in a way that confirms one exists to anybody who did not already know.
 *
 * @param link   The one-time reset URL. Built by the action, which owns the token.
 * @param origin The deployment the link points into, so the mark and the footer links match it.
 */
export function passwordResetEmail(link: string, origin?: string): ComposedEmail {
  return compose(
    {
      subject: "Set a new Citrus Writing password",
      preheader: "The link works once, and for thirty minutes.",
      eyebrow: "Forgotten password",
      heading: "Let’s get you back in.",
      body: [
        "Someone asked to reset the password on the Citrus Writing account at this address. If that was you, the button below sets a new one.",
      ],
      action: { label: "Set a new password", url: link },
      after: ["The link works once, and expires thirty minutes after it was sent."],
      note: {
        heading: "Didn’t ask for this?",
        text: "Then nothing has happened and nothing will. Your password is unchanged and the link will expire on its own — you can close this and carry on.",
      },
      reason: "You received this because a password reset was requested for this address.",
    },
    origin,
  );
}

/* ────────────────────────────────────────────────────────────────────────────────────────── */
/*  Support.                                                                                   */
/* ────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * How soon a reply is promised.
 *
 * Pulled out on purpose, because it is the one sentence in this file that is a **commitment**
 * rather than a description — an automated email that promises a reply by Tuesday is worse than
 * one that promises nothing, and it is the operator who knows which is true. Change it to what
 * can actually be honoured, or empty it to say nothing about timing at all.
 */
export const SUPPORT_REPLY_PROMISE =
  "A person reads every message that comes in, and you’ll get a reply from this address.";

export interface SupportConfirmationInput {
  /** What they wrote, echoed back verbatim. Escaped by the template, not here. */
  message: string;
  /** How to greet them, if it is known. A first name, or nothing. */
  name?: string;
  /** When it arrived, as the reader's own words for it — already formatted by the caller. */
  receivedAt?: string;
  origin?: string;
}

/**
 * "We have your message."
 *
 * The useful part of a support confirmation is not the acknowledgement — it is **the copy of
 * what was sent**. Someone who has just described a problem in five paragraphs wants to know
 * the five paragraphs arrived, and if they later wonder what they said, this is the record.
 * That is also why the message is echoed rather than summarised or given a ticket number: this
 * app has no ticketing system, and a reference number pointing at nothing is theatre.
 *
 * ⚠ **Nothing calls this yet.** There is no contact form and no support inbox route in the app;
 * it is written and ready for the moment there is one. Two things to know before wiring it up:
 * a confirmation is only worth sending if a human genuinely reads the other end (otherwise it
 * is a promise the software cannot keep — see the `notifyStale` note in CLAUDE.md for the same
 * mistake made once already), and `SUPPORT_REPLY_PROMISE` above must be made true first.
 */
export function supportConfirmationEmail(input: SupportConfirmationInput): ComposedEmail {
  const greeting = input.name ? `Thanks, ${input.name} — your message reached us.` : "Your message reached us.";

  const body = ["We have it, and nothing more is needed from you for now."];
  if (SUPPORT_REPLY_PROMISE) body.push(SUPPORT_REPLY_PROMISE);
  body.push(
    "If you remember something that would help — what you were doing when it happened, which serial it concerns — just reply to this email and it will land in the same place.",
  );

  return compose(
    {
      subject: "We have your message — Citrus Writing",
      preheader: "A copy of what you sent is at the bottom of this email.",
      eyebrow: "Support",
      heading: greeting,
      body,
      note: {
        heading: input.receivedAt ? `What you sent, ${input.receivedAt}` : "What you sent",
        text: input.message,
        // Their words, not ours — so the neutral panel, not the sage one.
        tone: "quote",
      },
      reason: "You received this because you wrote to Citrus Writing support from this address.",
    },
    input.origin,
  );
}
