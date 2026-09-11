import { formatPrice, perMonthCents, PLANS } from "@/lib/billing/plans";

import type { LegalDocument } from "./document";
import { legalDetails } from "./details";

/**
 * The refund and subscription policy.
 *
 * Every figure on this page is read from `lib/billing/plans.ts`, never typed out — the same rule
 * the pricing page follows, and for a stronger reason here: a refund policy that quotes a price
 * the checkout does not charge is a misrepresentation rather than a stale string.
 *
 * ── The one clause that needed thought ──────────────────────────────────────
 *
 * The commercial stance is "cancel any day, no refunds": access runs to the end of the period
 * you paid for and the unused part is not returned. That is a legitimate position and it is the
 * one this product takes.
 *
 * It cannot be the *whole* position for an international userbase, because a UK or EU consumer
 * has a 14-day right to withdraw from a distance contract that no term of ours can remove. A
 * page that flatly denied it would be unenforceable where it mattered and would itself be an
 * unfair commercial practice — so the right is stated, and the lawful mechanism for the stance
 * is used instead of pretending the right is not there.
 *
 * That mechanism is the one every subscription service with immediate access relies on: where
 * the consumer expressly asks for the service to begin during the 14 days *and acknowledges
 * that they lose the withdrawal right once it has been fully performed*, the right falls away.
 * `components/billing/checkout-acknowledgement.tsx` is that consent, given knowingly at the
 * moment of purchase, and the payment is refused without it. It is what makes "no refunds"
 * true in practice rather than merely asserted.
 */

const { product, contactEmail } = legalDetails;

const monthly = formatPrice(PLANS.SERIAL.monthlyCents);
const yearly = formatPrice(PLANS.SERIAL.yearlyCents);
const yearlyPerMonth = formatPrice(perMonthCents("SERIAL", "yearly"));

export const refunds: LegalDocument = {
  slug: "refunds",
  title: "Refund and Subscription Policy",
  summary: "What Serial costs, how it renews, how to stop it, and when money does and does not come back.",
  footerLabel: "Refunds",
  updated: "2026-09-11",

  gist: [
    "Serial renews automatically until you cancel. Cancel any day, in two clicks, from your account page.",
    "Cancelling keeps Serial running until the end of the period you have already paid for. It does not end it early.",
    "We do not refund the unused part of a period — but nothing is ever deleted or locked when a subscription ends.",
    "Where the law of your country gives you a stronger right than this page does, that right wins. Nothing here removes it.",
  ],

  sections: [
    {
      id: "what-it-costs",
      heading: "What it costs",
      blocks: [
        `Drawer is free. It stays free, it does not expire, and it is not a trial — one serial, the whole writing surface, and export.`,
        `Serial is *${monthly} a month*, or *${yearly} a year* — which works out at ${yearlyPerMonth} a month.`,
        `*Prices are in US dollars, and we are a Canadian company.* If your card is in another currency, your bank converts it at its own rate and may add a foreign-transaction fee of its own — so the figure on your statement can differ slightly from the figure above, and that difference is your bank's rather than ours.`,
        "Sales tax is added at checkout where it applies to you — GST and QST for Canadian customers, VAT or its local equivalent elsewhere — and the total you will actually be charged is shown before you pay, not after.",
        "There is no setup fee, no per-chapter charge and no charge for exporting your own work.",
      ],
    },

    {
      id: "renewal",
      heading: "It renews automatically",
      blocks: [
        "Stated plainly because it should be: *a Serial subscription renews by itself at the end of every period, and your card is charged again, until you cancel it.* A monthly subscription renews every month on the day you started; a yearly one renews every year on that date.",
        "The renewal is charged at the price then current for your plan. If we ever change that price, you get at least 30 days' notice by email first and can cancel before it applies to you.",
        "You can see your next renewal date on your [account page](/account) at any time, and Stripe emails you a receipt for every charge.",
      ],
    },

    {
      id: "cancelling",
      heading: "How to cancel",
      blocks: [
        "From your [account page](/account): open *Manage billing* and cancel there. It takes effect immediately in the sense that matters — no further charge will be made.",
        "There is no cancellation fee, no minimum term, no retention phone call and no form asking why. You do not need to email us to cancel, and we will not make you.",
        {
          note: "Cancelling does not end your subscription on the spot. You keep Serial — the buffer, unlimited serials, codex ties, whole-serial export — until the end of the period you have already paid for, and you drop to Drawer at the date that period ends.",
        },
      ],
    },

    {
      id: "refunds",
      heading: "Refunds",
      blocks: [
        "*We do not refund the unused part of a subscription period.* When you cancel, you keep everything Serial gives you until that period runs out — that part is never taken away early — but the money already paid for it does not come back. That applies to a monthly period and a yearly one alike, and it applies whether you cancel on day two or day two hundred.",
        "We would rather you knew that before you paid than be surprised by it after asking, which is the only reason it is said this plainly.",
        "Two situations where we do refund, and we will do it without an argument:",
        {
          list: [
            "*We got the charge wrong* — you were billed twice, billed after cancelling, or charged an amount that is not the price you agreed to.",
            "*We ended your paid account ourselves* for something you did not do. In that case the unused part of the period comes back.",
          ],
        },
        `Either way, write to [${contactEmail}](mailto:${contactEmail}) and we will sort it out. A refund goes back to the card that paid, and Stripe usually takes five to ten working days to put it there.`,
      ],
    },

    {
      id: "statutory",
      heading: "Where the law gives you more",
      blocks: [
        "Nothing on this page removes a right your own country's consumer law gives you, and where the two disagree, the law wins. Two cases are worth spelling out because they come up.",
        "*The 14-day right to change your mind (UK and EU).* Buying online normally gives a consumer 14 days to withdraw from the contract and get their money back. For a digital service that you asked to start straight away, that right ends once the service has been fully provided — and when you buy Serial you are asked to confirm, in a box you have to tick yourself, that you want access immediately and that you understand you lose the withdrawal right once you have it. That confirmation is why this page can say what it says above. If you did not give it, or if you change your mind before you have used the subscription, write to us within 14 days and you will get your money back.",
        "*Faulty service.* If Serial does not do what we have said it does, that is a different matter from changing your mind, and consumer law gives you a remedy for it — a repair, or your money back — which this policy does not affect. Tell us what is broken and we will either fix it or refund you.",
        `*If you are in Quebec*, where we are, the Consumer Protection Act governs this contract and takes precedence over anything on this page that would give you less. It sets out its own grounds on which a distance contract can be cancelled — including where a merchant failed to give the required information before the sale — and its own rules about renewals and about unilateral changes to a contract. None of those are waived by the box you tick at checkout, and none of them are affected by what this page says about refunds.`,
      ],
    },

    {
      id: "what-happens",
      heading: "What happens when Serial ends",
      blocks: [
        "Whether you cancelled, or a card simply stopped working, the answer is the same and it is the important promise on this page:",
        {
          note: "Nothing is deleted and nothing is locked. Every serial you have written stays readable and stays exportable, in all three formats, on the free plan, forever.",
        },
        "What changes is what you can do next: Drawer keeps one serial open for new writing, so you choose which to carry on with, and the scheduling tools, the codex ties and the multi-chapter export scopes stop being available until you subscribe again. Your other serials are not hidden, not archived and not held to ransom — they are simply read-only for writing purposes until you pick one or upgrade again.",
        "Subscribe again later and everything comes straight back on, exactly as you left it.",
      ],
    },

    {
      id: "failed-payments",
      heading: "If a payment fails",
      blocks: [
        "Cards expire and banks decline things. When a renewal fails, *you keep Serial while the card is retried* — we do not cut a writer off from their schedule on the first decline. Stripe retries over several days and emails you about it.",
        "Update the card from *Manage billing* on your account page and the subscription carries on as though nothing happened. If the retries are all exhausted, the subscription ends and you move to Drawer, with — again — nothing deleted.",
      ],
    },

    {
      id: "chargebacks",
      heading: "Chargebacks",
      blocks: [
        `If you think a charge is wrong, [${contactEmail}](mailto:${contactEmail}) is faster than your bank: we can refund in a minute, and a chargeback takes weeks and cannot be undone by either of us once it starts.`,
        "We will not close your account for raising one, but a disputed charge suspends the paid plan until it is resolved, because the payment for it is no longer with us.",
      ],
    },

    {
      id: "free-plan",
      heading: "The free plan",
      blocks: [
        "Drawer costs nothing, so there is nothing to refund and nothing to cancel. It does not ask for a card, it does not expire into a paid plan, and there is no trial that quietly begins charging. If you never want to pay us, you never have to, and the app does not nag you about it.",
      ],
    },

    {
      id: "contact",
      heading: "Ask us",
      blocks: [
        `Anything about a charge, a renewal or a refund: [${contactEmail}](mailto:${contactEmail}). Tell us the email address on the account and roughly when the charge was, and we will find it.`,
        `This policy forms part of the [Terms of Service](/legal/terms), and what we do with your billing details is in the [Privacy Policy](/legal/privacy#payments). ${product} never sees your card number.`,
      ],
    },
  ],
};
