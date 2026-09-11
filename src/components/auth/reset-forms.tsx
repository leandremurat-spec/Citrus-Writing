"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail } from "lucide-react";

import { completePasswordReset, requestPasswordReset } from "@/lib/actions/auth";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password-rules";
import { Button } from "@/components/ui/button";
import { attempt, AuthCard, Field, FormError, PasswordMeter } from "./auth-parts";

/**
 * "Forgotten it?" and the screen it becomes.
 *
 * The success state is the handoff's own "Check your email" screen, and it is shown for *any*
 * well-formed address — whether or not an account exists. That is the point: the page must not
 * become a way to find out which addresses are registered. The copy is written to be true
 * either way ("if that address has an account"), rather than claiming a message was sent.
 */
export function ForgotForm() {
  const [email, setEmail] = React.useState("");
  const [sent, setSent] = React.useState(false);
  const [logged, setLogged] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  const send = async () => {
    if (pending) return;
    setPending(true);
    setError(null);

    const response = await attempt(() => requestPasswordReset({ email, origin: window.location.origin }));
    setPending(false);
    if (!response.ok) {
      setError(response.error);
      return;
    }
    setLogged(response.delivery === "logged");
    setSent(true);
  };

  if (sent) {
    return (
      <div className="w-full max-w-[440px] text-center">
        <span className="inline-flex size-16 items-center justify-center rounded-full bg-ochre-100 text-ochre-800">
          <Mail className="size-7" strokeWidth={2.75} />
        </span>
        <h1 className="mt-5.5 font-heading text-[clamp(1.625rem,2.8vw,2rem)] leading-[1.15]">Check your email</h1>
        <p className="mt-3.5 text-[0.96875rem] leading-[1.65] text-neutral-800">
          If <strong>{email}</strong> has an account, a link to set a new password is on its way. It works once and
          expires in thirty minutes.
        </p>

        {/* Local development with no mail provider: the link was printed to the terminal, and
            pretending otherwise would leave a developer waiting for an email forever. */}
        {logged && (
          <p className="mt-3.5 rounded-[20px] bg-ochre-100 px-3.5 py-2.5 text-2xs leading-relaxed text-ochre-900">
            No mail provider is configured, so the link was written to the server log instead. Look in the terminal
            running <code className="font-mono">npm run dev</code>.
          </p>
        )}

        <div className="mt-6.5 flex flex-wrap justify-center gap-2.5">
          <Button variant="outline" className="h-10.5 bg-transparent text-sm" onClick={() => setSent(false)}>
            Send it again
          </Button>
          <Button
            variant="ghost"
            render={<Link href="/sign-in" />}
            nativeButton={false}
            className="h-10.5 text-sm text-press hover:bg-press-100"
          >
            Back to sign in
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[440px]">
      <h1 className="font-heading text-[clamp(1.75rem,3.4vw,2.25rem)] leading-[1.1]">Set a new password</h1>
      <p className="mt-3 text-[0.96875rem] leading-[1.6] text-neutral-800">
        Tell us the address you write under and we&rsquo;ll send a link.
      </p>

      <form
        className="mt-6"
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
      >
        <AuthCard className="gap-4">
          <Field
            id="cw-forgot-email"
            label="Email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <FormError message={error} />
          <Button
            type="submit"
            disabled={pending}
            className="h-11.5 bg-press text-base text-press-foreground hover:bg-press-600"
          >
            {pending ? "Sending…" : "Send the link"}
          </Button>
        </AuthCard>
      </form>

      <p className="mt-5 text-2xs text-subtle">
        Remembered it?{" "}
        <Link href="/sign-in" className="focus-ring rounded-full text-press hover:text-press-800">
          Sign in
        </Link>
        .
      </p>
    </div>
  );
}

/** The other end of the link: set the new password, and be signed in by it. */
export function ResetForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  return (
    <div className="w-full max-w-[440px]">
      <h1 className="font-heading text-[clamp(1.75rem,3.4vw,2.25rem)] leading-[1.1]">Choose a new password</h1>
      <p className="mt-3 text-[0.96875rem] leading-[1.6] text-neutral-800">
        Setting it signs out every other browser, then signs you in here.
      </p>

      <form
        className="mt-6"
        onSubmit={(event) => {
          event.preventDefault();
          if (pending) return;
          setPending(true);
          setError(null);
          void (async () => {
            const response = await attempt(() => completePasswordReset({ token, newPassword: password }));
            if (!response.ok) {
              setError(response.error);
              setPending(false);
              return;
            }
            router.replace("/library");
            router.refresh();
          })();
        }}
      >
        <AuthCard className="gap-4">
          <Field
            id="cw-reset-pass"
            label="New password"
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
          <FormError message={error} />
          <Button
            type="submit"
            disabled={pending}
            className="h-11.5 bg-press text-base text-press-foreground hover:bg-press-600"
          >
            {pending ? "Setting it…" : "Set password and sign in"}
          </Button>
        </AuthCard>
      </form>
    </div>
  );
}
