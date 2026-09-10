"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { signIn } from "@/lib/actions/auth";
import { AuthCard, Divider, Field, FormError, ProviderButtons, type Provider } from "./auth-parts";
import { Button } from "@/components/ui/button";
// Aliased: `signIn` is already taken in this file by the server action above.
import { signIn as copy } from "@/content/site-copy";

/**
 * The messages a failed provider round trip comes back with.
 *
 * The callback route redirects here with a fixed code rather than the provider's own error
 * text — remote strings are not written for readers, and echoing one into the page is not a
 * habit worth having. These are the four things that can actually go wrong, in words.
 */
const OAUTH_ERRORS: Record<string, string> = {
  expired: "That sign-in took too long, or was started somewhere else. Try again.",
  incomplete: "The provider sent us back without a sign-in. Try again.",
  provider: "The provider would not confirm who you are. Try again, or use a password.",
};

export function SignInForm({
  providers,
  next,
  oauthError,
}: {
  providers: Provider[];
  next: string;
  oauthError?: string;
}) {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(
    oauthError ? (OAUTH_ERRORS[oauthError] ?? "That sign-in did not complete. Try again.") : null,
  );
  const [pending, setPending] = React.useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);

    const response = await signIn({ email, password });
    if (!response.ok) {
      setError(response.error);
      setPending(false);
      return;
    }
    router.replace(next);
    router.refresh();
  };

  return (
    <AuthCard className="gap-4">
      <ProviderButtons providers={providers} next={next} />
      {providers.length > 0 && <Divider label="or" />}

      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field
          id="cw-si-email"
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />

        <Field
          id="cw-si-pass"
          label="Password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••••••"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          action={
            <Link href="/forgot" className="focus-ring rounded-full text-3xs text-press hover:text-press-800">
              Forgotten it?
            </Link>
          }
        />

        {/*
          The design offers "Keep me signed in on this machine", checked. It is not rendered,
          because it would be a control that does nothing: a session here lasts thirty days
          either way (see lib/auth/session.ts — Next cannot re-issue a cookie during an
          ordinary render, so there is no sliding window to opt into). A checkbox that governs
          nothing is worse than no checkbox, and the honest version of this promise is the one
          already kept.
        */}

        <FormError message={error} />

        <Button
          type="submit"
          disabled={pending}
          className="h-11.5 bg-press text-base text-press-foreground hover:bg-press-600"
        >
          {pending ? copy.submitPending : copy.submit}
        </Button>
      </form>
    </AuthCard>
  );
}
