import { cn } from "@/lib/utils";

/**
 * The landing page's hero illustration: the Run band, drawn small.
 *
 * A separate, decorative retelling of `workspace/run-band.tsx` rather than that component
 * reused. The real one reads a binder tree, derives run numbers, scrolls the open chapter into
 * view and links every dot to a route; none of that means anything to someone who has not
 * signed up. What has to survive is the *vocabulary* — size is length, fill is status, a ring
 * is where you are, a dashed line is where readers have got to — so the two agree on colour
 * and shape and on nothing else.
 *
 * The hollow "draft" ring is `neutral-600`, not the handoff's `neutral-400`. That is the same
 * correction the app made everywhere else a hollow ring appears: at 400 it measures about
 * 1.5:1 on this ground, under even the 3:1 floor WCAG sets for a non-text boundary.
 */

type Seed =
  | { kind: "published"; size: number }
  | { kind: "edited"; size: number }
  | { kind: "queued"; size: number }
  | { kind: "draft"; size: number };

interface Rung {
  number: number;
  seed: Seed;
  /** Which way the strand leaves this seed, drawn as a rule under it. */
  strand: "none" | "left" | "right" | "through";
  /** The chapter open right now: ringed, and the only bold number. */
  current?: boolean;
  /** The dashed marker sits before this rung: everything left of it, readers have seen. */
  readerLineBefore?: boolean;
}

const RUNGS: Rung[] = [
  { number: 1, seed: { kind: "edited", size: 14 }, strand: "none" },
  { number: 2, seed: { kind: "published", size: 24 }, strand: "left" },
  { number: 3, seed: { kind: "published", size: 22 }, strand: "through" },
  { number: 4, seed: { kind: "edited", size: 18 }, strand: "right", current: true, readerLineBefore: true },
  { number: 5, seed: { kind: "draft", size: 13 }, strand: "none" },
  { number: 6, seed: { kind: "queued", size: 24 }, strand: "left" },
  { number: 7, seed: { kind: "draft", size: 9 }, strand: "right" },
];

function seedClass(seed: Seed): string {
  switch (seed.kind) {
    case "published":
      return "bg-press";
    case "edited":
      return "bg-ochre-400";
    case "queued":
      return "bg-press-200 shadow-[inset_0_0_0_2px_var(--press)] motion-safe:animate-run-breathe";
    case "draft":
      return "shadow-[inset_0_0_0_1.5px_var(--neutral-600)]";
  }
}

function strandClass(strand: Rung["strand"]): string {
  switch (strand) {
    case "none":
      return "";
    case "left":
      return "w-full border-t-2 border-l-2 border-ochre-300 rounded-tl-[9px] mt-[5px]";
    case "right":
      return "w-full border-t-2 border-r-2 border-ochre-300 rounded-tr-[9px] mt-[5px]";
    case "through":
      return "w-full border-t-2 border-ochre-300 mt-[5px]";
  }
}

export function RunStrand({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-start overflow-x-auto pb-1", className)} aria-hidden="true">
      {RUNGS.map((rung) => (
        <div key={rung.number} className="contents">
          {rung.readerLineBefore && (
            <div className="flex w-[34px] flex-none flex-col items-center self-stretch pt-[18px]">
              <span className="w-0 flex-1 border-l-2 border-dashed border-ochre-600" />
            </div>
          )}
          <div className="flex w-[46px] flex-none flex-col items-center">
            <span
              className={cn(
                "h-[18px] text-2xs tabular-nums",
                rung.current ? "font-bold text-press" : "text-subtle",
              )}
            >
              {rung.number}
            </span>
            <span
              className={cn(
                "flex size-[34px] items-center justify-center rounded-full",
                rung.current && "shadow-[inset_0_0_0_2px_var(--press)]",
              )}
            >
              <span
                className={cn("rounded-full", seedClass(rung.seed))}
                style={{ width: rung.seed.size, height: rung.seed.size }}
              />
            </span>
            <span className={cn("h-4", strandClass(rung.strand))} />
          </div>
        </div>
      ))}
    </div>
  );
}

const LEGEND = [
  { label: "Published", node: <span className="size-4 flex-none rounded-full bg-press" /> },
  {
    label: "Queued",
    node: <span className="size-4 flex-none rounded-full bg-press-200 shadow-[inset_0_0_0_2px_var(--press)]" />,
  },
  { label: "Edited", node: <span className="size-3.5 flex-none rounded-full bg-ochre-400" /> },
  {
    label: "Draft",
    node: <span className="size-3 flex-none rounded-full shadow-[inset_0_0_0_1.5px_var(--neutral-600)]" />,
  },
  { label: "Where readers are", node: <span className="w-4 flex-none border-t-2 border-dashed border-ochre-600" /> },
];

export function RunLegend() {
  return (
    <div className="flex flex-wrap gap-x-6 gap-y-3">
      {LEGEND.map((item) => (
        <span key={item.label} className="flex items-center gap-2.5 text-sm text-neutral-800">
          {item.node}
          {item.label}
        </span>
      ))}
    </div>
  );
}
