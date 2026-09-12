/**
 * Where this app is actually being reached from.
 *
 * ── Why `new URL(request.url).origin` is wrong ────────────────────────────────
 *
 * Behind a proxy it is not the public address. Next builds `request.url` from the connection it
 * actually received, and in production that connection comes from Railway's router to the
 * container — so `request.url` reads `http://localhost:8080/…` no matter what the browser typed.
 *
 * That is survivable for a link the app renders, and fatal for a `redirect_uri`. Google sign-in
 * failed on exactly this: the authorization request carried
 * `http://localhost:8080/api/auth/oauth/google/callback`, the provider honoured it, and the
 * writer's browser was sent to a localhost that was never going to answer. The flow looked
 * perfect right up to the last hop.
 *
 * The public origin only exists in the forwarded headers, which is why this reads them.
 *
 * ── Why each value is taken before the first comma ────────────────────────────
 *
 * There are two proxies in front of this app — Cloudflare, then Railway — and each appends to
 * `X-Forwarded-*` rather than replacing it. So `x-forwarded-proto` can arrive as `https,http`:
 * https as the browser spoke it, http on the internal hop. Taking the whole string builds
 * `https,http://citruswritinglab.com`, which is not a URL. The first value is the one the
 * outermost proxy saw, and that is the one the browser used.
 */

/** The public origin for this request, e.g. `https://citruswritinglab.com`. */
export function originFrom(headers: Headers): string {
  const first = (value: string | null) => value?.split(",")[0]?.trim() || null;

  const host = first(headers.get("x-forwarded-host")) ?? first(headers.get("host"));
  const proto =
    first(headers.get("x-forwarded-proto")) ?? (process.env.NODE_ENV === "production" ? "https" : "http");

  // No host header at all is not a situation with a sensible default — every caller is building
  // a URL that has to reach this same app, and a wrong one fails somewhere far less obvious.
  if (!host) throw new Error("No Host header, so the request origin cannot be determined.");

  return proto + "://" + host;
}
