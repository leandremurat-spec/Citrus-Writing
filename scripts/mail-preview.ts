/**
 * Renders every email this app can send, to files you can open in a browser.
 * Run: npm run mail:preview
 *
 * An email template is the one surface with no dev server, no hot reload and no way to look at
 * it — which is exactly why they rot. This is the cheapest possible answer: the same builders
 * the app calls, rendered to `.mail-preview/`, plus the plain-text half printed to the terminal
 * so the half nobody checks is the half you cannot avoid seeing.
 *
 * It also asserts the few things about an email that can be checked without a browser at all —
 * that user text is escaped, that no message is missing its preheader or its reason line, and
 * that every link is absolute. A browser preview cannot tell you the first of those, and it is
 * the one that matters most: the support confirmation echoes back whatever a stranger typed.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { passwordResetEmail, supportConfirmationEmail, type ComposedEmail } from "../src/lib/mail/messages";
import { EMAIL_PALETTE } from "../src/lib/mail/template";

const OUT = resolve(process.cwd(), ".mail-preview");

/* A deliberately hostile support message: markup, a quote, an ampersand, an apostrophe. */
const NASTY_MESSAGE = [
  'The export dialog says "0 chapters" for my arc <The Lantern & the Tide>, even though it',
  "has nine in it. I'm on the Serial plan.",
  "",
  "Tried: reloading, a different browser. Same both times.",
  "<script>alert('this must never execute')</script>",
].join("\n");

const messages: { file: string; label: string; email: ComposedEmail }[] = [
  {
    file: "password-reset.html",
    label: "Forgotten password",
    email: passwordResetEmail("https://citruswritinglab.com/reset?token=rWx3kQ7nP2sT8vY1bN6mJ4hG9dF5aZ0c", "https://citruswritinglab.com"),
  },
  {
    file: "support-confirmation.html",
    label: "Support confirmation",
    email: supportConfirmationEmail({
      name: "Leandre",
      message: NASTY_MESSAGE,
      receivedAt: "11 September, 4:02pm",
      origin: "https://citruswritinglab.com",
    }),
  },
];

const failures: string[] = [];
function check(label: string, condition: boolean, detail?: string) {
  if (condition) return;
  failures.push(detail ? `${label}\n    ${detail}` : label);
}

/**
 * The dark mode, forced on.
 *
 * A browser previewing a local file will not always honour `prefers-color-scheme`, and the
 * dark half of an email template is otherwise only visible by sending yourself a message and
 * switching your client's theme — which is to say it is never checked. Turning the condition
 * into one that always matches renders exactly the rules a dark client would apply, out of the
 * same stylesheet, with nothing duplicated to drift.
 */
function forceDark(html: string): string {
  const forced = html.replace("@media (prefers-color-scheme: dark) {", "@media all {");
  if (forced === html) failures.push("dark preview: the dark-mode media query was not found");
  return forced;
}

mkdirSync(OUT, { recursive: true });

for (const { file, label, email } of messages) {
  writeFileSync(resolve(OUT, file), email.html, "utf8");
  writeFileSync(resolve(OUT, file.replace(/\.html$/, "-dark.html")), forceDark(email.html), "utf8");
  writeFileSync(resolve(OUT, file.replace(/\.html$/, ".txt")), email.text, "utf8");

  check(`${label}: has a subject`, email.subject.trim().length > 0);
  check(`${label}: text body is not empty`, email.text.trim().length > 0);
  check(
    `${label}: every href is absolute`,
    !/href="(?!https?:|mailto:|#)/.test(email.html),
    "a relative href in an email resolves against the client, which is nowhere",
  );
  check(
    `${label}: says why it arrived`,
    /You received this because/.test(email.html) && /You received this because/.test(email.text),
  );
  check(`${label}: carries a preheader`, /mso-hide: all/.test(email.html));
  check(
    `${label}: light and dark are both defined`,
    /prefers-color-scheme: dark/.test(email.html),
  );
}

/* The escaping, checked against the message built from the hostile fixture above. */
const support = messages[1].email;
check(
  "Support confirmation: user markup is escaped",
  !support.html.includes("<script>") && support.html.includes("&lt;script&gt;"),
  "an echoed message must never reach the document as markup",
);
check(
  "Support confirmation: user quotes and ampersands are escaped",
  support.html.includes("&quot;0 chapters&quot;") && support.html.includes("Tide&gt;"),
);
check(
  "Support confirmation: the plain-text copy is NOT escaped",
  support.text.includes("<script>") && support.text.includes('"0 chapters"'),
  "text/plain is not markup; escaping it would show the reader &amp; where they typed &",
);

/* ────────────────────────────────────────────────────────────────────────────────────────── */
/*  Contrast.                                                                                  */
/*                                                                                             */
/*  `npm run theme:check` cannot see these: it audits `palettes.ts` across eight modes, and an  */
/*  email is Citrus only, written as literal hex because no inbox can read a custom property.   */
/*  Adding these pairings to that table would mean auditing values it does not own. So the      */
/*  same 4.5:1 floor is asserted here instead, where the values actually live — and the two     */
/*  grounds matter separately, because the footer sits on the desk and the body sits on the     */
/*  card.                                                                                      */
/* ────────────────────────────────────────────────────────────────────────────────────────── */

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(a: string, b: string): number {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
}

let worst = { label: "", value: Infinity };

for (const mode of ["light", "dark"] as const) {
  const p = EMAIL_PALETTE[mode];
  const pairings: [string, string, string][] = [
    ["wordmark on the ground", p.ink, p.ground],
    ["footer on the ground", p.dim, p.ground],
    ["footer links on the ground", p.press, p.ground],
    ["heading on the card", p.ink, p.card],
    ["body on the card", p.body, p.card],
    ["eyebrow on the card", p.eyebrow, p.card],
    ["the fallback link on the card", p.press, p.card],
    ["the paste-this line on the card", p.dim, p.card],
    ["the button label on the button", p.onPress, p.press],
    ["the note, on the note", p.noteInk, p.noteBg],
    ["the echoed message, on its panel", p.quoteInk, p.quoteBg],
  ];
  for (const [what, fg, bg] of pairings) {
    const measured = ratio(fg, bg);
    check(
      `Contrast (${mode}): ${what}`,
      measured >= 4.5,
      `${fg} on ${bg} measures ${measured.toFixed(2)}:1, below the 4.5:1 floor`,
    );
    if (measured < worst.value) worst = { label: `${mode}, ${what}`, value: measured };
  }
}

for (const { label, email } of messages) {
  console.log("\n" + "─".repeat(78));
  console.log(label + "  —  " + email.subject);
  console.log("─".repeat(78));
  console.log(email.text);
}

console.log("\n" + "─".repeat(78));
if (failures.length) {
  console.error(`\n${failures.length} check(s) failed:\n`);
  for (const failure of failures) console.error("  ✗ " + failure);
  process.exit(1);
}
console.log(`✓ ${messages.length} messages rendered and checked, light and dark.`);
console.log(`  22 text pairings clear 4.5:1. Worst: ${worst.value.toFixed(2)}:1 — ${worst.label}.`);
for (const { file } of messages) {
  console.log("  " + resolve(OUT, file));
  console.log("  " + resolve(OUT, file.replace(/\.html$/, "-dark.html")));
}
