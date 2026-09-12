import type { Metadata } from "next";
import { Caprasimo, EB_Garamond, Figtree, Lora, Newsreader, Source_Serif_4 } from "next/font/google";

import { TooltipProvider } from "@/components/ui/tooltip";
import {
  AppearanceVars,
  PaletteScript,
  ThemedToaster,
  ThemeProvider,
} from "@/components/workspace/theme-provider";
import { UiInspector } from "@/components/workspace/ui-inspector";
import { legalDetails } from "@/content/legal/details";
import { cn } from "@/lib/utils";

import "./globals.css";

/*
 * Figtree carries chrome; Caprasimo is the display face, reserved for headings and the
 * wordmark. Both fallbacks are sans, matching the new direction (see CLAUDE.md).
 *
 * The manuscript face stays configurable per device rather than fixed to one of these: all
 * four serif candidates from the handoff are loaded here so Settings → Manuscript face can
 * switch between them without a network round trip. Newsreader remains the shipped default —
 * see src/lib/settings/appearance.ts.
 */
const figtree = Figtree({ subsets: ["latin"], variable: "--font-figtree", display: "swap" });
const caprasimo = Caprasimo({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-caprasimo",
  display: "swap",
});
const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--font-newsreader",
  display: "swap",
  axes: ["opsz"],
});
const lora = Lora({ subsets: ["latin"], variable: "--font-lora", display: "swap" });
const sourceSerif4 = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-source-serif-4",
  display: "swap",
  axes: ["opsz"],
});
const ebGaramond = EB_Garamond({ subsets: ["latin"], variable: "--font-eb-garamond", display: "swap" });

const SITE = legalDetails.siteUrl;

export const metadata: Metadata = {
  /*
   * Without metadataBase, every relative URL Next generates for a share card resolves against
   * nothing and the card arrives with no image. It is the one line that makes the rest of this
   * block work, and the one most easily left out, because nothing on the site itself looks
   * wrong when it is missing.
   *
   * It reads from the legal details rather than an environment variable so that the address in
   * the Terms and the address in a share card cannot become two different claims.
   */
  metadataBase: new URL(SITE),
  title: {
    default: "Citrus Writing",
    template: "%s · Citrus Writing",
  },
  description: "A writing and publishing workspace built for webnovel and serial fiction authors.",
  applicationName: "Citrus Writing",
  /*
   * The share card. Every per-page `metadata` export inherits these and overrides only what it
   * names, so a link to /pricing carries its own title and this image.
   *
   * `opengraph-image.tsx` beside this file supplies the picture; Next fills in the url, type
   * and dimensions from it, which is why none of them are written here.
   */
  openGraph: {
    type: "website",
    siteName: "Citrus Writing",
    locale: "en_CA",
    url: SITE,
    title: "Citrus Writing — a workspace for webauthors",
    description:
      "Write the next one, stay ahead of the last. A workspace built for webnovels and serials: chapters, arcs, a release buffer and a codex that keeps your cast straight.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Citrus Writing — a workspace for webauthors",
    description:
      "Write the next one, stay ahead of the last. A workspace built for webnovels and serials.",
  },
  // The writing surfaces are all behind sign-in and already unreachable to a crawler; this says
  // so explicitly for the marketing pages' sake, which are the ones meant to be indexed.
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // `suppressHydrationWarning` earns its place twice over here. Browser extensions
    // (Dark Reader, Grammarly, and friends) stamp attributes onto <html> and <body>
    // before React hydrates, and next-themes writes the theme class onto <html> from an
    // inline script for the same reason — to beat first paint. It applies only to these
    // two elements' own attributes, so real mismatches inside the app are still reported.
    // No hardcoded `dark` any more: ThemeProvider owns that class.
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        "h-full font-sans",
        figtree.variable,
        caprasimo.variable,
        newsreader.variable,
        lora.variable,
        sourceSerif4.variable,
        ebGaramond.variable,
      )}
    >
      <head>
        {/*
          Asks the Dark Reader extension to leave this app alone, which it honours.

          Not a hydration workaround that happens to help the design — the other way round. This
          app ships four palettes in light *and* dark, generated from one source and audited at
          472 contrast pairings; an extension re-tinting that on top undoes the exact guarantee
          the theme system exists to make. A writer who wants dark has Settings → Theme.

          The hydration noise is only the symptom that made it visible. Dark Reader rewrites
          inline styles and SVG strokes before React hydrates — `--darkreader-inline-color` on
          the wordmark's <img>, `data-darkreader-inline-stroke` on every Lucide icon — and React
          then finds markup that is not what the server sent. There is no suppressing that one
          element at a time: `suppressHydrationWarning` covers an element's own attributes, not
          its subtree, and the icons are everywhere.

          Written as JSX rather than through `metadata.other`, because the tag Dark Reader looks
          for carries no content attribute and Next drops an `other` entry whose value is empty.
        */}
        <meta name="darkreader-lock" />

        {/*
          Plausible: the only thing in this app that measures anything about a visitor.

          Chosen because of what it does *not* do. It sets no cookie, so the strictly-necessary
          session cookie stays the only one here and this app still owes no consent banner under
          the UK/EU e-privacy rules or Law 25 — a cookie-based analytics tool would have required
          one on every page, plus the consent state to go with it. It stores no cross-site
          identifier and builds no profile, and its servers are in the EU, which makes it the one
          processor in the stack that is not a transfer to the United States.

          It is production-only, deliberately. Left on in development it would file the writer's
          own localhost clicking about as real traffic, which is both useless and the sort of
          thing you discover a month later in a number you then cannot trust. The UI inspector
          is gated the same way, in the opposite direction.

          The privacy policy names it, says what it collects, and explains the no-banner
          position; see `content/legal/privacy.ts` and the sub-processor table in
          `content/legal/details.ts`. Those are not optional companions to this tag — before it,
          the policy said in as many words that there was no analytics of any kind.
        */}
        {process.env.NODE_ENV === "production" ? (
          <>
            <script defer src="https://plausible.io/js/pa-lJLhd564jFHAwB0VWC4L8.js" />
            <script
              dangerouslySetInnerHTML={{
                __html:
                  "window.plausible=window.plausible||function(){(plausible.q=plausible.q||[]).push(arguments)}," +
                  "plausible.init=plausible.init||function(i){plausible.o=i||{}};plausible.init()",
              }}
            />
          </>
        ) : null}
      </head>
      <body suppressHydrationWarning className="min-h-full bg-background text-foreground">
        {/* First thing in the body, and before the provider: it must set data-palette on
            <html> ahead of first paint, or a writer on a non-default palette sees a frame of
            Citrus cream. next-themes does the same for the `dark` class. */}
        <PaletteScript />
        <ThemeProvider>
          <AppearanceVars />
          <TooltipProvider>{children}</TooltipProvider>
          <ThemedToaster />
          {/* ⌘/Ctrl + Shift + U. Dev only, and the check is a literal so the bundler drops
              the whole branch from a production build rather than shipping it dormant. */}
          {process.env.NODE_ENV !== "production" && <UiInspector />}
        </ThemeProvider>
      </body>
    </html>
  );
}
