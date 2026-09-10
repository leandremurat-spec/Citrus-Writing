"use client";

import * as React from "react";
import Link from "next/link";

import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password-rules";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mark } from "@/components/workspace/wordmark";

/**
 * The pieces the sign-in, sign-up and reset screens share.
 *
 * They are one visual object drawn three times, and the handoff draws them that way: the same
 * cream card at the same 56px radius, the same provider row above the same hairline divider,
 * the same pill fields under it. Keeping that in one file is what stops the three drifting —
 * which is exactly what happened to the six section labels this app already had to unify.
 */

/** The card every auth form sits in. */
export function AuthCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "flex w-full flex-col gap-4.5 rounded-[3.5rem] bg-neutral-100 p-6 shadow-e3 ring-1 ring-edge sm:p-8 lg:p-9.5",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function AuthWordmark() {
  return (
    <Link href="/" className="focus-ring inline-flex items-center gap-2.5 rounded-full">
      <Mark className="size-9.5" />
      <span className="font-heading text-[1.375rem] leading-none">Citrus Writing</span>
    </Link>
  );
}

/** A labelled pill field. Taller than the app's own `Input`, which is workspace-sized. */
export function Field({
  id,
  label,
  hint,
  error,
  children,
  action,
  ...props
}: React.ComponentProps<"input"> & {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children?: React.ReactNode;
  /** A control on the label's own line — "Forgotten it?" beside "Password". */
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="flex items-baseline justify-between gap-2.5">
        <label htmlFor={id} className="text-2xs text-neutral-800">
          {label}
        </label>
        {action}
      </span>
      <Input
        id={id}
        className="h-11 bg-surface px-3.5 text-sm"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? id + "-error" : hint ? id + "-hint" : undefined}
        {...props}
      />
      {children}
      {error ? (
        <span id={id + "-error"} className="text-3xs text-destructive">
          {error}
        </span>
      ) : hint ? (
        <span id={id + "-hint"} className="text-3xs text-subtle">
          {hint}
        </span>
      ) : null}
    </div>
  );
}

export function Divider({ label }: { label: string }) {
  return (
    <div aria-hidden="true" className="flex items-center gap-3.5">
      <span className="h-px flex-1 bg-divider" />
      <span className="text-3xs text-subtle">{label}</span>
      <span className="h-px flex-1 bg-divider" />
    </div>
  );
}

/*
 * Both provider marks are inline SVG rather than Lucide icons. Lucide v1 dropped its brand
 * glyphs — `Github` is no longer exported — and it was right to: a brand mark is an asset with
 * usage rules, not a line icon that should inherit `currentColor` and stroke width. Google's is
 * the four-colour mark it must be; GitHub's is its official single-path silhouette.
 */
function GithubMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4.5 shrink-0" fill="currentColor" aria-hidden="true">
      <path d="M12 .5a12 12 0 0 0-3.79 23.39c.6.11.82-.26.82-.58v-2.03c-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.73.08-.73 1.21.08 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.5.99.11-.78.42-1.3.76-1.6-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.13-.3-.54-1.52.11-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6.01 0c2.29-1.55 3.3-1.23 3.3-1.23.65 1.66.24 2.88.12 3.18.77.84 1.23 1.91 1.23 3.22 0 4.61-2.8 5.62-5.48 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.22.7.83.58A12 12 0 0 0 12 .5Z" />
    </svg>
  );
}

/** Google's mark, which has no Lucide equivalent — it is a brand asset, not an icon. */
function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4.5 shrink-0" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.5 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.86c2.26-2.09 3.57-5.17 3.57-8.87Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.08 7.94-2.91l-3.87-3c-1.07.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.28v3.09A12 12 0 0 0 12 24Z"
      />
      <path fill="#FBBC05" d="M5.27 14.28a7.2 7.2 0 0 1 0-4.56V6.63H1.28a12 12 0 0 0 0 10.74l3.99-3.09Z" />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.43-3.42C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.28 6.63l3.99 3.09C6.22 6.86 8.87 4.75 12 4.75Z"
      />
    </svg>
  );
}

export interface Provider {
  id: string;
  label: string;
}

/**
 * "Continue with Google" / "Continue with GitHub".
 *
 * A plain link, not a button with an onClick: the flow is a redirect off site that has to set
 * two cookies first, which only a route handler can do. `next` rides along so a writer who
 * came from a protected page lands back on it.
 *
 * Renders nothing at all when no provider is configured — the buttons and the divider above
 * the password fields both disappear, rather than leaving a lonely "or with a password"
 * separating a password form from nothing.
 */
export function ProviderButtons({ providers, next }: { providers: Provider[]; next?: string }) {
  if (providers.length === 0) return null;
  const query = next ? "?next=" + encodeURIComponent(next) : "";

  return (
    <div className="flex flex-col gap-2.5">
      {providers.map((provider) => (
        <Button
          key={provider.id}
          variant="outline"
          render={<a href={"/api/auth/oauth/" + provider.id + query} />}
          nativeButton={false}
          className="h-11.5 justify-center gap-2.5 bg-transparent text-[0.9375rem]"
        >
          {provider.id === "google" ? <GoogleMark /> : <GithubMark />}
          Continue with {provider.label}
        </Button>
      ))}
    </div>
  );
}

/**
 * The strength meter under the password field.
 *
 * Length only, and it says so — "long enough" rather than "strong". A meter that scores
 * character classes teaches people to write `Passw0rd!`, which is worse than a long
 * passphrase that this app would have to call weak. The one rule enforced on the server is
 * the length, so the one rule shown here is the length.
 */
export function PasswordMeter({ value }: { value: string }) {
  const ratio = Math.min(1, value.length / (MIN_PASSWORD_LENGTH + 6));
  const enough = value.length >= MIN_PASSWORD_LENGTH;
  const caption = value.length === 0 ? "" : enough ? "Long enough" : MIN_PASSWORD_LENGTH - value.length + " to go";

  return (
    <span className="mt-0.5 flex items-center gap-2.5">
      <span aria-hidden="true" className="relative h-[7px] flex-1 overflow-hidden rounded-full bg-neutral-300">
        <span
          className={cn(
            "absolute inset-y-0 left-0 rounded-full transition-[width] duration-state ease-state",
            enough ? "bg-ochre-600" : "bg-ochre-400",
          )}
          style={{ width: Math.round(ratio * 100) + "%" }}
        />
      </span>
      <span className={cn("text-3xs whitespace-nowrap", enough ? "text-ochre-800" : "text-subtle")}>{caption}</span>
    </span>
  );
}

/** The app has no checkbox primitive; this is the one the auth and account forms share. */
export function CheckRow({
  id,
  checked,
  onChange,
  children,
}: {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start gap-2.5 text-2xs leading-relaxed text-neutral-800">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="focus-ring mt-px size-4 shrink-0 appearance-none rounded-full border-[1.5px] border-neutral-600 bg-transparent transition-colors duration-tint ease-state checked:border-press checked:bg-press checked:shadow-[inset_0_0_0_3px_var(--background)]"
      />
      <span className="min-w-0 flex-1">{children}</span>
    </label>
  );
}

/** A failed action, said once, above the submit button. */
export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-[20px] bg-destructive/10 px-3.5 py-2.5 text-2xs leading-relaxed text-destructive">
      {message}
    </p>
  );
}
