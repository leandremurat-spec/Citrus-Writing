import type { NextConfig } from "next";

/**
 * Response headers.
 *
 * The app had none at all, which on a site that takes card payments left two things open that
 * cost nothing to close.
 *
 * **Clickjacking was the one worth fixing today.** Nothing stopped `/checkout` being loaded in
 * an iframe on someone else's page, with their own chrome drawn around it. `frame-ancestors`
 * is the modern control and `X-Frame-Options` is the one older browsers obey; both are here
 * because they cost a line each.
 *
 * **HSTS closes the first request.** Cloudflare already redirects http to https, but the
 * redirect itself travels in the clear and is interceptable. HSTS means the browser refuses to
 * make that request at all after the first visit.
 *
 * `preload` is deliberately absent. It is the one part of this that cannot be undone on your
 * own schedule — removal is a submission to a list browsers ship months in advance — and it
 * should be a decision taken once the domain is settled, not a default.
 */

/**
 * The content security policy, and why it is shaped this way.
 *
 * `'unsafe-inline'` in `script-src` is not laziness: the palette script and the Plausible
 * initialiser are inline by necessity — the first has to run before first paint or a writer on
 * a non-default palette sees a frame of the wrong colour, and both are static strings built
 * from app constants. The alternative is per-request nonces through middleware, which is a real
 * change to how every page renders.
 *
 * So this policy is not an XSS cure. What it does buy, and what it is here for, is that an
 * injected `<script src>` pointing anywhere but Stripe or Plausible will not load, a stolen page
 * cannot be reframed, and `form-action 'self'` means a tampered form cannot post credentials off
 * site. Those are worth having on their own.
 *
 * Every external origin below is one the app genuinely uses: Stripe for the embedded payment
 * form and its iframes, Plausible for the page-view counter. The typefaces are self-hosted by
 * `next/font`, which is why there is no Google origin here at all — and why the privacy policy
 * can say a page load makes no request to them.
 */
/*
 * Development needs two things production must not have, and finding that out is the reason
 * this was tested in a browser rather than reasoned about.
 *
 * React's development build calls `eval()` — for reconstructing stack traces across
 * environments — and says so in the console when a policy forbids it: "React will never use
 * eval() in production mode". Turbopack's hot reload then opens a `ws://` connection, which
 * `connect-src 'self'` does not cover, because the scheme differs from the page's.
 *
 * Granting either in production would give an injected script the two capabilities most worth
 * having, so they are granted only where the alternative is a dev server that cannot hot-reload
 * and fills its console with errors.
 */
const isDev = process.env.NODE_ENV === "development";

const scriptSrc = [
  "'self'",
  "'unsafe-inline'",
  ...(isDev ? ["'unsafe-eval'"] : []),
  "https://js.stripe.com",
  "https://plausible.io",
].join(" ");

const connectSrc = [
  "'self'",
  ...(isDev ? ["ws://localhost:*", "http://localhost:*"] : []),
  "https://api.stripe.com",
  "https://*.stripe.com",
  "https://plausible.io",
].join(" ");

const csp = [
  "default-src 'self'",
  `script-src ${scriptSrc}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.stripe.com",
  "font-src 'self' data:",
  `connect-src ${connectSrc}`,
  // Stripe's embedded form is an iframe, and it opens further ones for 3-D Secure.
  "frame-src https://js.stripe.com https://*.stripe.com https://hooks.stripe.com",
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Nothing here asks for any of these, and saying so stops an embedded frame asking either.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
