import Link from "next/link";

/**
 * The line under a sign-up button: what pressing it agrees to.
 *
 * ── Why a sentence and not a tick box ─────────────────────────────────────────
 *
 * An unticked box is the right control for a *separate* consent — the marketing opt-in beside
 * it is one, and it is a box for exactly that reason. Agreeing to the terms is not separate
 * from creating the account; it *is* creating the account, and there is no version of the
 * product for someone who declines. A box that cannot be left unticked and still get you
 * anywhere is friction pretending to be a choice.
 *
 * What makes the sentence stand up is where it sits: immediately under the button, before the
 * press rather than after it, in the same visual group, with both documents linked and named.
 * That is the pattern courts have upheld and the one a bare "see our terms" link in a footer
 * fails.
 *
 * ── Why it is not in `site-copy.ts` ───────────────────────────────────────────
 *
 * Every other word on these pages is editable there by design. This one is not, because the
 * sentence is the record of what was agreed to — reworded by someone rewriting the marketing,
 * it stops matching the thing it points at.
 */
export function LegalConsent({
  action,
  className = "text-2xs leading-relaxed text-subtle",
}: {
  /** How the sentence opens: "Creating an account", "Subscribing". */
  action: string;
  className?: string;
}) {
  return (
    <p className={className}>
      {action} means you agree to our{" "}
      <Link href="/legal/terms" className="focus-ring rounded-full text-press underline underline-offset-2 hover:text-press-800">
        Terms of Service
      </Link>{" "}
      and{" "}
      <Link href="/legal/privacy" className="focus-ring rounded-full text-press underline underline-offset-2 hover:text-press-800">
        Privacy Policy
      </Link>
      .
    </p>
  );
}
