import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * "Continue with Google" and "Continue with GitHub".
 *
 * Hand-rolled against the providers' own endpoints rather than pulled in through an auth
 * library, for the same reason the SQLite driver is hand-rolled here: this project cannot take
 * a dependency lightly (Windows on ARM64, an `&` in the folder name that breaks npm's shims),
 * and the authorization-code flow is four HTTP calls. Nothing here needs a framework.
 *
 * **A provider is configured or it does not exist.** `availableProviders()` reads the
 * environment, and every surface — the buttons on the sign-in card, the routes themselves —
 * asks it rather than assuming. A "Continue with Google" button that cannot possibly work is
 * worse than no button, so an unconfigured provider is not rendered and its route 404s.
 */

export type ProviderId = "google" | "github";

interface ProviderConfig {
  id: ProviderId;
  label: string;
  clientId: string;
  clientSecret: string;
  authorizeUrl: string;
  tokenUrl: string;
  scope: string;
  /** Google implements PKCE; GitHub's OAuth apps do not, and reject the extra parameters. */
  usesPkce: boolean;
}

/** What a provider tells us about the person who just signed in. */
export interface ProviderProfile {
  /** The provider's own stable id. Never the email — an email can be changed or reassigned. */
  accountId: string;
  email: string;
  name: string;
}

function readConfig(id: ProviderId): ProviderConfig | null {
  const prefix = id.toUpperCase();
  const clientId = process.env[prefix + "_CLIENT_ID"];
  const clientSecret = process.env[prefix + "_CLIENT_SECRET"];
  if (!clientId || !clientSecret) return null;

  if (id === "google") {
    return {
      id,
      label: "Google",
      clientId,
      clientSecret,
      authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenUrl: "https://oauth2.googleapis.com/token",
      scope: "openid email profile",
      usesPkce: true,
    };
  }
  return {
    id,
    label: "GitHub",
    clientId,
    clientSecret,
    authorizeUrl: "https://github.com/login/oauth/authorize",
    tokenUrl: "https://github.com/login/oauth/access_token",
    scope: "read:user user:email",
    usesPkce: false,
  };
}

const ALL: readonly ProviderId[] = ["google", "github"];

/** The providers this deployment actually has credentials for, in the order they are shown. */
export function availableProviders(): { id: ProviderId; label: string }[] {
  return ALL.map(readConfig)
    .filter((config): config is ProviderConfig => config !== null)
    .map((config) => ({ id: config.id, label: config.label }));
}

export function isProviderId(value: string): value is ProviderId {
  return (ALL as readonly string[]).includes(value);
}

export function providerConfig(id: ProviderId): ProviderConfig | null {
  return readConfig(id);
}

export function callbackUrl(origin: string, id: ProviderId): string {
  return origin + "/api/auth/oauth/" + id + "/callback";
}

/** A CSRF state token and, for PKCE providers, the verifier its challenge is derived from. */
export interface AuthorizationStart {
  url: string;
  state: string;
  verifier: string;
}

export function buildAuthorizationUrl(config: ProviderConfig, origin: string): AuthorizationStart {
  const state = randomBytes(24).toString("base64url");
  const verifier = randomBytes(32).toString("base64url");

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: callbackUrl(origin, config.id),
    response_type: "code",
    scope: config.scope,
    state,
  });

  if (config.usesPkce) {
    params.set("code_challenge", createHash("sha256").update(verifier).digest("base64url"));
    params.set("code_challenge_method", "S256");
    // Google returns no email on a silent re-auth unless asked to prompt; "select_account"
    // also lets someone with two Google accounts pick the one they write under.
    params.set("prompt", "select_account");
  }

  return { url: config.authorizeUrl + "?" + params.toString(), state, verifier };
}

/** Constant-time state comparison — this is the CSRF check, so it gets the careful compare. */
export function statesMatch(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b) return false;
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

async function exchangeCode(config: ProviderConfig, origin: string, code: string, verifier: string): Promise<string> {
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
    grant_type: "authorization_code",
    redirect_uri: callbackUrl(origin, config.id),
  });
  if (config.usesPkce) body.set("code_verifier", verifier);

  const response = await fetch(config.tokenUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body,
  });
  if (!response.ok) throw new Error(config.label + " refused the sign-in.");

  const token = (await response.json()) as { access_token?: string };
  if (!token.access_token) throw new Error(config.label + " returned no access token.");
  return token.access_token;
}

async function googleProfile(accessToken: string): Promise<ProviderProfile> {
  const response = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { authorization: "Bearer " + accessToken },
  });
  if (!response.ok) throw new Error("Google would not share your profile.");
  const profile = (await response.json()) as {
    sub?: string;
    email?: string;
    email_verified?: boolean;
    name?: string;
  };
  if (!profile.sub || !profile.email) throw new Error("Google did not return an email address.");
  // An unverified address must never reach the linking step: matching one against an existing
  // account is exactly how a provider sign-in turns into an account takeover.
  if (profile.email_verified === false) throw new Error("That Google address is not verified.");
  return { accountId: profile.sub, email: profile.email, name: profile.name || profile.email.split("@")[0] };
}

async function githubProfile(accessToken: string): Promise<ProviderProfile> {
  const headers = {
    authorization: "Bearer " + accessToken,
    accept: "application/vnd.github+json",
    "user-agent": "citrus-writing",
  };

  const userResponse = await fetch("https://api.github.com/user", { headers });
  if (!userResponse.ok) throw new Error("GitHub would not share your profile.");
  const user = (await userResponse.json()) as { id?: number; login?: string; name?: string; email?: string };
  if (!user.id) throw new Error("GitHub did not return an account.");

  // A GitHub profile's public email is frequently null, so fall back to the verified-primary
  // address the `user:email` scope exists to expose.
  let email = user.email ?? null;
  if (!email) {
    const emailResponse = await fetch("https://api.github.com/user/emails", { headers });
    if (emailResponse.ok) {
      const rows = (await emailResponse.json()) as { email: string; primary: boolean; verified: boolean }[];
      email = rows.find((row) => row.primary && row.verified)?.email ?? rows.find((row) => row.verified)?.email ?? null;
    }
  }
  if (!email) throw new Error("GitHub has no verified email address to use.");

  return { accountId: String(user.id), email, name: user.name || user.login || email.split("@")[0] };
}

/** Turns the callback's `code` into the profile behind it. Throws with a message fit to show. */
export async function fetchProfile(
  config: ProviderConfig,
  origin: string,
  code: string,
  verifier: string,
): Promise<ProviderProfile> {
  const accessToken = await exchangeCode(config, origin, code, verifier);
  return config.id === "google" ? googleProfile(accessToken) : githubProfile(accessToken);
}
