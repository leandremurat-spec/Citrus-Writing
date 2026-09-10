import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { buildAuthorizationUrl, isProviderId, providerConfig } from "@/lib/auth/oauth";

/**
 * Starts a provider sign-in.
 *
 * A route handler rather than a server action because this ends in a redirect *off site* and
 * has to set two short-lived cookies on the way — the CSRF state and the PKCE verifier — which
 * only a route handler or a server function may do.
 *
 * The origin comes from the incoming request rather than an environment variable, so the
 * redirect_uri is right on localhost, on a preview URL and in production without a third
 * place to keep in sync. It is only ever used to build a URL back to this same app.
 */
export const dynamic = "force-dynamic";

const FLOW_MAX_AGE = 10 * 60; // A sign-in that takes longer than ten minutes has been abandoned.

export async function GET(request: Request, context: { params: Promise<{ provider: string }> }) {
  const { provider } = await context.params;
  if (!isProviderId(provider)) return new NextResponse("Unknown provider", { status: 404 });

  const config = providerConfig(provider);
  // Not configured is genuinely not found, not "temporarily unavailable": without credentials
  // this endpoint has nothing to redirect to and the button for it is never rendered either.
  if (!config) return new NextResponse("That sign-in method is not configured.", { status: 404 });

  const origin = new URL(request.url).origin;
  const { url, state, verifier } = buildAuthorizationUrl(config, origin);

  const nextPath = new URL(request.url).searchParams.get("next");

  const store = await cookies();
  const options = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: FLOW_MAX_AGE,
  };
  store.set("cw_oauth_state", state, options);
  store.set("cw_oauth_verifier", verifier, options);
  // Only ever a path within this app — checked again on the way back, because a cookie is
  // still attacker-influenced input.
  if (nextPath && nextPath.startsWith("/") && !nextPath.startsWith("//")) {
    store.set("cw_oauth_next", nextPath, options);
  } else {
    store.delete("cw_oauth_next");
  }

  return NextResponse.redirect(url);
}
