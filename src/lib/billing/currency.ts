/**
 * Which currency a writer is quoted and charged in.
 *
 * ── The rule this file exists to enforce ──────────────────────────────────────
 *
 * **The app picks the currency, and tells Stripe.** It does not let Stripe pick and then try to
 * guess what it picked.
 *
 * Stripe's `currency_options` will happily choose for you, from the customer's location, at the
 * moment the form is filled in — which is after the page has already quoted a price. That is how
 * this app came to show "$6 a month", have the writer tick a box reading "Charged in US
 * dollars", and take CAD 8.00. Three surfaces disagreed with the receipt, and nothing in the
 * codebase could have noticed, because the number the customer saw and the number Stripe charged
 * were decided by different parties at different times.
 *
 * So the currency is resolved once, server-side, from the request; every price on the page comes
 * from that currency; and `currency` is passed explicitly on the Checkout Session. The displayed
 * price and the charged price are then the same decision rather than two that usually agree.
 *
 * ── Why the country comes from Cloudflare ─────────────────────────────────────
 *
 * `CF-IPCountry` is added by Cloudflare, which fronts this app, and is the only geographic
 * signal available before a writer has typed anything. It is a guess — a VPN or a traveller
 * defeats it — which is why it only ever selects among currencies we are willing to charge, and
 * why the fallback is USD rather than an error. Being quoted in the wrong currency is a mild
 * annoyance; being quoted one and charged another is the bug this replaces.
 */

/**
 * The currencies this app is prepared to quote and charge.
 *
 * **Every one of these must exist on every Stripe price**, or a writer picks a plan and finds
 * the currency is not available for that interval. `npm run stripe:check` fails when one is
 * missing, which is what makes this list safe to extend.
 *
 * AUD is deliberately absent: Stripe carries an AUD amount on the monthly price but not the
 * yearly one, so offering it would quote Australian dollars for one plan and US dollars for the
 * other on the same page. Add the yearly AUD amount in Stripe and it can join this list.
 */
export const SUPPORTED_CURRENCIES = ["usd", "cad", "eur", "gbp"] as const;

export type Currency = (typeof SUPPORTED_CURRENCIES)[number];

/** What everyone outside the mapped countries is quoted and charged. */
export const DEFAULT_CURRENCY: Currency = "usd";

export function isSupportedCurrency(value: string): value is Currency {
  return (SUPPORTED_CURRENCIES as readonly string[]).includes(value);
}

/** The eurozone. Countries in the EU that have not adopted the euro are deliberately not here. */
const EUROZONE = [
  "AT", "BE", "HR", "CY", "EE", "FI", "FR", "DE", "GR", "IE",
  "IT", "LV", "LT", "LU", "MT", "NL", "PT", "SK", "SI", "ES",
];

const BY_COUNTRY: Record<string, Currency> = {
  CA: "cad",
  GB: "gbp",
  ...Object.fromEntries(EUROZONE.map((code) => [code, "eur"] as const)),
};

/** The currency for an ISO country code, falling back to USD for anywhere unmapped. */
export function currencyForCountry(country: string | null | undefined): Currency {
  if (!country) return DEFAULT_CURRENCY;
  return BY_COUNTRY[country.trim().toUpperCase()] ?? DEFAULT_CURRENCY;
}

/** The currency for an incoming request, from Cloudflare's country header. */
export function currencyFromHeaders(headers: Headers): Currency {
  return currencyForCountry(headers.get("cf-ipcountry"));
}

/*
 * Symbols are written out rather than taken from `Intl`, because the one thing this has to do is
 * tell Canadian dollars from US ones. `Intl.NumberFormat("en-US", { currency: "CAD",
 * currencyDisplay: "narrowSymbol" })` renders "$8.00" — correct by its own lights and exactly
 * the ambiguity that made the original bug invisible.
 */
const SYMBOL: Record<Currency, string> = { usd: "$", cad: "CA$", eur: "€", gbp: "£" };

/** "US dollars", for a sentence. */
const NAME: Record<Currency, string> = {
  usd: "US dollars",
  cad: "Canadian dollars",
  eur: "euro",
  gbp: "pounds sterling",
};

export function currencyName(currency: Currency): string {
  return NAME[currency];
}

/** "$6", "CA$8", "€6", "£36" — whole amounts lose the ".00", because most of these are whole. */
export function formatMoney(cents: number, currency: Currency = DEFAULT_CURRENCY): string {
  if (cents === 0) return "Free";
  const units = cents / 100;
  return SYMBOL[currency] + (Number.isInteger(units) ? units : units.toFixed(2));
}
