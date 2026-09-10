"use client";

import * as React from "react";
import { Lock } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * The Organic design system's `.seg` — one hairline capsule, the chosen option filled.
 *
 * Extracted because four surfaces now draw one: the export dialog's scope and format rows, and
 * the billing interval on both the pricing page and the account page. Four hand-rolled copies
 * is how the six section labels this app already had to unify got there in the first place.
 *
 * **Buttons in a `role="group"`, not radios.** These change something immediately rather than
 * holding a value for a form to submit, so `aria-pressed` is the honest state — and a
 * hairline-separated capsule is not a radio group visually either.
 *
 * `locked` is the one addition to the handoff's own control: an option a writer's plan does
 * not include stays visible with a padlock and a route to the pricing page, rather than being
 * removed. Hiding it would leave a writer wondering whether whole-serial export exists at all;
 * showing it disabled with no explanation is worse again.
 */

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  /** Not available on this plan: rendered with a padlock, and `onLocked` is called instead. */
  locked?: boolean;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  onLocked,
  label,
  size = "default",
  className,
}: {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  onLocked?: (value: T) => void;
  /** Names the group for assistive technology — these rarely sit under a visible label. */
  label: string;
  size?: "default" | "sm";
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn("inline-flex flex-wrap overflow-hidden rounded-full border border-neutral-400", className)}
    >
      {options.map((option, index) => {
        const active = option.value === value && !option.locked;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => (option.locked ? onLocked?.(option.value) : onChange(option.value))}
            className={cn(
              "focus-ring-inset inline-flex items-center gap-1.5 transition-colors duration-tint ease-state",
              size === "sm" ? "px-3 py-1.75 text-2xs" : "px-4.5 py-2.5 text-sm",
              // The divider goes on every option but the first, and disappears under a filled
              // pill's own rounding — which is exactly what the CSS `.seg-opt + .seg-opt` rule
              // in the handoff does.
              index > 0 && !active && "border-l border-neutral-400",
              active
                ? "rounded-full bg-press font-semibold text-press-foreground"
                : option.locked
                  ? "text-subtle hover:bg-neutral-200 hover:text-neutral-800"
                  : "text-neutral-800 hover:bg-neutral-200",
            )}
          >
            {option.locked && <Lock className="size-3" aria-hidden />}
            {option.label}
            {option.locked && <span className="sr-only">— on the Serial plan</span>}
          </button>
        );
      })}
    </div>
  );
}
