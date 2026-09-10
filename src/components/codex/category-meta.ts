import { Gem, MapPin, UserRound } from "lucide-react";

import type { CodexCategory } from "@/lib/codex/types";

/** Shared look for the three codex categories: panel rows, @ popover, and hover cards. */
export interface CategoryMeta {
  singular: string;
  plural: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Avatar-placeholder colours. */
  tint: string;
  /** Icon-only colour, for inline metadata lines. */
  text: string;
}

export const CATEGORY_META: Record<CodexCategory, CategoryMeta> = {
  CHARACTER: {
    singular: "Character",
    plural: "Characters",
    icon: UserRound,
    tint: "bg-press/20 text-press",
    text: "text-press",
  },
  LOCATION: {
    singular: "Location",
    plural: "Locations",
    icon: MapPin,
    tint: "bg-ochre/20 text-ochre",
    text: "text-ochre",
  },
  ITEM: {
    singular: "Item",
    plural: "Items",
    icon: Gem,
    // Neutral, not parchment: --stock is near-white, so in light mode this avatar was
    // white on white at 1.13:1. Sage and honey are taken; the third category takes no hue.
    tint: "bg-foreground/10 text-foreground",
    text: "text-muted-foreground",
  },
};

/** "Wren Ashcombe" → "WA", for the avatar placeholder. */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
