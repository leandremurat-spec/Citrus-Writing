import * as React from "react";
import Link from "next/link";

/**
 * Inline formatting for the legal documents: `*bold*` and `[label](href)`. Two rules, and that
 * is the whole grammar.
 *
 * `Emphasis` in the marketing components already does the first, and this deliberately does not
 * extend it. That one's contract is "one rule, and an unmatched star is a star", which is what
 * makes `site-copy.ts` safe for a non-programmer to edit; adding links to it would give that
 * file a second syntax and a new way to break the landing page. The legal documents genuinely
 * need links — a policy that says "see the Privacy Policy" without going there is worse than
 * useless — so they get their own renderer with its own, slightly larger, grammar.
 *
 * Still not Markdown, for the reason stated in `Emphasis`: a parser is a dependency and a dozen
 * syntaxes nobody asked for, on the pages that must not break.
 *
 * A link is internal when it starts with `/`, and internal links go through `next/link` so the
 * cross-references between the three documents do not cost a full page load. Anything else is
 * treated as leaving the site — including `mailto:`, which is not a navigation at all but wants
 * the same plain anchor.
 */

const TOKEN = /(\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g;
const LINK = /^\[([^\]]+)\]\(([^)]+)\)$/;

const linkClass = "focus-ring rounded-full text-press underline decoration-press/35 underline-offset-2 transition-colors duration-tint ease-state hover:text-press-800 hover:decoration-press-800";

export function LegalText({ text }: { text: string }) {
  const parts = text.split(TOKEN);

  return (
    <>
      {parts.map((part, index) => {
        const link = LINK.exec(part);
        if (link) {
          const [, label, href] = link;
          return href.startsWith("/") ? (
            <Link key={index} href={href} className={linkClass}>
              {label}
            </Link>
          ) : (
            <a
              key={index}
              href={href}
              className={linkClass}
              // A `mailto:` opens a mail client rather than a tab, so the new-tab treatment is
              // only right for a real destination.
              {...(href.startsWith("mailto:") ? {} : { target: "_blank", rel: "noreferrer" })}
            >
              {label}
            </a>
          );
        }

        if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
          return (
            <strong key={index} className="font-semibold text-foreground">
              {part.slice(1, -1)}
            </strong>
          );
        }

        return <React.Fragment key={index}>{part}</React.Fragment>;
      })}
    </>
  );
}
