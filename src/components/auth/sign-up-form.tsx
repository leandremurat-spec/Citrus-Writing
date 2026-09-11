"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { signUp } from "@/lib/actions/auth";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password-rules";
// Aliased: `signUp` is already taken in this file by the server action above.
import { signUp as copy } from "@/content/site-copy";
import { Button } from "@/components/ui/button";
import {
  attempt,
  AuthCard,
  CheckRow,
  Divider,
  Field,
  FormError,
  PasswordMeter,
  ProviderButtons,
  type Provider,
} from "./auth-parts";

export function SignUpForm({ providers, next }: { providers: Provider[]; next: string }) {
  const router = useRouter();
  const [penName, setPenName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [notifyStale, setNotifyStale] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);

    const response = await attempt(() => signUp({ penName, email, password, notifyStale }));
    if (!response.ok) {
      setError(response.error);
      setPending(false);
      return;
    }
    // A signed-up writer has no serials yet, so the Library shows its welcome and asks for the
    // first title. push + refresh, because the session cookie the action just set only reaches
    // the server components on a fresh request.
    router.replace(next);
    router.refresh();
  };

  return (
    <AuthCard>
      <h2 className="font-heading text-[1.6875rem] leading-[1.15]">{copy.formHeading}</h2>

      <ProviderButtons providers={providers} next={next} />
      {providers.length > 0 && <Divider label="or with a password" />}

      <form onSubmit={submit} className="flex flex-col gap-4.5">
        <Field
          id="cw-su-name"
          label="Pen name"
          type="text"
          autoComplete="nickname"
          placeholder="What your readers call you"
          hint="Shown on exports. Change it any time."
          required
          value={penName}
          onChange={(event) => setPenName(event.target.value)}
        />

        <Field
          id="cw-su-email"
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />

        <Field
          id="cw-su-pass"
          label="Password"
          type="password"
          autoComplete="new-password"
          placeholder={"At least " + MIN_PASSWORD_LENGTH + " characters"}
          required
          minLength={MIN_PASSWORD_LENGTH}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        >
          <PasswordMeter value={password} />
        </Field>

        <CheckRow id="cw-su-notify" checked={notifyStale} onChange={setNotifyStale}>
          {copy.notifyLabel}
        </CheckRow>

        <FormError message={error} />

        <Button
          type="submit"
          disabled={pending}
          className="h-12 bg-press text-base text-press-foreground hover:bg-press-600"
        >
          {pending ? copy.submitPending : copy.submit}
        </Button>
      </form>

      <p className="text-2xs leading-relaxed text-subtle">
        Already writing here?{" "}
        <Link href="/sign-in" className="focus-ring rounded-full text-press hover:text-press-800">
          Sign in instead
        </Link>
        .
      </p>
    </AuthCard>
  );
}
