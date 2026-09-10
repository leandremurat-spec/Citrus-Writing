"use client"

import { Progress as ProgressPrimitive } from "@base-ui/react/progress"

import { cn } from "@/lib/utils"

/*
 * Composable, unlike the generated version, which rendered its own Track and
 * Indicator after `children` and so could not carry an extra layer. The
 * sweet-spot gauge needs one: a shaded target band behind the fill.
 *
 * Root emits role="progressbar" with real aria-valuenow / min / max, which is
 * what these two bars are for — they used to be role="img" with the numbers
 * only in a label string.
 */
function Progress({ className, ...props }: ProgressPrimitive.Root.Props) {
  return <ProgressPrimitive.Root data-slot="progress" className={className} {...props} />
}

function ProgressTrack({ className, ...props }: ProgressPrimitive.Track.Props) {
  return (
    <ProgressPrimitive.Track
      data-slot="progress-track"
      className={cn("relative h-1.5 w-full overflow-hidden rounded-full bg-muted", className)}
      {...props}
    />
  )
}

function ProgressIndicator({ className, ...props }: ProgressPrimitive.Indicator.Props) {
  return (
    <ProgressPrimitive.Indicator
      data-slot="progress-indicator"
      className={cn(
        "h-full rounded-full bg-primary transition-[width,background-color] duration-state ease-state",
        className
      )}
      {...props}
    />
  )
}

function ProgressLabel({ className, ...props }: ProgressPrimitive.Label.Props) {
  return (
    <ProgressPrimitive.Label
      data-slot="progress-label"
      className={cn("text-sm font-medium", className)}
      {...props}
    />
  )
}

function ProgressValue({ className, ...props }: ProgressPrimitive.Value.Props) {
  return (
    <ProgressPrimitive.Value
      data-slot="progress-value"
      className={cn("text-sm text-muted-foreground tabular-nums", className)}
      {...props}
    />
  )
}

export { Progress, ProgressTrack, ProgressIndicator, ProgressLabel, ProgressValue }
