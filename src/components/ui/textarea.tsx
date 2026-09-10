import * as React from "react"

import { cn } from "@/lib/utils"

/*
 * `rounded-md` (16px), not the `rounded-3xl` (56px) this shipped with.
 *
 * A textarea has `overflow: auto`, so its border-radius *clips its own text*. On a single-line
 * input a huge radius is harmless — it caps at half the height and the text is centred well
 * inside it — but a textarea is tall, its text starts at the top-left, and a 56px corner cuts
 * straight through the first and last lines. In the chapter notes panel, which overrides the
 * padding down to 4px, the corner was eating about seventeen pixels of the first line.
 *
 * This is the pill rule's one real exception, and the reason is mechanical rather than
 * aesthetic: a pill only works where the radius cannot reach the content.
 */
function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-16 w-full rounded-md border border-input bg-transparent px-4 py-2.5 text-base transition-colors duration-tint ease-state outline-none placeholder:text-muted-foreground focus-ring disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
