import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { linkOrCreateUser } from "@/lib/auth/link-account";
import { fetchProfile, isProviderId, providerConfig, statesMatch } from "@/lib/auth/oauth";
import { createSession } from "@/lib/auth/session";

/**
 * Finishes a provider sign-in.
 *
 * Failures land back on /sign-in carrying a short reason rather than rendering an error page:
 * someone whose Google sign-in did not take wants the form again, not a dead end. The reason
 * is a fixed code, never the provider's own message — those are not written for readers, and
 * echoing a remote string into the page is not a habit worth having.
 */
export const dynamic = "force-dynamic";

function backToSignIn(origin: string, reason: string) {
  return NextResponse.redirect(origin + "/sign-in?error=" + encodeURIComponent(reason));
}

export async function GET(request: Request, context: { params: Promise<{ provider: string }> }) {
  const url = new URL(request.url);
  const origin = url.origin;

  const { provider } = await context.params;
  if (!isProviderId(provider)) return new NextResponse("Unknown provider", { status: 404 });

  const config = providerConfig(provider);
  if (!config) return new NextResponse("That sign-in method is not configured.", { status: 404 });

  const store = await cookies();
  const state = store.get("cw_oauth_state")?.value;
  const verifier = store.get("cw_oauth_verifier")?.value ?? "";
  const nextPath = store.get("cw_oauth_next")?.value;

  // Single-use, whatever happens next.
  store.delete("cw_oauth_state");
  store.delete("cw_oauth_verifier");
  store.delete("cw_oauth_next");

  // The user pressed "cancel" on the provider's own consent screen. Not an error to report.
  if (url.searchParams.get("error")) return NextResponse.redirect(origin + "/sign-in");

  const code = url.searchParams.get("code");
  if (!code) return backToSignIn(origin, "incomplete");
  if (!statesMatch(state, url.searchParams.get("state") ?? undefined)) {
    return backToSignIn(origin, "expired");
  }

  let userId: string;
  try {
    const profile = await fetchProfile(config, origin, code, verifier);
    userId = await linkOrCreateUser(provider, profile);
  } catch {
    return backToSignIn(origin, "provider");
  }

  await createSession(userId);

  const safe = nextPath && nextPath.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/library";
  return NextResponse.redirect(origin + safe);
}
