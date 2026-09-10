"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CalendarClock, Milestone } from "lucide-react";
import { toast } from "sonner";

import { createNovel } from "@/lib/actions/novels";
import { Button } from "@/components/ui/button";
import { TitleDialog } from "@/components/binder/binder-dialogs";
import { Mark } from "@/components/workspace/wordmark";

const STEPS = [
  { icon: Milestone, label: "An arc holds the chapters" },
  { icon: "1", label: "Each chapter takes its place in the run" },
  { icon: CalendarClock, label: "A Saturday turns done into ahead" },
] as const;

/** Shown when this writer has no serials yet — a fresh account, or one emptied out. */
export function Welcome({ penName }: { penName?: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);

  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <div className="w-full max-w-lg text-center">
        <Mark className="mx-auto size-[88px]" />
        <h1 className="mt-5 font-heading text-4xl tracking-tight">
          {penName ? "Welcome, " + penName + "." : "Citrus Writing"}
        </h1>
        <p className="mt-3 text-base text-muted-foreground">
          Name your first serial and you get an Arc 1 and a Chapter 1 to write in straight away.
        </p>

        <div className="mt-8 flex justify-center gap-6">
          {STEPS.map((step, index) => (
            <div key={index} className="flex w-28 flex-col items-center gap-2">
              <span
                className={
                  index % 2 === 0
                    ? "flex size-11 items-center justify-center rounded-full bg-ochre-100 text-ochre-800"
                    : "flex size-11 items-center justify-center rounded-full bg-press-100 font-heading text-base text-press-800"
                }
              >
                {typeof step.icon === "string" ? step.icon : <step.icon className="size-5" />}
              </span>
              <span className="text-xs text-foreground/80">{step.label}</span>
            </div>
          ))}
        </div>

        <Button size="lg" className="mt-8" onClick={() => setOpen(true)}>
          Start your first serial <ArrowRight />
        </Button>
      </div>

      <TitleDialog
        open={open}
        onOpenChange={setOpen}
        heading="New novel"
        description=""
        initialValue=""
        submitLabel="Create novel"
        onSubmit={async (title) => {
          const response = await createNovel({ title });
          if (!response.ok) {
            toast.error(response.error);
            return false;
          }
          router.push(`/novels/${response.id}/chapters/${response.chapterId}`);
        }}
      />
    </main>
  );
}
