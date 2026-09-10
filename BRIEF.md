# Citrus Writing — build brief

> A prompt for building this application from nothing. It carries the decisions and the
> reasons for them, because the reasons are what make it reproducible rather than merely
> copyable.

---

## What you are building

A writing and publishing workspace for **webnovel and serial fiction authors** — people who
ship a chapter a week, indefinitely, to a platform like Royal Road or Scribble Hub.

That audience is the whole design. A serial author is not writing *a book*; they are running a
production line, and the tools built for novelists (Scrivener, Ulysses) assume a finished
artefact while the tools built for serials (Google Docs and a spreadsheet) assume nothing at
all. Build for the chapter as the unit of work, the arc as the unit of story, and the week as
the unit of time.

Two consequences to hold onto:

- **The manuscript is the product, and the interface is not.** Every decision that trades
  interface richness for time-in-the-prose is the right trade.
- **A serial author's relationship with the work is measured in months.** Streaks, buffers and
  daily goals are not gamification here; they are the actual job.

---

## The visual world: a writing room

Commit to one world. This one is *a desk by a window* — quiet, warm, domestic. Not a document
app, not a dashboard, not an IDE.

Three alternatives were considered and rejected, which is useful to know because it tells you
what the design is *not*: a private-press look (letterpress, drop initials, ornament — more
character but more costume), and a dense instrument (mono numerals, hairline chrome,
keyboard-first — precise but cold).

What the writing room demands:

- **One humanist serif for everything, chrome included.** Source Serif 4 works: warm enough to
  be paper at 18px, sturdy enough to survive a 12px panel label. Do **not** pair a sans UI
  font with a serif manuscript — that pairing is the single loudest signal that an interface
  came out of a component library. An app whose chrome is set in the same ink as the prose
  reads as a document rather than as software.
- **A serif needs more size at the small end.** Micro labels 11px, captions 12px, manuscript
  18px. And drop the positive letterspacing you would use on small light-on-dark sans — serifs
  have terminals doing that job already.
- **No hard edges anywhere.** Generous radius (~14px), hairlines at half the strength you think
  they need, separation carried by *tone* rather than by lines.
- **The page must be paper, not a lighter rectangle.** A fractal-noise grain tile at the
  threshold of visibility; warm ink that browns rather than neutral foreground grey; a real
  shadow with a wide soft falloff. This is the difference between "lit page" as a promise and
  as a fact.
- **Light that falls.** The warm pool behind the page is *two* radial stops — a bright core and
  a wider, weaker spill. One radial reads as a coloured blob; two read as a lamp.
- **Chrome waits to be needed.** Icon-only controls sit back until the pointer is near or they
  take focus. Floor them at 60%, never 0 — a control you cannot find is a puzzle, not
  restraint — and always bring them to full strength on keyboard focus.
- **Never use uppercase letterspaced labels as a system.** They are what "designed" looks like
  when nothing else is carrying hierarchy. Weight, colour and space should do it. Keep small
  caps for at most one job (a running head above a chapter title).

### Palette

Dark by default, light fully supported, and **the two are not inversions of each other** —
every value is picked against its own ground. For dark text on a pale ground the worst
contrast case is the *darkest* surface, which is the reverse of the dark theme; accents have to
darken further than a first pass suggests.

Three grounds carry the workspace and are what stop it reading as one grey field:

| Token | Role |
| --- | --- |
| `--background` | the well the canvas sits in — deepest |
| `--chrome` | panels and bars |
| `--sheet` | the manuscript page — the one lit thing |

Sage green is primary and active state. Terracotta is destructive and over-limit. Honey is the
lamp and the in-progress state. Everything else is warm grey.

**Hold a hard 4.5:1 floor on every text node under 15px, and verify it in the running app
rather than by eye.** Two things this rule kills that you will otherwise reach for: dim text
expressed as an opacity modifier (a colour at 70% opacity composites well below where you think
it does), and low-contrast chrome text. "Chrome recedes" applies to *affordances*, never to
text.

---

## Stack

Next.js App Router, React, TypeScript, Tailwind v4, shadcn on Base UI primitives, Lucide,
TipTap v3, Prisma + SQLite. Server actions, no API routes.

---

## Data model

```
Novel → (Volume?) → (Arc?) → Chapter
```

- Volumes and arcs are **optional**; arcs are the recommended home for chapters. A chapter has
  at most one parent pointer: `arcId`, else `volumeId`, else the novel root.
- `order` positions a node among **all** siblings in the same container regardless of type, so
  an interlude chapter can sit between two arcs.
- Deleting a volume or arc uses `SetNull` and moves its children up one level. **Never cascade
  a container delete onto chapters** — losing a chapter because you deleted a folder is
  unforgivable in a writing tool.
- `Chapter.content` is serialized TipTap JSON; `wordCount` is cached alongside it.

Three tables that carry real design decisions:

**`WritingSession`** — one row per local calendar day, across every novel. **`NovelDay`** — one
row per novel per day. Both written by a single function. The counts a writer sees for a story
are the novel's; the daily goal and the streak are the *writer's*, across all their work. 600
words in one book and 500 in another is a thousand-word day. Keep the rows separate rather than
deriving one from the other, so the writer's day survives a novel being deleted.

**`ChapterSnapshot`** — earlier copies of a chapter, taken inside the save transaction. **On by
default, not opt-in**: a version history you have to remember to switch on only helps people
who already thought about the problem, which is never the person who needs it. Keep a copy of
the *previous* text when either rule fires — nothing kept in the last fifteen minutes, or the
save removes a quarter of the chapter, which is the shape of the accident this exists for.
Prune to a fixed number per chapter; cascade on chapter delete.

---

## What it does

**Serial Binder** — the tree, with drag-and-drop reorder and re-nest, live word counts,
status dots, and a status filter. Filtering hides only chapters, never their containers, and
disables dragging: reordering against a partial list would move rows past siblings you cannot
see.

**The writing canvas** — TipTap with a deliberately narrow schema (no code blocks, headings 2–3
only). A selection menu, `/` commands, `@` mentions, focus mode, typewriter scrolling.
Autosave on a ~900ms debounce, flushed on blur, tab hide and unmount.

**Light Codex** — characters, locations and items, created inline from the `@` popover or from
selected text. Plus **unlinked mentions**: the panel scans the live document for an entry's
name written as plain text and offers to link them. **Nothing is rewritten until the writer
presses Link.** Auto-linking would edit the manuscript without asking, fire autosave, move word
counts, and guess wrong on common words — an entry named "Bell" would tag every bell in the
book.

**Word tracking** — one counting rule everywhere (a whitespace token containing a letter or
digit), used by seed, server and client alike. Words added and removed are a multiset diff of
normalised tokens, computed server-side per save. A sweet-spot gauge with a target band, a
daily goal, a streak, and a sprint timer.

**Export** — clean HTML and Markdown for serial platforms. No classes, no styles, no wrapper
elements. `@mentions` export as the plain entry name without the `@` — they are a writing aid,
not something a reader should see. Say so in the dialog.

**Chrome** — ⌘K palette, keyboard shortcuts sheet, collapsible panels, per-device appearance
settings.

---

## Things that are easy to get wrong

**Never read `localStorage` during render.** Anything that becomes part of the server-rendered
markup — a panel's `defaultSize`, a theme class — hydrates differently than the server sent it.
Render the server's value, then apply the stored one in an effect. Where you need a stored
value in render, use `useSyncExternalStore` with a server snapshot; React sanctions that and
re-renders after hydration instead of warning.

**A panel reports its width on mount, and that report is the default.** Persist a size only
after the user actually grabs a handle, or the defaults overwrite the remembered widths a frame
before you can restore them, and sizes silently never survive a reload.

**Focus indicators must not be clipped.** Use `outline`, not a ring — not because outlines
escape `overflow` (they do not) but because an outline's offset can go *negative*. Inside a
scroll container, draw the indicator within the element's own box.

**One focus recipe, everywhere.** You will otherwise end up with four.

**Progress is a page, not a dashboard.** Three bordered tiles reading `+43 / −43 / 0` is a
metrics widget sitting beside someone's novel. Draw the chapter as a ruled sheet inking in from
the top, and render the day's work as a sentence. Draw *every* rule faintly before inking any
of them — otherwise sixty words renders as an empty box and reads as broken rather than as
barely begun.

**A live gauge should track, not lag.** A progress bar animating over 300ms while the word
count updates on every keystroke is permanently mid-animation. 180ms tracks.

**Never `transition-all`.** It animates the focus outline's width, so the ring grows in instead
of appearing.

**If stored chapter content will not parse, refuse to open the editor** and disable every save
path. Mounting an empty editor over unreadable text lets the first autosave destroy it.

**Restoring a version must snapshot the current text first**, and hand the content back to the
open editor rather than reloading — a reload races the autosave already in flight and loses the
version just restored.

---

## Anti-goals

No AI writing features. No collaboration. No publishing integrations in v1. No general
"spacing scale" — a 4px grid needs no abstraction. No component extracted for a single caller.

---

## How to work

Fix the foundation before restyling surfaces: tokens, contrast, focus, elevation and motion
first, then the surfaces on top of them. That order is invisible for a long time and then makes
the visible work cheap — a committed direction should propagate through a palette block, not
through fifty files.

Verify by measuring in the running app, not by reading the code. Contrast, computed styles,
real keyboard traversal. And be suspicious of your own tooling: a stale `getComputedStyle` read
will happily tell you a working feature is broken.
