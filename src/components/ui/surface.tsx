import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/*
 * One card recipe, in four levels. Before this the app had six near-copies of
 * "rounded box with a ring" across nine surfaces, three of them re-declared
 * inside progress-panel.tsx alone.
 *
 * `level` is the elevation ladder from globals.css. `well` is the odd one: a
 * recessed surface gets the ring but not the lit top edge, because a light
 * edge along the top is what reads as *raised*.
 *
 * The shadcn primitives (dialog, dropdown, context menu, popover) keep their
 * own strings on purpose. They carry the same tokens, and having generated
 * files import a project component makes them harder to regenerate later.
 */
/*
 * `floating` also drops a radius step, and that is a size decision rather than an elevation
 * one. A corner radius is paid for in padding — content sitting `P` in from both edges of an
 * `R` corner only clears the arc while `P ≥ R(1 − 1/√2)`, about three tenths of it — and
 * `--radius-lg` is 28px, which asks for nine before it looks unhurried. A dialog can afford
 * that. A 274px menu cannot: at 28px the curve is a quarter of its height, and every one of
 * these surfaces is a menu.
 *
 * The handoff set the radius for cards, dialogs and the manuscript page, and for pill
 * controls; it never spoke about floating menus, which simply inherited the card value. This
 * fills that gap rather than overriding a decision.
 */
const surfaceVariants = cva("", {
  variants: {
    level: {
      seated: "rounded-[var(--radius-lg)] shadow-e0 ring-1 ring-edge",
      floating: "rounded-[var(--radius-md)] shadow-e2 ring-1 ring-edge",
      lifted: "rounded-[var(--radius-lg)] shadow-e3 ring-1 ring-edge",
      well: "rounded-[var(--radius-lg)] ring-1 ring-edge",
    },
    tone: {
      card: "bg-card",
      popover: "bg-popover",
      muted: "bg-muted/50",
      none: "",
    },
  },
  defaultVariants: { level: "seated", tone: "card" },
});

function Surface({
  className,
  level,
  tone,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof surfaceVariants>) {
  return <div data-slot="surface" className={cn(surfaceVariants({ level, tone }), className)} {...props} />;
}

export { Surface, surfaceVariants };
