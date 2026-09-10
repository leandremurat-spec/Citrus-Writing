"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Check, Minus, Moon, MonitorSmartphone, Plus, Sun } from "lucide-react";

import {
  PROSE_FACES,
  TYPE_SIZE_MAX,
  TYPE_SIZE_MIN,
  type Measure,
  type ProseFace,
} from "@/lib/settings/appearance";
import { PALETTE_LIST, paletteSwatch } from "@/lib/theme/palettes";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { resetAppearance, setAppearance, useAppearance } from "@/components/workspace/appearance-store";
import { setPalette, usePalette } from "@/components/workspace/palette-store";

/**
 * The Settings tab. Everything here is about *this screen* and is stored on this device; the
 * daily goal and the sweet spot are facts about the writer's practice and live in the database,
 * which is why they are not on this panel. That used to be said in a footnote under the panel —
 * it is a note for whoever edits this file, not something a writer needs told.
 */
export function SettingsPanel() {
  const a = useAppearance();

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-4">
        <Group title="The page">
          <ThemeChoice />
          <PaletteChoice />

          <Slider
            label="Page brightness"
            value={a.pageBrightness}
            onChange={(pageBrightness) => setAppearance({ pageBrightness })}
            tint="bg-press"
          />

          <Slider
            label="Lamplight"
            value={a.lamplight}
            onChange={(lamplight) => setAppearance({ lamplight })}
            tint="bg-ochre"
          />

          <Field label="Measure">
            <Segmented<Measure>
              value={a.measure}
              onChange={(measure) => setAppearance({ measure })}
              options={[
                { value: "narrow", label: "Narrow" },
                { value: "comfortable", label: "Comfortable" },
                { value: "wide", label: "Wide" },
              ]}
            />
          </Field>

          <Row label="Type size">
            <Stepper
              value={`${a.typeSize}px`}
              onDecrement={() => setAppearance({ typeSize: a.typeSize - 1 })}
              onIncrement={() => setAppearance({ typeSize: a.typeSize + 1 })}
              decrementDisabled={a.typeSize <= TYPE_SIZE_MIN}
              incrementDisabled={a.typeSize >= TYPE_SIZE_MAX}
              label="Manuscript type size"
            />
          </Row>

          <Field label="Manuscript face">
            <FaceChoice value={a.proseFace} onChange={(proseFace) => setAppearance({ proseFace })} />
          </Field>
        </Group>

        <Group title="While writing">
          <Switch
            label="Keep the current line off the bottom edge"
            checked={a.typewriter}
            onChange={(typewriter) => setAppearance({ typewriter })}
          />
          <Switch
            label="Dim other paragraphs"
            checked={a.dimOthers}
            onChange={(dimOthers) => setAppearance({ dimOthers })}
          />
          <Switch
            label="Show the toolbar"
            checked={a.showToolbar}
            onChange={(showToolbar) => setAppearance({ showToolbar })}
          />
        </Group>

        <div>
          <Button variant="outline" size="sm" onClick={resetAppearance}>
            Reset to defaults
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Controls                                                           */
/*  Hand-rolled on native inputs rather than pulled from a library:    */
/*  a range input and a checkbox already carry the right roles, keys   */
/*  and value announcements, and skinning them is less code than       */
/*  re-implementing them.                                              */
/* ------------------------------------------------------------------ */

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h3 className="label-section">{title}</h3>
      {children}
    </section>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <div>
        <p className="text-xs text-foreground">{label}</p>
        {hint && <p className="mt-0.5 text-2xs text-subtle">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs text-foreground">{label}</p>
        {hint && <p className="mt-0.5 text-2xs text-subtle">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

function Slider({
  label,
  hint,
  value,
  onChange,
  tint,
}: {
  label: string;
  hint?: string;
  value: number;
  onChange: (value: number) => void;
  tint: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-foreground">{label}</p>
          {hint && <p className="mt-0.5 text-2xs text-subtle">{hint}</p>}
        </div>
        <span className="shrink-0 text-2xs text-subtle tabular-nums">{value}%</span>
      </div>
      <div className="relative flex h-4 items-center">
        <div className="absolute inset-x-0 h-1 rounded-full bg-muted" aria-hidden />
        <div className={cn("absolute left-0 h-1 rounded-full", tint)} style={{ width: `${value}%` }} aria-hidden />
        <span
          className="pointer-events-none absolute size-3 -translate-x-1/2 rounded-full bg-foreground shadow-e1"
          style={{ left: `${value}%` }}
          aria-hidden
        />
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={value}
          aria-label={label}
          onChange={(event) => onChange(Number(event.target.value))}
          className="bare-range focus-ring absolute inset-x-0 h-4 w-full cursor-pointer appearance-none bg-transparent"
        />
      </div>
    </div>
  );
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (value: T) => void;
  options: readonly { value: T; label: string; icon?: React.ReactNode }[];
}) {
  return (
    <div className="flex flex-wrap gap-1 rounded-md bg-muted/60 p-1.5 ring-1 ring-edge">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "focus-ring-inset flex h-7 flex-1 items-center justify-center gap-1.5 rounded-sm text-2xs transition-colors duration-tint ease-state",
              active ? "bg-card text-foreground shadow-e0 ring-1 ring-edge" : "text-subtle hover:text-foreground",
            )}
          >
            {option.icon}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * The manuscript face, as a list rather than a segmented control.
 *
 * `Segmented` gives every option `flex-1`, which is right for Light/Dark/Auto and wrong for
 * five font names: "Source Serif" and "EB Garamond" were being folded onto two lines inside a
 * 41px cell 28px tall. Equal-width cells only work when the labels are of equal weight.
 *
 * The list also does the thing a font picker ought to — each name is set in the face it names,
 * so the choice is made by looking rather than by recognising. That is worth a little more
 * vertical room in a panel that scrolls anyway.
 */
function FaceChoice({ value, onChange }: { value: ProseFace; onChange: (face: ProseFace) => void }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-md bg-muted/60 p-1.5 ring-1 ring-edge">
      {Object.entries(PROSE_FACES).map(([id, face]) => {
        const active = id === value;
        return (
          <button
            key={id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(id as ProseFace)}
            className={cn(
              "focus-ring-inset flex items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-left transition-colors duration-tint ease-state",
              active ? "bg-card text-foreground shadow-e0 ring-1 ring-edge" : "text-subtle hover:text-foreground",
            )}
          >
            <span className="truncate text-sm" style={{ fontFamily: face.family }}>
              {face.label}
            </span>
            {active && <Check className="size-3 shrink-0 text-press" />}
          </button>
        );
      })}
    </div>
  );
}

function Stepper({
  value,
  label,
  onDecrement,
  onIncrement,
  decrementDisabled,
  incrementDisabled,
}: {
  value: string;
  label: string;
  onDecrement: () => void;
  onIncrement: () => void;
  decrementDisabled?: boolean;
  incrementDisabled?: boolean;
}) {
  return (
    <div className="flex shrink-0 items-center gap-0.5 rounded-full ring-1 ring-edge">
      <Button variant="ghost" size="icon-xs" aria-label={`Decrease ${label}`} disabled={decrementDisabled} onClick={onDecrement}>
        <Minus />
      </Button>
      <span className="min-w-10 text-center text-2xs text-foreground tabular-nums">{value}</span>
      <Button variant="ghost" size="icon-xs" aria-label={`Increase ${label}`} disabled={incrementDisabled} onClick={onIncrement}>
        <Plus />
      </Button>
    </div>
  );
}

function Switch({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3">
      <span className="min-w-0">
        <span className="block text-xs text-foreground">{label}</span>
        {hint && <span className="mt-0.5 block text-2xs text-subtle">{hint}</span>}
      </span>
      <span className="relative shrink-0">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className="peer sr-only"
        />
        <span
          aria-hidden
          className={cn(
            "peer-focus-visible:outline-ring block h-4.5 w-8 rounded-full transition-colors duration-tint ease-state peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2",
            checked ? "bg-press" : "bg-muted ring-1 ring-edge ring-inset",
          )}
        />
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute top-1 size-2.5 rounded-full transition-[left] duration-state ease-state",
            checked ? "left-4.5 bg-press-foreground" : "left-1 bg-subtle",
          )}
        />
      </span>
    </label>
  );
}

/*
 * next-themes only knows the real value on the client; rendering it before hydration would
 * mark whichever option the server guessed as active and then swap it. This is the "am I
 * hydrated" read without a setState in an effect: the server snapshot is false.
 */
function useMounted(): boolean {
  return React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

function ThemeChoice() {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();

  return (
    <Field label="Theme">
      <Segmented
        value={mounted ? (theme ?? "system") : "system"}
        onChange={setTheme}
        options={[
          { value: "light", label: "Light", icon: <Sun className="size-3" /> },
          { value: "dark", label: "Dark", icon: <Moon className="size-3" /> },
          { value: "system", label: "Auto", icon: <MonitorSmartphone className="size-3" /> },
        ]}
      />
    </Field>
  );
}

/**
 * The palette picker. Swatches rather than names alone, because "Evergreen" tells a writer
 * nothing about what their manuscript will look like — and each swatch is drawn in the mode
 * that is *currently* resolved, so what it shows is what selecting it produces right now,
 * not a light-mode preview of a dark screen.
 *
 * The colours come from `paletteSwatch()`, which reads the same palette data the stylesheet
 * is generated from. Nothing here is a hardcoded hex, so a swatch cannot drift from what the
 * browser paints.
 */
function PaletteChoice() {
  const palette = usePalette();
  const { resolvedTheme } = useTheme();
  const mounted = useMounted();
  // Before hydration, next-themes has no resolved value. Light is the safe guess: it is what
  // the server rendered, and the swatches settle a frame later along with the rest of the app.
  const scheme = mounted && resolvedTheme === "dark" ? "dark" : "light";

  return (
    <Field label="Palette">
      <div className="grid grid-cols-2 gap-1.5">
        {PALETTE_LIST.map((entry) => {
          const swatch = paletteSwatch(entry, scheme);
          const active = entry.id === palette;
          return (
            <button
              key={entry.id}
              type="button"
              aria-pressed={active}
              title={entry.blurb}
              onClick={() => setPalette(entry.id)}
              className={cn(
                "focus-ring-inset flex items-center gap-2 rounded-full py-1 pr-3 pl-1 text-left text-2xs transition-colors duration-tint ease-state",
                active
                  ? "bg-card text-foreground shadow-e0 ring-1 ring-edge"
                  : "text-subtle hover:bg-muted/60 hover:text-foreground",
              )}
            >
              {/* A palette in miniature: the desk, the page lifted off it, and the two
                  accents as seeds on the page — the Run band's own vocabulary, small. */}
              <span
                aria-hidden
                className="relative size-6 shrink-0 overflow-hidden rounded-full ring-1 ring-edge"
                style={{ background: swatch.ground }}
              >
                <span className="absolute inset-x-0 bottom-0 h-3.5" style={{ background: swatch.sheet }} />
                <span
                  className="absolute bottom-[5px] left-[5px] size-1.5 rounded-full"
                  style={{ background: swatch.press }}
                />
                <span
                  className="absolute bottom-[5px] left-[11px] size-1.5 rounded-full"
                  style={{ background: swatch.ochre }}
                />
              </span>
              <span className="truncate">{entry.label}</span>
            </button>
          );
        })}
      </div>
    </Field>
  );
}

