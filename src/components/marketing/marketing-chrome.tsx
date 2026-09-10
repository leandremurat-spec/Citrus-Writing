import Link from "next/link";

import type { SessionUser } from "@/lib/auth/session";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Mark } from "@/components/workspace/wordmark";

/**
 * The bar and the footer the signed-out pages share.
 *
 * Deliberately not the app's own `AppHeader`. That header is workspace chrome — 40px tall,
 * quiet, full of icon buttons that only mean anything with a manuscript open. A landing page
 * has the opposite job, and the handoff draws it that way: a taller bar, the mark at 36px,
 * text links, and one filled button carrying the whole call to action.
 *
 * Both take the signed-in writer when there is one, because a returning writer landing on the
 * marketing site should be offered their library rather than a second sign-up.
 */

const MAX_WIDTH = "mx-auto w-full max-w-[1200px] px-5 sm:px-10 lg:px-[72px]";

export function MarketingNav({
  user,
  links = [],
}: {
  user: SessionUser | null;
  /** In-page anchors, which differ per page — the landing has two, pricing has none. */
  links?: { href: string; label: string }[];
}) {
  return (
    <nav className={cn(MAX_WIDTH, "flex flex-wrap items-center gap-x-5 gap-y-3 py-3.5")}>
      <Link
        href={user ? "/library" : "/"}
        className="focus-ring mr-auto flex items-center gap-2.5 rounded-full font-heading text-lg whitespace-nowrap"
      >
        <Mark className="size-9" />
        Citrus Writing
      </Link>

      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="focus-ring hidden rounded-full text-sm whitespace-nowrap transition-colors duration-tint ease-state hover:text-press sm:inline"
        >
          {link.label}
        </Link>
      ))}

      <Link
        href="/pricing"
        className="focus-ring rounded-full text-sm whitespace-nowrap transition-colors duration-tint ease-state hover:text-press"
      >
        Pricing
      </Link>

      {user ? (
        <Button
          render={<Link href="/library" />}
          nativeButton={false}
          className="h-10 bg-press px-5 text-sm text-press-foreground hover:bg-press-600"
        >
          Your library
        </Button>
      ) : (
        <>
          <Link
            href="/sign-in"
            className="focus-ring rounded-full text-sm whitespace-nowrap transition-colors duration-tint ease-state hover:text-press"
          >
            Sign in
          </Link>
          <Button
            render={<Link href="/sign-up" />}
            nativeButton={false}
            className="h-10 bg-press px-5 text-sm text-press-foreground hover:bg-press-600"
          >
            Start writing
          </Button>
        </>
      )}
    </nav>
  );
}

export function MarketingFooter({ note }: { note: string }) {
  return (
    <footer
      className={cn(
        MAX_WIDTH,
        "flex flex-wrap items-center gap-x-7 gap-y-3 py-8 text-xs text-subtle sm:py-11 lg:py-13",
      )}
    >
      <span className="flex items-center gap-2.5">
        <Mark className="size-[22px]" />
        Citrus Writing
      </span>
      <Link href="/pricing" className="focus-ring rounded-full text-press hover:text-press-800">
        Pricing
      </Link>
      <Link href="/sign-in" className="focus-ring rounded-full text-press hover:text-press-800">
        Sign in
      </Link>
      <span className="sm:ml-auto">{note}</span>
    </footer>
  );
}

/** The page column every marketing section sits in — one place, so they cannot drift apart. */
export function MarketingWidth({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn(MAX_WIDTH, className)}>{children}</div>;
}
