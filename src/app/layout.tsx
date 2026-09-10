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

export const metadata: Metadata = {
  title: {
    default: "Citrus Writing",
    template: "%s · Citrus Writing",
  },
  description: "A writing and publishing workspace built for webnovel and serial fiction authors.",
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
