/*
 * `npm run config:check` — what is wired up, and what each missing piece costs.
 *
 * Every integration in this app is optional and degrades to something honest: no Stripe key
 * means the upgrade switches the plan directly and says so, no provider keys mean the button
 * is not rendered, no mail key means the reset link is printed to the server log. That is good
 * for getting started and bad for knowing where you stand — "is checkout actually live?" is
 * not a question the running app answers, because the fallback is deliberately quiet.
 *
 * So this prints the answer. It reads `.env` the way Next does and reports each block as
 * configured or not, with the one next step if not.
 *
 * It never prints a secret. A key is reported as present, with its recognisable prefix only —
 * enough to catch a live key pasted where a test key belongs, which is the mistake worth
 * catching, and not enough to be worth anything if this output ends up in a screenshot.
 */

// Scripts run outside Next, which loads `.env` itself. Node 20.6+ can do the same in one call.
try {
  process.loadEnvFile(".env");
} catch {
  // No .env at all is a legitimate state — everything below is optional.
}

const GREEN = "[32m";
const YELLOW = "[33m";
const DIM = "[2m";
const BOLD = "[1m";
const RESET = "[0m";

const has = (name: string) => {
  const value = process.env[name];
  return typeof value === "string" && value.trim().length > 0;
};

/** The first few characters of a key, so a live/test mix-up is visible. Never the whole thing. */
const shape = (name: string) => {
  const value = (process.env[name] ?? "").trim();
  if (!value) return "";
  const prefix = value.slice(0, 8);
  return `${DIM}(${prefix}… ${value.length} chars)${RESET}`;
};

let ready = 0;
let waiting = 0;

function block(title: string, on: boolean, live: string, off: string, steps: string[] = []) {
  if (on) ready += 1;
  else waiting += 1;
  const mark = on ? `${GREEN}●${RESET}` : `${YELLOW}○${RESET}`;
  console.log(`\n${mark} ${BOLD}${title}${RESET}`);
  console.log(`  ${on ? live : off}`);
  if (!on) for (const step of steps) console.log(`  ${DIM}→${RESET} ${step}`);
}

console.log(`${BOLD}Citrus Writing — configuration${RESET}`);

// ------------------------------------------------------------------ database
block(
  "Database",
  has("DATABASE_URL"),
  `Postgres at ${shape("DATABASE_URL")}`,
  "DATABASE_URL is not set — there is no local fallback, so nothing that touches the database will work.",
  ["Set DATABASE_URL to a Postgres connection string (see .env.example)."],
);

// ------------------------------------------------------------------ payments
const stripeKey = has("STRIPE_SECRET_KEY");
const stripePrices = has("STRIPE_PRICE_SERIAL_MONTHLY") && has("STRIPE_PRICE_SERIAL_YEARLY");
const stripeHook = has("STRIPE_WEBHOOK_SECRET");

block(
  "Payments — Stripe Checkout",
  stripeKey && stripePrices,
  `Checkout is live. ${shape("STRIPE_SECRET_KEY")}`,
  stripePrices
    ? "Prices are set, but STRIPE_SECRET_KEY is missing — upgrading switches the plan directly and tells the writer nothing was charged."
    : "Not configured — upgrading switches the plan directly and says so.",
  [
    "Copy the secret key from dashboard.stripe.com/test/apikeys into STRIPE_SECRET_KEY.",
    stripePrices ? "Price IDs: already set." : "Set STRIPE_PRICE_SERIAL_MONTHLY and STRIPE_PRICE_SERIAL_YEARLY.",
  ],
);

if (stripeKey && (process.env.STRIPE_SECRET_KEY ?? "").startsWith("sk_live_")) {
  console.log(`  ${YELLOW}!${RESET} This is a LIVE key. Real cards will be charged.`);
}

block(
  "Payments — the browser key for the embedded form",
  has("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"),
  `The payment form can load. ${shape("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY")}`,
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is missing — /checkout renders, but the form says it cannot load.",
  [
    "Copy the publishable key (pk_test_…) from the same Stripe API keys page.",
    "It must keep the NEXT_PUBLIC_ prefix; the secret key must not have one.",
  ],
);

block(
  "Payments — the webhook that grants the plan",
  stripeHook,
  `Signature checking is on. ${shape("STRIPE_WEBHOOK_SECRET")}`,
  "STRIPE_WEBHOOK_SECRET is missing — /api/stripe/webhook rejects every delivery, so a completed checkout never grants the plan.",
  [
    "Run: stripe listen --forward-to localhost:3000/api/stripe/webhook",
    "Paste the whsec_… it prints into STRIPE_WEBHOOK_SECRET.",
  ],
);

// --------------------------------------------------------------- sign-in with
for (const [id, label] of [
  ["GOOGLE", "Google"],
  ["GITHUB", "GitHub"],
] as const) {
  const on = has(`${id}_CLIENT_ID`) && has(`${id}_CLIENT_SECRET`);
  block(
    `Sign in with ${label}`,
    on,
    `The button is rendered and the route is live. ${shape(`${id}_CLIENT_ID`)}`,
    `Not configured — the "Continue with ${label}" button is not rendered and its route returns 404. Password sign-in is unaffected.`,
    [
      `Register an OAuth app with ${label} and set ${id}_CLIENT_ID and ${id}_CLIENT_SECRET.`,
      `Redirect URI: http://localhost:3000/api/auth/oauth/${id.toLowerCase()}/callback`,
    ],
  );
}

// --------------------------------------------------------------------- email
block(
  "Email — the password-reset link",
  has("RESEND_API_KEY"),
  `Sending through Resend as ${process.env.MAIL_FROM ?? "(MAIL_FROM not set)"}`,
  "No RESEND_API_KEY — reset links are printed to the server log instead, and the screen says so.",
  ["Set RESEND_API_KEY, and MAIL_FROM to an address on a domain you have verified with Resend."],
);

// -------------------------------------------------------------------- summary
console.log(`\n${BOLD}${ready} configured${RESET}, ${waiting} still on a fallback.`);
if (waiting > 0) {
  console.log(`${DIM}Every fallback above is a working state — see .env.example for what each buys.${RESET}`);
}
console.log();
