import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * The bar at the top of a workspace panel: binder header, command-centre tab
 * bar, editor toolbar. `h-chrome` is the shared 40px constant — the three used
 * to write `h-10` separately, which is the same number until someone changes
 * one of them.
 */
function PanelChrome({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="panel-chrome"
      className={cn("flex h-chrome shrink-0 items-center border-b border-divider", className)}
      {...props}
    />
  );
}

/**
 * The quiet strip of guidance at the foot of a panel ("Type @ in the editor
 * to link or create an entry"). Two panels carry one, character for character.
 */
function PanelFootnote({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="panel-footnote"
      className={cn("shrink-0 border-t border-divider px-3 py-2 text-2xs text-subtle", className)}
      {...props}
    />
  );
}

export { PanelChrome, PanelFootnote };
