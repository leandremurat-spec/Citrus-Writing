"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { applyAppearanceVars, useAppearance } from "@/components/workspace/appearance-store";
import { PALETTE_ATTRIBUTE, PALETTE_KEY } from "@/components/workspace/palette-store";
import { PALETTE_IDS } from "@/lib/theme/palettes";

/**
 * Light/dark is one axis; the palette (Citrus, Moonlight, Evergreen, Celestial) is the
 * other, and lives in `palette-store.ts`. next-themes owns only the first.
 *
 * The default is "system", and that is a change from the previous `defaultTheme="dark"`. That
 * value was set when the app had a dark writing-room palette; through the Citrus overhaul it
 * has been pointing at a `.dark` block identical to `:root`, so every writer has been looking
 * at the light theme regardless of what the setting said. Now that the two modes genuinely
 * differ, something has to decide — and the honest answer for a device-level preference is the
 * device's own. Dark and Light are still one click away in Settings.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      // The class flips on <html>; without this every colour token would
      // transition at once when the theme changes, which reads as a smear.
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}

/*
 * The palette's answer to the flash-of-wrong-theme problem, and the same trick next-themes
 * uses for `.dark`: a tiny synchronous script that puts the stored palette on <html> before
 * the browser paints anything. Without it a writer on Celestial would see a frame of cream.
 *
 * Kept deliberately small and dependency-free — it runs before React exists. It validates
 * against the real id list rather than trusting storage, and writes nothing at all when
 * there is no stored value, which is what makes the generated stylesheet's unqualified
 * default block (Citrus) the fallback.
 */
const PALETTE_SCRIPT = `(function(){try{var p=localStorage.getItem(${JSON.stringify(
  PALETTE_KEY,
)});if(${JSON.stringify(PALETTE_IDS)}.indexOf(p)>-1){document.documentElement.setAttribute(${JSON.stringify(
  PALETTE_ATTRIBUTE,
)},p)}}catch(e){}})()`;

export function PaletteScript() {
  // A plain inline <script>, not next/script: it has to run synchronously and in document
  // order, ahead of first paint, which is exactly what next/script's loading strategies are
  // built to avoid.
  return <script suppressHydrationWarning dangerouslySetInnerHTML={{ __html: PALETTE_SCRIPT }} />;
}

/**
 * Mirrors the appearance settings onto <html> as CSS custom properties, from an effect rather
 * than during render — writing to the DOM while rendering is not something React promises to
 * run once. The CSS carries the same defaults as fallbacks, so a first paint before this runs
 * is only ever wrong for someone who has changed a setting, and only for a frame.
 */
export function AppearanceVars() {
  const appearance = useAppearance();
  React.useEffect(() => applyAppearanceVars(appearance), [appearance]);
  return null;
}

/** Sonner needs to be told the theme; it does not read the `dark` class. */
export function ThemedToaster() {
  const { resolvedTheme } = useTheme();
  return <Toaster theme={resolvedTheme === "light" ? "light" : "dark"} position="bottom-right" />;
}
