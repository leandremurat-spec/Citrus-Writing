@AGENTS.md

# Citrus Writing

A writing and publishing workspace for webnovel and serial fiction authors. Chapter-based
production ("The Feed") rather than single static books.

Branded "Citrus Writing" as of the Claude Design handoff overhaul — see **The visual world:
Citrus Writing** and **The Citrus Writing overhaul** below, shipped across the staged plan at
`.claude/plans/vivid-wondering-walrus.md`. The project folder/repo keep the original
"Pith & Ink Project" name on disk; only the in-app name and visual language changed.

## Stack

- Next.js 16 (App Router, Turbopack), React 19, TypeScript, Tailwind CSS v4
- shadcn v4 (`base-nova` style on Base UI primitives), Lucide icons
- TipTap v3 (`@tiptap/*` 3.31) for the editor
- Prisma 7 + Postgres (Supabase), through `@prisma/adapter-pg`. Was SQLite via a custom
  `node:sqlite` driver adapter (`src/lib/db/node-sqlite-adapter.ts`, now unused) until
  2026-09-10, when local dev needed to run against the same database as the Railway deploy —
  see **Database** below.
- dnd-kit for the Serial Binder drag and drop

## Environment quirks (read before running anything)

- **The folder name contains `&`.** npm's Windows `.cmd` shims break on it, so `npx <tool>`
  and bare `next`/`prisma` calls fail inside this folder with a cryptic `'Ink' is not recognized`
  error. Every `package.json` script therefore invokes tools through `node node_modules/...`
  directly. Always use `npm run <script>`; never `npx`.
- **Windows on ARM64.** This is why the database is Postgres over `pg` rather than a native
  SQLite binding: better-sqlite3 and libsql have no ARM64 Windows prebuilds, and `pg` is a pure
  JS client (TCP wire protocol, no native compilation), so it has no ARM64 problem to work
  around. `src/lib/db/node-sqlite-adapter.ts` is the earlier SQLite-era workaround for the same
  constraint, unused now but left in place — see **Database** below.
- **Node** lives at `C:\Program Files\nodejs` and may be missing from a shell's PATH.
- **`npm run build` then `npm run dev` can poison `.next`.** Starting the dev server on a
  directory a production build just wrote has twice left Turbopack's postcss worker crashing
  on `globals.css` (`exit code 0xc0000409`, every route 500) while the same CSS builds fine for
  production. `rm -rf .next` and restart. If dev breaks right after a build and the build
  passed, suspect this before suspecting the stylesheet.
- The Prisma CLI config is `prisma7.config.ts` (the name Prisma 7.10 generated and loads).
  It does not read `.env`; both it and the app import `DATABASE_URL` from
  `src/lib/db/database-url.ts`, which has no default and must be set — see **Database** below.
- **`docs/` is excluded from `tsconfig.json`.** `docs/tech-stack-code/` holds copies of source
  files as documentation, and their relative imports do not resolve from where they sit —
  six errors that made `npm run typecheck` permanently red, which is the same as having no
  typecheck at all. Keep it excluded, or the next real error will be invisible among them.

## Commands

| Task | Command |
| --- | --- |
| Dev server | `npm run dev` |
| Type check / lint | `npm run typecheck`, `npm run lint` |
| Production build | `npm run build` (runs `prisma generate` first) |
| New migration | `npm run db:migrate -- --name <name>` (the `postdb:migrate` hook regenerates the client, because Prisma 7's `migrate dev` does not; does not seed) |
| Seed demo novel | `npm run db:seed` — creates the demo **account** (`demo@citruswriting.app` / `lantern-tide-demo`, on Serial) and replaces only its "The Lantern Tide"; keeps other novels and existing sessions. Override with `SEED_EMAIL`/`SEED_PASSWORD`/`SEED_PEN_NAME`. Set `SEED_FRESH_SESSIONS=1` to also replace that account's writing history with the demo's five-day streak, on both `WritingSession` and `NovelDay` |
| Reset database | `npm run db:reset` (drops everything with `--force`, migrates, regenerates, seeds). Prisma 7's `migrate reset` has no `--skip-seed` |
| Prisma Studio | `npm run db:studio` |
| DB smoke test | `npm run db:smoke` |
| Export engine checks | `npm run export:check` (runs a fixture through HTML and Markdown and asserts the output is clean; no dev server needed) |
| Rebuild the palette CSS | `npm run theme:build` (writes `src/app/palettes.css` from `src/lib/theme/palettes.ts`; also runs ahead of `dev` and `build`, so it cannot be stale in either) |
| Audit the palettes | `npm run theme:check` (contrast across all eight modes, and fails if the generated CSS is stale; no dev server needed) |
| Inspect the database | `npm run db:inspect` (read-only: novels, chapter word counts and previews, writing sessions) |
| DB write timing | `npm run db:timing` (times small writes while the dev server runs; use it if actions feel slow) |
| In-app preview | `.claude/launch.json` runs `scripts/dev-server.mjs` through an absolute `node.exe` path, because the Claude app's shell may have no `node` on PATH |

## Database

Postgres, hosted on Supabase (project `oqvvqfxtemltxoikldpg`, org "Pith & Ink"), reached at
runtime through `@prisma/adapter-pg`. This replaced the original `node:sqlite`-backed SQLite
file on 2026-09-10, when the app first needed a database that survives a Railway deploy — a
relative SQLite file has nowhere persistent to live on Railway's container filesystem without
a Volume, and nothing in this repo ever ran a migration against one in production anyway.

- **`DATABASE_URL` has no default and must be set** (`src/lib/db/database-url.ts`) — there is
  no sensible fallback for a Postgres connection string the way `file:./prisma/dev.db` once
  was. `requireDatabaseUrl()` throws a clear message where a real connection is actually
  needed (`src/lib/db.ts`, every `npm run db:*` script); the bare `DATABASE_URL` export stays
  an empty string when unset so `prisma generate` — which never opens a connection — keeps
  working with no `.env` at all, exactly as it did before.
- **Local dev and production point at the same Supabase instance**, deliberately: this app's
  Prisma schema has one `datasource` provider for the whole codebase, so "SQLite locally,
  Postgres in production" was never on the table without maintaining two schemas. Running
  Postgres locally sounds like it should be a hassle; it isn't, because nothing runs
  *locally* — `pg` is a pure-JS TCP client (no native binary, no ARM64 problem), so "local dev"
  just means pointing the same `DATABASE_URL` at the hosted instance. Split into separate
  dev/prod Supabase projects later if that starts to matter.
- **`src/lib/db/node-sqlite-adapter.ts` is unused but not deleted.** It is a real, carefully
  built adapter (ports Prisma's own better-sqlite3 adapter onto `node:sqlite` column-type and
  error mapping included) and the ARM64 workaround this project is named after in three other
  places in this file; removing it was a judgment call left to the writer rather than made
  silently in the same pass that stopped calling it.
- **Row Level Security is off on every table**, and that is correct for how this app reaches
  Postgres — through Prisma over a direct connection with the database password, never through
  Supabase's PostgREST/anon-key API. RLS only gates that second path. Supabase's own advisor
  still reports it (it cannot tell which access path an app uses), which is worth knowing
  before reflexively enabling it: RLS with no policies written blocks every query outright.
- The migration history restarted at `20260910000000_init_postgres` — the SQLite-era
  migrations (`prisma/migrations-sqlite-archive/`) do not replay against Postgres and are kept
  only as a record of schema history, not as part of the active migration chain.

## Data model rules

- Hierarchy is `Novel → (Volume?) → (Arc?) → Chapter`. Volumes and arcs are optional; arcs are
  the recommended home for chapters.
- A chapter has at most one parent pointer: `arcId`, else `volumeId`, else the novel root.
- `order` positions a node among all siblings in the same container regardless of type, so an
  interlude chapter can sit between two arcs.
- Deleting a volume or arc uses `SetNull`, never cascade, so chapters are released rather than
  destroyed. Deleting a novel cascades everything — which is why `deleteNovel` makes the writer
  type the title (see **Deleting a serial asks you to type its name**). Deleting a *user*
  cascades every novel they own, so `deleteAccount` asks for the email address the same way.
- `Chapter.content` is serialized TipTap JSON; `wordCount` is cached alongside it.
- **Every novel belongs to a `User`, and every read is scoped to one.** The data functions in
  `src/lib/data/novels.ts` and `writing.ts` take `userId` as a *required parameter* rather than
  reaching for the session themselves — a missing argument is then a compile error at the call
  site instead of a silently unscoped query, which is the one bug that must never happen here.
- `ChapterCodex` is the @mention index. `WritingSession` has one row per writer per local day
  across every novel; `NovelDay` has one per novel per day. Both are written only by
  `recordWriting` (net words floored at zero; a positive day extends the streak). The counts a
  writer sees are the novel's; the goal and the streak are the writer's.
- `ChapterSnapshot` keeps earlier copies of a chapter, taken by `maybeSnapshot` inside the save
  transaction: at most one per quarter hour, always before a large cut, twenty kept per chapter.
  `onDelete: Cascade` — a deleted chapter takes its history with it.
- `AuthorSettings` is one row **per writer**, keyed by `userId` (daily goal, sweet spot range,
  export profile). It was a single row with id `default` before accounts existed. Appearance —
  brightness, measure, palette, type size — stays in localStorage: those are facts about a
  screen, these are facts about an author. Edited from `/account`, which is the first surface
  that ever let a writer change them.
- `Novel.cadenceTimeSecond` is the second release of a day and is read only by `TWICE_DAILY`.
  Every other cadence ignores it — see **The Buffer** for why a slot became a moment.

## The visual world: Citrus Writing

Serial fiction is still *published*, not merely written, but the production metaphor changed
from a print-shop to a citrus grove: warm cream stock, terracotta and sage ink, chapters as
seeds on a strand. This is a redesign handed off from Claude Design, not an internal
iteration — the user designed the direction in Claude Design and exported it as a handoff
bundle (see `.claude/plans/vivid-wondering-walrus.md` for the staged plan it shipped across),
and the palette is deliberately theirs: warm-cream-plus-serif-plus-terracotta, the exact
signature **Superseded: the press** (below) documents this app rejecting once already. That
was a real reason and it is not forgotten — this was a knowing choice to move past it for a
direction the user designed themselves, not an oversight.

- **Colour slots keep their trade names, retinted rather than renamed.** `--press` is still the
  primary/active brand colour — terracotta now, not ink blue. `--ochre` is still the warm
  secondary accent — sage now, not amber. `--proof` (destructive) is a red the handoff never
  specified, since none of its seven screens show an error state; chosen to read clearly as
  "danger" beside the new terracotta rather than as another shade of it. `--slate`/`--ink`/
  `--stock` stay dormant, as before. `--press` and `--ochre` each also carry a 100–900 ramp
  (`--press-100`…`--press-900`, `--ochre-100`…`--ochre-900`, plus a matching `--neutral-100`…
  `--neutral-900`), so new work can reach for a specific step the way the handoff's own CSS
  does, instead of the single-token-plus-opacity trick the press theme relied on throughout.
- **The base `--press` and `--ochre` sit on the 700 rung of their own ramps, not the 500ish
  the handoff's mockups paint their large fills with.** The handoff's own accent (`#c67139`
  for press, `#728157` for ochre — see the ramps above) reads fine as a big dot or a tag
  background, but at 3.0:1 and 3.5:1 against the cream ground it fails 4.5:1 as the button and
  link text `--press`/`--ochre` are actually used for throughout this app. The 700 rungs
  (`#8c491a`, `#56633f`) clear 4.5:1 on every ground the app has (5.7:1+ and 4.8:1+) — the same
  kind of darkening-for-text-contrast this app already did once for the press theme's own
  `--ochre`, just needed one ramp step earlier this time because there is now an actual ramp to
  check against instead of a single guess.
- **There are now eight themes: four palettes × light and dark.** See **Palettes and dark mode**
  below. Citrus light is the handoff's own design, unchanged to the hex except one destructive
  red the audit caught at 4.44:1. Citrus dark is new and is a design rather than an inversion —
  a grove at night, not a grey one.
- **Radius reverses the press theme's stance on purpose, not by accident.** Buttons, tags,
  segmented controls and inputs are fully pill (`rounded-full`); cards, dialogs and the
  manuscript page sit on a large but finite radius (`--radius-lg`, 28px) instead. One radius
  on every surface was the press theme's SaaS-card tell to avoid; pill controls plus a
  generous-but-bounded card radius is the handoff's own explicit rule, followed rather than
  softened.
- **Caprasimo for display, Figtree for chrome, Newsreader still the default read.** The
  handoff's own design system ships no reading serif by its own admission — its source comment
  reads "Organic ships no reading serif... so the manuscript face is a choice rather than a
  token" — so the prose face was already meant to be a per-device pick, not a fixed token.
  Settings → Manuscript face now offers all five of the handoff's candidates (Figtree,
  Newsreader, Lora, Source Serif 4, EB Garamond); Newsreader stays the shipped default so
  reading quality does not regress on the strength of a palette change.
  The picker is a **list**, not a segmented control: `flex-1` cells are right for Light/Dark/Auto
  and wrong for five font names, which were folding onto two lines inside a 41px cell. Each name
  is set in the face it names, so the choice is made by looking rather than by recognising.
- **The boldness is still spent in one place: the run — now drawn, not just numbered.**
  `workspace/run-band.tsx` draws every chapter as a dot on a strand: filled and *sized* by word
  count (a seed growing as the chapter fills in, the metaphor the Binder's own "drag a seed to
  reorder" copy already used), coloured by status, ringed when it is the chapter open right
  now, breathing gently when it is queued, with a dashed marker at the last chapter readers
  have actually seen (the highest-order `PUBLISHED` chapter). `runNumber` itself is unchanged —
  still derived from document order in `lib/binder/tree.ts`, still never stored. The same dot
  vocabulary reappears smaller and non-interactive in a Codex entry's "where it appears" thread
  (`codex/mention-thread.tsx`) and in a Library card's mini summary
  (`library/mini-run-dots.tsx`) — one visual idea at three sizes, not three components.

A fresh contrast audit after the retint, computed directly rather than eyeballed (see
`scripts/` history — the check script itself was scratch, not committed): every text pairing
in active use clears 4.5:1, worst case `--ochre` on `--surface` at 4.82:1. The two real
failures the audit caught were exactly the ones described above (`--press`/`--ochre` as text)
plus one more: the `DRAFT` status's hollow ring used `--neutral-400`, which measured 1.5–1.8:1
against the three grounds — below even the 3:1 floor WCAG sets for non-text UI boundaries. It
now uses `--neutral-600` (3.2:1–3.9:1) everywhere a hollow "empty" ring appears (Run band,
Binder, Library, Codex mention-thread, the Buffer's empty slots, the Progress panel's
week-dots). The soft `--edge`/`--divider` hairlines were checked too and left alone: at
1.2–1.3:1 they are far below 3:1, but that is the same deliberately-subtle mechanism the press
theme already used and documented (see **Design language** below) — every surface they outline
is also distinguished by a real background-colour difference, and a hairline that quiet was
already this app's considered choice once, not a new problem introduced here.

## Palettes and dark mode

Eight themes: **Citrus**, **Moonlight**, **Evergreen** and **Celestial**, each in light and
dark. Two independent axes — next-themes writes `.dark` (or nothing) on `<html>`, a small
store writes `data-palette` — and both are per device, for the same reason the appearance
settings are: a colour scheme is a fact about this screen, not about the writer's account.

**The source of truth is `src/lib/theme/palettes.ts`, and the CSS is generated from it.**
`scripts/build-theme-css.ts` writes `src/app/palettes.css` (checked in, and regenerated ahead
of both `npm run dev` and `npm run build`, so it cannot be stale in either); `globals.css`
imports it and no longer names a colour value anywhere. Ten hand-written blocks of ~75
declarations is 750 chances for one palette to quietly disagree with the others about what
`--popover` means, with nothing to catch it. Generating also means the Settings swatches and
the contrast audit read the numbers the browser actually paints rather than a second copy that
happens to match today. `src/lib/theme/tokens.ts` holds the one derivation — it is the only
place that knows `--muted` is the neutral ramp's 200 rung, or `--edge` the hairline at 10%.

### The ramps are ordered by role, not by lightness

`100` always means "the faintest presence of this hue against the ground this mode sits on"
and `900` always means "the strongest ink of it". In a light mode that runs light → dark; in a
dark mode it runs dark → light, so **`--neutral-100` is the darkest neutral in dark mode**.
That surprises people, and it is the single decision the whole feature rests on.

It is the Radix Colors model, and it is what let a dark mode exist without touching the ~200
call sites that already write `text-ochre-800` on `bg-ochre-100`, `border-neutral-600` for a
hollow "empty" ring, or `bg-press-200` for a soft brand tint. Each of those states a
*relationship* — dark ink on a faint tint, a boundary that clears 3:1 — and the relationship is
what has to survive the mode change. Ordering by lightness instead would have meant rewriting
every one of them, and every component added later would have had to remember the rule again.
The base aliases follow: `--press` is the 700 rung in both modes.

**The ramp contract**, which is why a palette can be dropped in without re-auditing the app:
the **700 rung is readable as text (4.5:1) on every ground**, and the **600 rung clears 3:1 as
the boundary of a graphical object on every ground**. Nothing below 600 promises either — a
mid-ramp colour cannot separate from a near-ground surface by definition — so anything that has
to be *seen* reaches for 600 or deeper. `npm run theme:check` asserts both.

### What each palette makes of the two accent slots

`--press` (primary/active) and `--ochre` (the warm secondary, "in progress", streak and goal
fills) keep their trade names in every palette, exactly as they did through the retint: they
name roles, not hues.

| Palette | `--press` | `--ochre` | Notes |
| --- | --- | --- | --- |
| Citrus | terracotta | sage | The house palette. Light is the handoff, to the hex. |
| Moonlight | near-black grey | mid grey | Achromatic. Its two accents have no hue to tell them apart, so they separate by **value** instead — see below. |
| Evergreen | forest green | moss gold | The densest of the four; its dark mode is a forest floor rather than a grey room. |
| Celestial | nebula violet | starlight cyan | The only cold palette, and the only one whose dark mode is the one it was designed around. |

Two recurring corrections, both already familiar from this app's own history:

- **A palette's headline accent is usually a large-fill colour, not a text colour.** Solarized's
  `#268bd2`, Gruvbox light's `#af3a03`, Rosé Pine Dawn's `#907aa9` all sit at the **600** rung
  here, with the base alias one rung deeper — the same correction Citrus already made when
  `--press` was pointed at `#8c491a` instead of the handoff's `#c67139`.
- **A dark palette's own "dark" is often not dark enough to be the app ground.** Nord publishes
  nothing below nord0, so nord0 is the *manuscript page* here and the desk and chrome are
  extended downward from Polar Night — which puts Nord's most recognisable colour where a
  writer actually looks.

### How the three companion ramps were built

Citrus was authored rung by rung. The other three were **solved**, by a scratch
generator working against the contract in `theme-check.ts` — and the script is gone, on purpose:
its output is the checked-in data, and a generator kept around invites someone to regenerate a
palette that has since been touched by hand. What it did is worth recording, because the next
palette wants the same method:

1. **Only lightness moves.** Hue and chroma are the anchor's, held. Push chroma around as well
   and the palette stops being recognisably itself, which is the one thing a *named* palette
   owes. Each rung is the anchor's hue at the gentlest lightness that clears its floor —
   walking inward from the extreme, so a deep rung is never more saturated than it has to be.
2. **Ramps are solved twice, because a ramp's own tints are grounds.** `--press` sits on
   `press-200` in a hovered chip and `ochre-900` on `ochre-100` in a tag. Solving once against
   the three page surfaces satisfies the ramp contract and then fails a dozen pairings
   components actually paint.
3. **`--muted` is `neutral-200`, and `--muted` is also one of the four audited grounds.** So the
   first two rungs of every ramp hug the ground and only the rest space out normally. Pulling
   the tints back is far cheaper than pushing every accent further out — the same correction
   the earlier palettes needed, generalised.
4. **`--proof` is solved too, against the washes of itself it gets painted on.** The destructive
   card tints its background with 5% proof and a hovered destructive menu item with 10% (20% in
   dark), so the hardest surface proof must be legible on is a faint version of proof. That
   needs two passes as well: one to seed the wash, one to answer it.

**Moonlight is the case the method did not cover.** With no hue in either accent, holding hue
and chroma and moving only lightness makes `--press` and `--ochre` come out *identical* — same
target, same answer. So its two ramps are solved against different contrast targets instead:
press lands near 13:1 and ochre near 6:1, which keeps them distinguishable as marks while both
still clear the contract. That is the general rule stated plainly — the accents are roles, and
a role can be carried by value as readily as by hue. `--proof` stays red, and is the one
deliberate exception to "no colour at all": a destructive warning that reads as another grey is
worse than an inconsistent palette.

### Three grounds, in both modes

The page is the brightest surface and chrome the dimmest, in light *and* dark. That is not
mirrored between modes, because "lit" is not a relative claim: a dark mode that made the panels
the brightest thing on screen would be an inversion, not a design. `theme:check` asserts the
order. Everything downstream then works unchanged — `.canvas-sheet` mixes `--sheet` toward
`--background` by `--page-lift`, so the page still lifts off the desk; `.canvas-well` sources
its lamplight from `--press`, which in a dark palette is the pale end of the ramp and reads as
a warm glow rather than a stain.

Three things could not be carried across and are per mode: `--elev-*` (a soft warm shadow
disappears on a dark ground, so the lit top edge does most of the work), `--ink-tint` (the
manuscript's ink warms toward a deep brown under a light page and a pale cream under a dark
one), and the paper grain — `mix-blend-mode: multiply` presses the tile into a light page and
only muddies a dark one, so a dark mode lifts the same tile with `screen`, at roughly half
strength because screen reads far louder. `--selection-mix` is per mode for the same reason.

### Auditing

`npm run theme:check` — 472 pairings across eight modes in about a second, no browser. It is a
hand-built table of the pairings components actually paint, read off their class strings, so a
genuinely new pairing means adding a line there. That is the trade: a table that can go stale,
for a check that covers every palette at once. It also fails if `palettes.css` is not what the
current data would generate, which is the safety net for anyone editing the generated file by
hand. Every one of the four clears 4.5:1 on every text pairing; the worst case across all of
them is 4.60:1 (Cinnabar dark aside, they cluster around the `--proof` wash pairings).

**Four pairings are reported but not enforced**, listed at the end of every run. They are
mid-ramp rungs used as informative marks — the `EDITED` status dot is `ochre-400` (1.2–2.5:1),
the Progress panel's written-day dot and the page gauge's "warming" arc are `ochre-500` — and
every one of them was already below 3:1 in the shipped Citrus light theme. Which rung a status
dot reaches for is a component decision about the Run band's colour vocabulary, and adding a
dark mode was not the right moment to make it. **This is the main open accessibility item in
the app** and it wants a real answer: `ochre-600` clears the floor in all four palettes, but
moving `EDITED` there changes the signature component's look.

### Defaults, and the flash

`defaultTheme` changed from `"dark"` to `"system"`. That `"dark"` dates from the writing-room
palette; through the whole Citrus era it pointed at a `.dark` block identical to `:root`, so
every writer has been looking at the light theme regardless of what the setting said. Now that
the modes genuinely differ, something has to decide, and for a device-level preference the
device's own answer is the honest one.

The palette needs the same flash-of-wrong-theme treatment next-themes gives `.dark`:
`PaletteScript` in `theme-provider.tsx` is a tiny synchronous inline `<script>`, first thing in
`<body>`, that puts the stored palette on `<html>` before first paint. It validates against the
real id list rather than trusting storage, and writes *nothing* when there is no stored value —
which is what makes the generated stylesheet's unqualified default block (Citrus) the fallback.
It is deliberately not folded into the appearance store: that one applies its values from an
effect, which is right for a measure or a type size and would be a visible flash for a whole
colour scheme, and a script small enough to inline should parse a bare string rather than JSON.

### Selector specificity, which is why the generated selectors look odd

Two axes select one of eight blocks. The obvious selectors collide: `[data-palette="evergreen"]` and
`.dark` both weigh (0,1,0), so whichever came last would win and light Evergreen would silently
beat dark Citrus. Every light block is therefore written `:root:not(.dark)…` and every dark one
`:root.dark…`, which makes the modes mutually exclusive so order and specificity stop mattering
between them. Within a mode the palette-qualified selector carries one more attribute than the
default block and wins on specificity alone. The full note is at the top of
`scripts/build-theme-css.ts`.

## Superseded: the writing room

Chosen deliberately over two alternatives (a private-press look, and a dense instrument), and
everything below serves it. A desk by a window, not a piece of software.

- **One humanist serif, chrome included.** Source Serif 4 for every role. Inter beside a book
  face was the loudest thing in the app announcing which component library it came from, and a
  writing tool whose interface is set in the same ink as the manuscript reads as a document
  rather than as an application. Both `--font-sans` and `--font-serif` point at it; the
  distinction they still carry is size and optical size, not family.
- **The small type steps went up** (10→11px, 11→12px, manuscript 17→18px) and the positive
  tracking came off. A serif carries less weight per pixel, and that tracking existed to stop
  light-on-dark *sans* blooming — serifs have terminals doing the job already.
- **No hard edges.** Radius 0.875rem; `--edge` and `--divider` roughly halved; the lit top edge
  dropped from e0 and e1, because a seated thing in a room is separated by its own tone, not by
  a highlight along one side. It survives on e2/e3, where light really would catch a lifted
  edge.
- **Paper, not a lighter rectangle.** `.canvas-sheet::before` lays a fractal-noise tile over the
  page at the threshold of visibility. It rides `--page-lift`, so a page set flush to the desk
  loses its texture along with its shadow, and it is dropped entirely under
  `prefers-reduced-transparency`. Ink warms towards `--ink-tint` instead of being neutral
  foreground grey.
- **Light that falls.** `.canvas-well` is two radial stops rather than one — a warm core and a
  wider, weaker spill. A single radial reads as a coloured blob, not as a lamp.
- **Labels stopped shouting.** Six uppercase letterspaced headings on one screen was the most
  generic move in the app. `label-section` is now semibold sentence case; `label-eyebrow` keeps
  small caps for the one place they earn it — the running head above a chapter title.
- **Progress is a page, not a dashboard.** `command-center/page-gauge.tsx` draws the chapter as
  a ruled sheet inking in from the top, the sweet spot marked down the margin. Every rule is
  drawn faintly *before* any is inked, so sixty words reads as barely begun rather than as
  broken. The three bordered figures reading "+43 / −43 / 0" are now one sentence.
- **A drawn mark.** `workspace/wordmark.tsx` — a dip-pen nib, replacing the stock feather glyph
  every writing app reaches for.
- **`chrome-quiet`** holds icon-only panel controls at 60% until hover or focus. The floor is 60
  and not 0: a control you cannot find is a puzzle, not restraint. Keyboard focus always brings
  one to full strength, so it costs a keyboard user nothing.

Contrast was re-audited afterwards: 111 text nodes in the live workspace, none below 4.5:1,
worst case 5.64:1 — better than before, because the small steps grew.

## Superseded: the press

Replaced the writing-room pass above, in turn replaced by **Citrus Writing** (above the
writing-room section). Kept here because the reasoning still holds in general — it is exactly
what Citrus Writing's own opening paragraph names as the tension in reviving this palette —
even though the user's own new direction is what this app is built on now.

Serial fiction is *published*, not merely written — instalments on a schedule, in a run. This
pass set that on uncoated stock in blue-black printing ink rather than in a study.

- **Colour slots were named for the trade**, not for plants: `--press` (ink blue, primary and
  active), `--proof` (proofreader's red, destructive only), `--ochre` (in progress), `--slate`,
  `--ink`, `--stock`. Renamed from sage/terracotta/honey/moss/parchment across 139 references.
- **The dark ground was a blue-grey at a real value** (`#1a1e25`), not a tinted near-black. The
  manuscript sheet was *lighter* than the chrome around it, which was the whole point of a lit
  page.
- **Two clearly distinct editorial serifs.** Bitter — a slab — carried chrome and every
  numeral, because word counts, chapter positions and streak days are a schedule and a schedule
  should look printed. Newsreader carried the prose.
- **Radius was 4px.** One large radius on every surface regardless of hierarchy is the
  SaaS-card tell; printed things have crisp corners. (Citrus Writing's pill controls are a
  deliberate reversal of this stance, not an accidental drift back — see above.)
- **The boldness was spent in one place: the run** — a numeral in a right-aligned column,
  derived from document order, never stored. The idea survives; `workspace/run-band.tsx` now
  draws it instead of only numbering it.

Audited at the time: dark 118 text nodes, worst 5.77:1; light 116, worst 4.69:1; none below the
4.5 floor.

## Design language

- Four palettes, each in light and dark — see **Palettes and dark mode** above for the whole
  model. Colour tokens live in the generated `src/app/palettes.css`, from
  `src/lib/theme/palettes.ts`; **do not edit either the generated file or a colour value in
  `globals.css`**, which no longer holds one. `ThemeProvider` puts the mode class on `<html>`
  and `palette-store.ts` puts `data-palette` beside it.
- `--press` = primary / active (terracotta in Citrus). `--ochre` = the warm secondary accent —
  "in progress" states, streak/goal fills (sage in Citrus). `--proof` = destructive only. The
  names are roles, not hues, and hold across all four palettes. `--press` and `--ochre` each
  carry a 100–900 ramp plus `--neutral-100`…`--neutral-900`, generated as real Tailwind
  utilities (`bg-press-200`, `text-ochre-800`, …). **The ramps run by role, not lightness** —
  700 is the text rung and 600 the graphical-mark rung in *both* modes, which means
  `--neutral-100` is the darkest neutral in a dark palette. Reach for 600 or deeper for
  anything that has to be seen.
- Figtree for UI chrome (`font-sans`), Caprasimo for display/headings (`font-heading`),
  Newsreader for manuscript text by default (`font-serif`) — user-selectable among five faces
  under Settings → Manuscript face.

### The token layer (added by the UI overhaul, Phase 1 step 0)

Use these instead of arbitrary values; the audit that motivated them found 26 sites of
`text-[11px]`, five competing ring colours and no elevation, motion or focus tokens at all.

- **Type:** `text-3xs` (10px) and `text-2xs` (11px) fill the gap below `text-xs`; `text-md`
  (17px) is the manuscript reading size. Small steps carry positive tracking on purpose —
  warm off-white on near-black blooms optically and reads tighter than it measures.
- **Elevation:** `shadow-e0`…`shadow-e3`, on a ladder with only four rungs because the app
  only has four kinds of surface. On a `#121212` ground a drop shadow has almost no boundary
  contrast, so each level pairs a light top edge (`--elev-edge`) with the drop.
  **e0** = seated in a panel (the three Progress tiles, on `bg-card` with `ring-1 ring-edge`).
  **e2** = floating over the page (dropdown, context menu and their submenus, popover, the
  `@` list, the mention hover card). **e3** = modal or dragged (dialog, alert dialog, the
  binder drag ghost). e1 is defined but unused: nothing in the app currently sits between a
  seated tile and a floating menu, and inventing a use for it would be the wrong reason.
  Every level composes with `ring-1 ring-edge` — Tailwind chains `--tw-ring-shadow` and
  `--tw-shadow` into one `box-shadow`, so the ring is not lost.
- **Edges and dividers:** `ring-edge` (10% white) is the one ring for seated and floating
  surfaces; it replaced `ring-border/60` (~5%, invisible) and `ring-foreground/10`.
  `border-divider` (12%) is the one chrome divider, replacing `border-border/60` and `/70`
  (~5–6%). Note the class is `border-divider`, from `--color-divider`: Tailwind resolves
  `border-x` against `--color-x`, so a token named `--color-border-strong` would have had to be
  written `border-border-strong`. The divider is deliberately 12% and not louder — the
  workspace reading flat is a job for the panel *values* (Phase 2), and a hard line would only
  paper over it.
- **Dim text:** `text-subtle` (`--subtle: #645c50`, same value as `--neutral-700`). It is a
  colour, not an opacity, because opacity-based dimming has failed 4.5:1 on this app's small
  text before (see the mechanism note in **Superseded: the writing room** if this file still
  has one). Currently 5.5:1 on `--background`, 4.9:1 on `--surface`/`--chrome`, 6.0:1 on
  `--sheet`/`--card` — see the Citrus Writing contrast audit above. Both themes read the same
  value for now, same reason as everywhere else in this palette.
- **Motion:** three durations and three curves, and every transition in the app uses one of
  each. `duration-tint` (120ms) for colour, applied with `ease-state`. `duration-state`
  (180ms) for a control changing in place — the two chevrons, the sweet-spot and goal bars,
  and the menus/popovers/tooltip appearing. `duration-surface` (240ms) for a modal arriving
  and for the sweet-spot message swapping. Entrances take `ease-out-quiet` (arriving,
  decelerating); exits re-declare `data-closed:ease-in-quiet`, because tw-animate-css reads
  one `--tw-ease` for both directions.
  - The `duration-*` utilities set **`--tw-duration` as well as `transition-duration`**. This
    is not optional: `animate-in`/`animate-out` compile to
    `animation: enter var(--tw-animation-duration, var(--tw-duration, .15s)) var(--tw-ease, ease)`,
    so a duration utility that touched only the transition property would leave every
    enter/leave animation silently on the 150ms default.
  - The `--ease-*` tokens live in a plain `@theme`, **not** `@theme inline`. `inline`
    substitutes the literal into the utility and drops the custom property, and `--ease-state`
    has to exist at runtime — `binder-row.tsx` names it from an inline style, because dnd-kit
    writes `transition` there and an inline style replaces the class outright. (That is also
    why the binder row carries no `transition-*` class: appending to dnd-kit's value is the
    only way to get both the drag transform and the hover tint. Before this, hover snapped.)
  - `transition-all` is gone from every live component. It animated `outline-width`, so the
    focus ring grew in rather than appearing.
  - A `prefers-reduced-motion` guard in `@layer base` collapses everything to 1ms except the
    save spinner. Its `!important` is deliberate and now verified: an important author rule
    outranks an inline style, which is what lets it reach dnd-kit's inline transition.
- **Focus:** the `focus-ring` / `focus-ring-inset` utilities, which use `outline`, not `ring`.
  They are the *only* focus indicator in the app: they replaced shadcn's `ring-3 ring-ring/50`
  plus border tint (button, input, textarea, badge), the binder's `ring-2 ring-ring/40`, the
  status menu's `ring-2 ring-ring/50`, the tab trigger's ring-plus-outline pair, and the notes
  textarea's `focus-visible:ring-0` (which suppressed the indicator entirely). `outline` because
  a ring is a box-shadow, so it shares one property with the `shadow-e*` stack and the `ring-1`
  hairlines several surfaces carry — and because an outline's offset can go negative.
  Both kinds are painted outside the element and both are clipped by a scrolling ancestor, so
  that is *not* an outline advantage; the inset variant is what solves clipping. Use
  `focus-ring-inset` inside a scroll container (binder rows and their row buttons, codex rows,
  the notes textarea, panel tabs) and `focus-ring` everywhere with room around it.
  The dead primitives (`command`, `input-group`, `scroll-area`, `select`, `toggle`) still carry
  the old recipe and still emit it into the stylesheet; they go away in the primitive-swap step.
  `.chapter-editor` keeps `outline: none` on purpose — the caret is the indicator in a
  contenteditable — and `.ProseMirror-selectednode`'s sage outline marks node *selection*,
  not focus.
- **Section headings:** the `label-section` utility replaces six near-copies that disagreed on
  weight, tracking, size and element. It also covers the binder's volume rows and the editor's
  breadcrumb line, which were the two that had drifted furthest (0.12em tracking, weight 500).
- **Shared surfaces:** `Surface` (`src/components/ui/surface.tsx`) is the one card recipe, in
  four levels matching the elevation ladder — `seated`, `floating`, `lifted`, and `well` (ring,
  no lit top edge, because a light top edge is what reads as raised). Tones are `card`,
  `popover`, `muted`, `none`. Export `surfaceVariants` exists for the one place that must stay
  a different element (the export preview `<pre>`). `PanelChrome` / `PanelFootnote`
  (`ui/panel-chrome.tsx`) are the 40px panel bar and the quiet strip at a panel's foot.
  - **Not extracted, on purpose.** A `SectionLabel` component would only wrap the
    `label-section` utility, which already does the whole job. A `StatTile` would only rename
    `Figure` in `progress-panel.tsx`, which has no second consumer — it is already the
    extraction. The shadcn primitives (dialog, dropdown, context menu, popover) keep their own
    strings: they carry the same tokens, and making generated files import project components
    makes them harder to regenerate. The binder drag ghost keeps its `border-press/40`, which is
    a drag state rather than a surface edge.
- **Layout constants:** `h-chrome` (40px panel bar), `h-header`, `h-status`,
  `max-w-manuscript` — all four now in use, and each emits exactly the value it replaced
  (2.5rem, 3rem, 2.75rem, 46rem). Do not add a general semantic spacing scale — the app is already
  consistent on the 4px grid.
- `@custom-variant dark` is `(&:is(.dark, .dark *))`, so a `dark:` utility on `<html>` fires too.
- The Tailwind import carries `source("../")`, scoping class detection to `src/`. Without it
  Tailwind scans the whole project including this file, so naming a utility in prose emitted a
  real (dead) CSS rule for it — that is how three dead rules reached the production stylesheet.
  Inside `src/`, the same applies to code comments: name a bracket utility in one and you
  generate it. Registry files still hold two `text-[0.8rem]` uses; those are deliberate.

### A radius is paid for in padding

Content sitting `P` in from both edges of a corner of radius `R` only clears the arc while
`P ≥ R(1 − 1/√2)` — **about three tenths of the radius** — and it takes a few pixels more than
that before it stops *looking* like the curve is running into the text. `--radius-lg` is 28px,
so anything wearing it owes roughly 13px before it reads as unhurried.

The handoff set the radius for cards, dialogs, the manuscript page and pill controls. It never
spoke about **floating menus**, which quietly inherited the card value from the shadcn
defaults: 28px corners with `p-1`, four pixels, on menus 274px wide where the curve is a
quarter of the height. Every dropdown, context menu, `@` list, `/` list and the command
palette had its first and last rows sitting inside the arc, and the settings segmented
controls were worse — 28px against `p-0.5`.

So floating surfaces take **`--radius-md` (16px) with 6px of padding, and their rows take
`--radius-sm` (8px)** — the concentric inner radius, `R − P`. **Dialogs sit on `--radius-lg`**,
which is what this file already claimed they did; the shadcn primitive was in fact on
`rounded-xl` (36px), and at that size its own bottom corners cut across the footer buttons by
15px. The command palette inherited it too, which is why the search field showed a 36px corner
clipping a 28px box inside it. `Surface`'s `floating` level
carries the smaller radius for the same reason; that is a size decision living on an
elevation variant, which is worth knowing before adding a fifth level. Dialogs, cards and the
manuscript page keep `--radius-lg`; they are big enough to afford it and already padded for it.

Two corollaries worth keeping straight, because both look like bugs and neither is:

- **A concentric child is the correct answer to a curve, not a collision.** The binder row's
  active run-badge is a 32px circle in a 32px pill's end — `r = R − P` exactly. What was wrong
  there was the *other* end: `pr-1` put the word count 4px from the pill's tightest point, so
  it is `pr-2.5` now.
- **A curve cutting across a graphic is a mask.** Each palette swatch is a round window with a
  page and two seeds drawn to overflow it on purpose.

`Ctrl + Shift + U` → Scan reports this as a **corner** finding, with the clearance in pixels
and the padding that radius wants.



### Explanatory copy earns its place or goes

The app used to narrate itself. A line of grey text under nearly every Settings control, a
caption under every Buffer heading, a description under every dialog title, and a footnote at
the foot of two panels — most of them saying the label again ("Page brightness — how far the
sheet lifts off the desk"), or explaining the implementation to someone who did not ask
("Saved to this device. The daily goal and sweet spot follow your account."). A hint under
every control is a hint under none: the eye stops reading them, including the ones that matter.

Two passes. The first kept anything that stated a "non-obvious rule", which turned out to be a
loose enough test to keep most of it. The rule that actually holds is narrower, and a line has
to fall into one of these to survive:

- **an undiscoverable gesture** — drag right to nest, `@` to link an entry, drag a chapter onto
  a date. Nothing else teaches these.
- **a warning before something irreversible** — the two delete confirmations.
- **an error** — the unreadable-chapter card, which exists to tell a frightened writer their
  words are still there.
- **a real constraint the UI cannot show** — "A chapter can only be queued once it is Edited",
  which is why a draft has no Queue button.
- **a placeholder, an `aria-label`, or a `title`** — invisible until needed, or not visible at all.

Everything else went: about twenty-five sentences. The count is worth keeping honest, so
`scripts/` history has the one-off survey that produced it — walk `src/components` for JSX text
nodes and quoted UI strings over ~24 characters and read the list. **Twenty-two sentences of
prose is the whole app now**, and every one of them is in the list above.

Two consequences in the code: `hint` is optional on every Settings control, because it is now
the exception rather than the rule; and `DialogDescription` is simply omitted where the title
already says the job, which the binder's own `TitleDialog` was already doing.

**Not cut, and deliberately so:** the sweet-spot and daily-goal encouragements
(`lib/editor/sweet-spot.ts`, `lib/editor/goal-message.ts`). Those are not the app explaining
itself — they are a designed feature with its own voice, and cutting them would be removing
something rather than tidying it.

### The run band scrolls, and breaks on its containers

`workspace/run-band.tsx` was an auto-width flex row at 30px a chapter, so a serial of any real
length grew past the header and pushed the arc title and the buffer pill off the screen — around
forty chapters on a 1280px window. The strand is now the flex child that gives (`min-w-0
flex-1`) with `overflow-x-auto` inside it, and the open chapter is scrolled into view on every
change (`inline: "center"`, `block: "nearest"` so it never scrolls the page itself).

Two marks, in one vocabulary. The **dashed ochre line** is where readers have got to — the
highest-order `PUBLISHED` chapter — and was already there. The **solid caret under the current
dot** is where the writer is. The ring around the active dot says the same thing, but only once
you have found it; the caret is visible while scanning a strand of forty.

**Arcs are regions, not dividers.** Each arc owns a column: its name above, its own dots, and
**its own length of strand**, with a gap to the next. The break in the line is the least
ambiguous way to say "this arc ended and another began" — a label beside a hairline, which is
what this was first, does not say which side it belongs to. See **Two tiers in the run band**
below for the volume level above it.


### A textarea's radius clips its own text

This is the one that took three passes to find, because every measurement said the field was
fine: right size, no overflow, wraps correctly, saves correctly. What it did *not* say is that
`Textarea` shipped `rounded-3xl` — a **56px** corner — and a textarea has `overflow: auto`, so
its border-radius clips its own content. The chapter notes panel overrides the padding down to
4px, which put the first and last lines about seventeen pixels inside the arc.

A large radius is harmless on a single-line `Input`: it caps at half the height and the text is
centred well clear of it. A textarea is tall, its text starts hard against the top-left, and the
corner cuts straight through it. So the primitive is `rounded-md` now, and the notes field —
which paints no box of its own — is `rounded-none`. **This is the pill rule's one real
exception, and the reason is mechanical rather than aesthetic: a pill only works where the
radius cannot reach the content.**

The inspector missed it too, and that gap is worth naming: the corner check walked *child
elements*, and a form control's text is not a child. It now measures a `textarea`'s or `input`'s
own text against its own corners, which is a different question from every other check in there.

### Two tiers in the run band, because one could not say "inside"

A flat row of group labels reads "Arc 1, then Volume 1, then Arc 2" and never says that the arcs
are *inside* the volume. The band now draws volumes as a bracket over their arcs: volume name and
rule on top, arc names beneath, chapters under those. `chapterPlacement` walks for the arc and
the volume independently rather than taking "the nearest container", because a chapter can have
either, both or neither — an interlude sits straight in a volume, a prologue at the novel root
has neither. Run numbers stay global across every break; a chapter's number is its position in
the serial, not in its arc.

### Selecting several chapters

Off by default, turned on from the binder's own chrome rather than living on ctrl-click: a
modifier nobody is told about is not a feature. With it on a click picks instead of opening,
shift-click takes the range since the last pick, and **a container stands for every chapter
beneath it** — "queue this arc" being the thing a writer actually wants to say.

Two decisions worth keeping:

- **The selection holds chapter ids only.** Containers are a way of *expressing* a selection,
  not something that can be in one. A bulk delete that could take an arc with it is a different
  and far more dangerous action than the one this offers.
- **The active selection is derived, not pruned.** Intersecting the picks with what is currently
  on screen happens at render, so a status filter cannot cause a bulk action to touch a chapter
  the writer can no longer see — and clearing the filter brings those picks back, which pruning
  in an effect would have thrown away (and would have cascaded a second render besides).

Dragging is off while selecting: a click has to mean one thing.

### Deleting a serial asks you to type its name

`Novel` cascades to volumes, arcs, chapters, codex entries, ties and days, and unlike a chapter
there is no snapshot table standing behind it — this is the most destructive action in the app.
So `deleteNovel` takes a `confirmTitle` and checks it server-side, trimmed and case-insensitive;
the dialog reuses `TitleDialog`, which is already a one-field form. The check is not ceremony. A
dialog that can be clicked through is not a confirmation.

### Sidebar text is not manuscript text

The chapter notes field was set at the manuscript's 16px serif. The Command Centre is 200–300px
wide depending on where the divider sits, and at 16px that is **twenty-seven characters a line**
on a 900px window — a ribbon, not a notes field. It is 14px now. The manuscript earns 16px
because it sits in a 46rem column; nothing in a sidebar does. Note that `md:text-sm` has to be
spelled out, because the Textarea primitive ships `text-base md:text-sm` and would otherwise win
back at desktop widths — the same trap the previous `md:text-base` was written to sidestep.

### A dismiss button belongs in the field, not over it

`DialogContent` puts its close button at `absolute top-2 right-2`. On the command palette, whose
entire top row *is* the search field, that lands the X on top of the field — overlapping it by
23px and reaching past the input's own right edge, so a long query ran underneath it. The
palette now passes `showCloseButton={false}` and hands `CommandInput` an `onClose`, which renders
the X as an `inline-end` addon inside the pill. The input's right padding then comes from the
addon, so nothing can run under it.

### A hover-revealed control cannot anchor a popup

The binder row's tools (drag handle, `+`, `…`) are `display: none` until `group-hover/row` or
`group-focus-within/row` matches. A Base UI popup portals to `<body>`, so the instant one opens,
focus leaves the row, *neither* selector matches, and the trigger the popup is anchored to is
removed from layout. The popup then repositions to 0,0 and closes — it appears in the top-left
corner of the screen and vanishes from under the pointer.

The `…` menu had always tracked its own `open` state for exactly this reason. The `+` menu was
uncontrolled, which is why adding a chapter to an arc was the one path that misbehaved. Both now
feed one `anyMenuOpen` flag that keeps the cluster in the layout. **Any control revealed on
hover that opens a portalled popup needs this**; there is no way to hover your way out of it,
because the pointer is over the popup by then.

### The UI inspector — ⌘/Ctrl + Shift + U in `npm run dev`

`components/workspace/ui-inspector.tsx` plus `lib/ui-debug/inspect.ts`. Mounted from the root
layout behind `NODE_ENV !== "production"`, so it is absent from a build rather than dormant
in one.

Seeing that something looks wrong is the easy half. The hard half in *this* app is the second
question — which token is the right one instead — because colour values live only in
`palettes.ts`, the ramps run by role rather than by lightness, and the browser's own element
panel will tell you a heading is `#8c491a` and leave you to work out that its name is
`--press-700` and that one rung lighter fails 4.5:1. So the inspector reports the **name** of
what is painted, and measures the pairings `theme:check` measures.

- **Point** (default) — hover anything: its box, every colour it paints with the token name
  beside the value, and its contrast against the colour actually behind it, with the right
  floor for its type size. A colour on a ramp rung below the contract's minimum for how it is
  being used says so ("rung 400 — below the 600 graphical-mark rung"). Space pins the reading.
- **Scan** — every measurable fault on the page: contrast under the floor, text clipped with
  nowhere to go, content crowded by a corner radius (see above), elements painted outside a
  viewport that does not scroll, and controls under 24×24 (WCAG 2.2). Click one to scroll to it.

It works hard at *not* reporting correct code, because a checker nobody trusts is worse than
none. `sr-only` text is 1px and clipped by design; Base UI parks a 1×1 span holding the letter
"x" inside every gauge; a truncated title's `Range` still measures the full untruncated run;
centred glyphs are nowhere near the corner their button's padding box suggests; a decorative
graphic is *meant* to be masked by a curve; and a backdrop is composited through every
semi-transparent layer, not read off the first one that is merely non-transparent — the header's
Export button sits on a 6% wash, and taking that at face value reported plainly legible cream
text as 1.04:1. Each of those was a false positive once, and each is now excluded by name. Glyph positions come from a `Range`, not from the padding box, for
the same reason the colours come from computed style: measure what was painted. The corner check
also looks at a `textarea`'s or `input`'s *own* text, which is the one case the child-element
walk structurally cannot see.

Two things it deliberately does not do. It **never writes a style** — a fix belongs in the
component, in a class the rest of the app already uses. And it is **not of this app's visual
world**: its own chrome is hard-coded and styled inline, not with tokens or utilities, because
a panel painted in `--card` would be unreadable in exactly the palette that needed checking,
and because Tailwind scans all of `src/`, so utilities named there would compile into the
production stylesheet for a component that never ships.

The token table comes from `paletteVars()` — the same function that generates `palettes.css` —
not from reading the stylesheet back. Enumerating the CSSOM is the obvious approach and it does
not work here: under Turbopack the app's own CSS is not in `document.styleSheets` in a form
that lists its custom properties.

`theme:check` and the inspector answer different questions and neither replaces the other. The
script audits a hand-written table of pairings across all eight modes with no browser; the
inspector measures whatever is actually on screen in the one mode you are looking at, including
pairings nobody has added to that table yet. A new pairing found this way still owes the table
a line.

## Workspace architecture (Step 2)

- `src/app/novels/[novelId]/layout.tsx` owns the header and the three-panel shell
  (`WorkspaceShell`: Binder | canvas | Command Center) so panel sizes survive chapter switches.
  It is `force-dynamic`; so is every route that reads the session or the database. Never let a
  DB-backed route prerender. (`src/app/page.tsx` is the marketing landing now; the Library
  moved to `src/app/library/page.tsx` — see **Accounts, plans and billing**.)
- The right panel is the `@panel` parallel-route slot: `@panel/page.tsx` for the novel root,
  `@panel/chapters/[chapterId]/page.tsx` for an open chapter. The center canvas is the normal
  `children` slot. Both have `default.tsx` fallbacks.
- Client components learn the open chapter from `useParams()` (the layout never knows `chapterId`).
- Server actions live in `src/lib/actions/*` (`"use server"`), validate with zod, and return
  `ActionResult` from `src/lib/actions/result.ts` instead of throwing. Tree mutations call
  `revalidatePath("/", "layout")`; notes saves do not revalidate.
- `src/lib/binder/tree.ts` is pure and shared by the server (recomputing `order`) and the client
  (optimistic drag-and-drop). Change move semantics there, nowhere else.
- Deleting a volume or arc moves its children up one level (in order) before the row is deleted.
- Base UI (shadcn `base-nova`) gotchas: composition uses the `render` prop, not `asChild`;
  a `DropdownMenuLabel` must sit inside a `DropdownMenuGroup` or the popup crashes at open;
  callbacks receive `(value, eventDetails)`.

## Editor and word tracker (Step 3)

- `src/components/editor/chapter-workspace.tsx` owns the TipTap instance, the header (title,
  status), the toolbar, and the live footer. Mount it with `key={chapter.id}`.
- Extensions come from `src/lib/editor/extensions.ts`: StarterKit without `code`/`codeBlock`,
  headings 2–3 only, Placeholder, and the Mention node (the `@` popover is passed in).
  Add node types there and nowhere else, and teach the export engine about them.
- Autosave: 900 ms debounce, flushed on blur, tab hide, page hide, and unmount.
  `saveChapterContent` (`src/lib/actions/editor.ts`) recounts words on the server, stores
  content + `wordCount`, and passes the delta to `recordWriting` (`src/lib/data/writing.ts`),
  which owns the daily-session and streak rules. Saves never revalidate; the binder gets live
  counts through `LiveCountsProvider` instead.
- One word-count rule for everything (`src/lib/editor/word-count.ts`): a whitespace token with
  at least one letter or digit. Seed, server, and client all use it.
- Words added/removed (`src/lib/editor/word-diff.ts`) are a multiset diff of normalised tokens
  between the previously saved text and the new one, computed on the server per save and
  summed into `WritingSession.wordsAdded/wordsRemoved`. The client mirrors the diff against
  its last-saved baseline for the live footer ("today", across chapters) and the chapter
  header ("this sitting", since the chapter was opened). `wordsWritten` stays the floored
  running net used by the goal and streak.
- Sweet-spot zones and the encouraging messages live in `src/lib/editor/sweet-spot.ts`; the
  message is chosen per zone with a per-chapter seed so it doesn't flicker while typing.
- `.chapter-editor` styles sit in `globals.css` next to `.manuscript`, which the editor root also carries.
- If a chapter's stored content will not parse, `ChapterWorkspace` refuses to open the editor
  and disables every save path. Mounting an empty editor over unreadable text would let the
  first autosave destroy it; there is no version history to fall back on.
- Live word counts and mention counts go through `src/components/workspace/live-chapter.tsx`,
  a **module-level store** read with `useSyncExternalStore`. It is deliberately not React
  context: server actions call `revalidatePath("/", "layout")`, which re-renders the workspace
  from the root and would wipe provider state, snapping the binder and codex panel back to
  saved numbers until the next keystroke. The store also carries the live document (so exports
  include unsaved edits) and the `WritingStatus` the Progress panel renders — the panels sit in
  a different route slot from the editor, so props cannot reach them.

## Light Codex and @mentions (Step 4)

- `CodexProvider` (`src/components/codex/codex-provider.tsx`) sits in the novel layout, above
  both panels, so the editor's `@` popover and the Codex tab share one list and an entry
  created while writing appears in the panel at once. It also owns the create/edit dialog and
  the delete confirmation, exposed as `openCreate` / `openEdit` / `confirmDelete`.
- The `@` popover is `createMentionSuggestion` + `MentionList`. It reads the codex through a
  ref so the extension list stays stable (rebuilding it would remount the editor). Escape
  dismisses it until the next `@`; once the query reads like prose (>6 words or >48 chars) it
  hides itself, so a stray `@` in ordinary text is harmless.
- `MentionHoverCard` listens for `mouseover`/`mouseout` on the editor wrapper rather than
  wrapping mentions in node views: the schema stays plain (which keeps Step 5's export simple)
  and the caret is never disturbed. `EditorContent`'s own `ref` points at its component
  instance, so the workspace wraps it in a plain `div` to get the DOM node.
- `saveChapterContent` rewrites the `ChapterCodex` index on every save (`syncMentions`), and
  skips ids whose entry was deleted. Deleting an entry leaves the `@mentions` already written
  in the text as plain tags; the hover card simply finds nothing to show.
- One search rule for the panel and the popover: `src/lib/codex/search.ts` (name and aliases
  rank above summaries).

## Export engine and the Progress panel (Step 5)

- `src/lib/export/` turns a stored document into clipboard-ready output: `clean.ts` (shared
  tidying), `html.ts`, `markdown.ts`, and `index.ts` (`exportChapter`). Pure and dependency
  free, so `npm run export:check` exercises it without a browser or a database.
- HTML sticks to the tag set serial platforms accept (`p`, `br`, `em`, `strong`, `u`, `s`,
  `a`, `blockquote`, `ul`/`ol`/`li`, `hr`, `h2`–`h4`) with no classes, styles, data attributes,
  or wrapper elements. The editor's narrow schema is the real sanitizer — a Google Docs paste
  loses its spans on the way *in* — so `clean.ts` only has to deal with what survives that:
  non-breaking and zero-width characters, trailing whitespace, and padding paragraphs.
- **@mentions export as the plain entry name, without the `@`.** They are a writing aid, not
  something a reader should see. The dialog says so in a warning line.
- Markdown escapes only what would otherwise become formatting, and keeps the two-space hard
  break (`tidyOutput`'s `keepHardBreaks`, the one place trailing whitespace is meaningful).
- **A list item's `<p>` unwrapping is decided on the node tree, never by rewriting the output
  string.** The schema is `paragraph block*`, so an item can hold more than one paragraph and a
  word-processor paste is how it arrives — which is the very case this engine exists for. The
  regex that used to strip `<li><p>…</p></li>` matched lazily as far as the next `</p></li>`,
  so a two-paragraph item came out as `<li>first</p><p>second</li>`: a stray closing tag and an
  unclosed opening one, in the one format whose whole job is markup a platform will accept.
- **A Markdown link destination uses the `<…>` form whenever the bare one could be misread.**
  `autolink` is on, so URLs become links without the writer marking them up, and a space or a
  parenthesis in one would otherwise break the surrounding syntax. Both cases are in
  `npm run export:check`.
- Copying writes both `text/html` and `text/plain` through `ClipboardItem` when available, so
  one button serves pasting into a rich editor and into an HTML box. It falls back to
  `writeText`, and reports failure rather than failing silently.
- The right panel's **Progress** tab is the default: word count, the sweet-spot gauge and its
  message, this sitting's and today's added/removed/net, the daily goal, and the streak. The
  footer keeps only what belongs next to the prose — count, gauge, message, save state — after
  the old one had to hide half its content at narrow widths.
- Invisible characters are built from code points (`String.fromCharCode`) rather than written
  as literals: literal ones cannot be reviewed in a diff and were silently mangled on write.

## Conventions

- Database access only through `src/lib/db.ts` (server-only). Scripts that run outside Next
  construct their own client like `prisma/seed.ts` does. The dev cache in `db.ts` is keyed by
  the generated `PrismaClient` constructor, so `prisma generate` after a migration takes effect
  on the next request without restarting `next dev`.
- Status values: `DRAFT`, `EDITED`, `QUEUED`, `PUBLISHED`. Codex categories: `CHARACTER`,
  `LOCATION`, `ITEM`.
- **Colour values belong in `src/lib/theme/palettes.ts` and nowhere else.** `src/app/palettes.css`
  is generated from it and checked in; `globals.css` names no colour; no `.tsx` in `src/` holds
  a hex — with the single, documented exception of the dev-only UI inspector, which must not be
  painted in the palette it exists to measure. Adding a new colour pairing to a component means
  adding a line to the table in `scripts/theme-check.ts` too, or it goes unaudited in every
  palette at once.
- **A write that replaces chapter content owes `syncMentions` and `recordWriting` their turn.**
  `saveChapterContent` and `restoreSnapshot` are both such writes; a third one would be too.
  The mention index is not derived on read, so nothing else will notice it has gone stale.
- **The seed writes `NovelDay` alongside `WritingSession`.** `recordWriting` always writes both,
  so a history with only the cross-novel row is a shape the app itself never produces — and it
  had the Progress panel showing a five-day streak while the Buffer's Pace chart, which reads
  `NovelDay`, drew every one of those weeks as zero.
- Phase 1 steps: 1 scaffold ✔, 2 three-panel shell ✔, 3 TipTap + word tracker ✔, 4 Light Codex
  @mentions ✔, 5 export engine ✔. Phase 1 is complete.
- The Citrus Writing overhaul (rebrand, retheme, Run band, full-page Codex + Ties, export
  scope, the Buffer, the Library) is also complete — see **The Citrus Writing overhaul** below.

## The UI/UX overhaul

Seven foundation steps (tokens, type scale, focus, elevation, motion, shared components,
primitive swap) then the surfaces. The foundation is documented under **Design language**
above; what follows is what the surface work changed.

### Three grounds, and a page

`--background` (the well the canvas sits in) → `--chrome` (panels and bars) → `--sheet` (the
manuscript). This is what stopped the workspace reading as one grey field; the dividers were
deliberately *not* made louder to compensate. The page is `.canvas-sheet` inside
`.canvas-well` in `chapter-workspace.tsx`, and both read their brightness from Settings:
`--page-lift` mixes the sheet towards the well (0 is genuinely flush), `--lamplight` is a warm
radial gradient on the well, not a shadow on the sheet — the light has to fall on the desk for
the page to look lit by it.

### Light and dark

Superseded by **Palettes and dark mode** near the top of this file, which is where the current
model lives. The finding that outlasted the pass it came from: **for dark text on light, the
worst contrast case is the *darkest* surface (`--muted`), the reverse of a dark theme** — which
is exactly why `theme:check` measures every accent against `--muted` as well as against the
three grounds, and why several of the new palettes needed their `--muted` pulled back toward
the ground rather than their accents pushed further out.

### Settings (per device) vs targets (per account)

`lib/settings/appearance.ts` + `workspace/appearance-store.ts`, plus `workspace/palette-store.ts`
for the palette (its own key and its own pre-paint script — see **Palettes and dark mode**).
Page brightness, lamplight,
measure, type size, typewriter scrolling, dim-other-paragraphs and toolbar visibility are
about *this screen*, so they live in localStorage and are written onto `<html>` as CSS custom
properties by `AppearanceVars` — from an effect, never during render. The daily goal and the
sweet spot are facts about the writer and stay in `AuthorSettings`.

### A written-this-week figure is a flow, and must never be labelled as a stock

The Library's week panel summed `WritingSession.wordsWritten` across the current week and
rendered it as "**8,831** words across 2 serials" — which is a claim about how big the serials
*are*. It is not: it is how much was written in seven days, and the two diverge as soon as
anything is rewritten or thrown away. A writer whose cards add up to 4,790 words reads that
sentence as simply broken, and they are right to.

Two mechanisms make the flow exceed the stock, both deliberate and neither a bug on its own:

- **Each day's net is floored at zero.** A day spent cutting counts as nothing, never as a loss,
  so a week's sum is always at least the real change in the manuscripts.
- **Deleting a chapter does not subtract its words.** `recordWriting` is called from exactly one
  place — `saveChapterContent` — so `deleteNode` and `deleteChapters` leave the counters alone.
  Write four thousand words and delete the chapter, and the day still says four thousand.

That second one is a real product question rather than a settled rule: it says the counters
measure *writing done*, not *words kept*, which is defensible for a streak and surprising for a
total. Left as it is; the fix was the label, which now reads "words written this week".

### Counts are per story; the goal and the streak are not

`NovelDay` is one row per novel per day; `WritingSession` stays the cross-novel daily row that
drives the goal and the streak. `recordWriting(db, change, novelId)` writes both. 600 words in
one book and 500 in another is a thousand-word day — but "today" in the Progress panel means
*this* story. The two rows are kept separately rather than one derived from the other so the
writer's day survives a novel being deleted.

### The writing canvas

- **Selection menu** (`editor/selection-menu.tsx`): formatting plus **Add to codex**, which is
  how a name already written becomes an entry. Hand-rolled rather than the bubble-menu
  extension so it can decide what to offer from the selected text, and so `onMouseDown`
  preventDefault keeps the selection alive.
- **`/` commands** (`lib/editor/slash-command.ts`): the same Suggestion plumbing as `@`. An
  Extension, not a Node — nothing is inserted, the command deletes the `/query` and runs an
  ordinary editor command, so the schema stays as narrow as the export engine expects.
- **Unlinked mentions** (`codex/unlinked-mentions.tsx`): scans the *live* document for an
  entry's name written as plain text, so it notices the moment it is typed. Nothing is
  rewritten until Link is pressed — an entry named "Bell" would otherwise tag every bell in
  the book, and there is no version history to undo it. The link runs in the editor, through
  the same commands typing a mention would.
- The footer is word count and reading time left, save state right, and the gauge centred on
  the footer itself (not on the space between them, so it does not drift as the count grows a
  digit) with its number beneath.
- Encouragement moved out of the footer and under the daily goal, and **changes when the goal
  is crossed** (`lib/editor/goal-message.ts`).

### Shell

**Never read localStorage during render.** `defaultSize` on a resizable panel is part of the
server-rendered markup, so a stored width read in the render path hydrates a different
`flex-basis` than the server sent and React reports a mismatch. The panels render at
`DEFAULT_SIZES` — what the server rendered — and resize themselves in an effect. The same rule
is why the appearance and layout stores expose their values through `useSyncExternalStore`
with a server snapshot: React sanctions that pattern and re-renders after hydration instead of
warning. Sizes are also only *recorded* once a handle is actually grabbed: a panel reports its
width on mount too, and that report is the default, which used to overwrite the remembered
width a frame before the restore could apply it.

**A dark-mode extension is locked out, and that is a design decision before it is a hydration
one.** `<meta name="darkreader-lock">` sits in the root layout's `<head>`, and Dark Reader
honours it. This app ships four palettes in light *and* dark, generated from one source and
audited at 472 contrast pairings; an extension re-tinting that on top undoes the exact guarantee
the theme system exists to make. A writer who wants dark has Settings → Theme.

The hydration noise is what made it visible. Dark Reader rewrites inline styles and SVG strokes
before React hydrates — `--darkreader-inline-color` on the wordmark's `next/image` `<img>`
(which carries `style="color:transparent"` to hide alt text while loading), and
`data-darkreader-inline-stroke` on every Lucide icon — so React finds markup that is not what
the server sent. **There is no suppressing that one element at a time**:
`suppressHydrationWarning` covers an element's own attributes, not its subtree, and `<html>`
and `<body>` already carry it without helping anything in between. The icons are everywhere.

Write the tag as JSX, not through `metadata.other`: the form Dark Reader matches carries no
`content` attribute, and Next drops an `other` entry whose value is an empty string. The
wordmark keeps a `suppressHydrationWarning` of its own as belt-and-braces for other extensions
that rewrite inline styles, and because a fixed src at a fixed size has nothing that could
legitimately differ between server and client.

**The clock is a client fact too, and breaks hydration the same way.** The Library is a client
component and built its "Wednesday evening · day 2" kicker from `new Date()` during render, so a
server in UTC and a writer in another timezone disagreed about the weekday and about
morning/afternoon/evening. React found different text than it had rendered and hydration failed
for *the whole page*, not just that line. It now comes from `useSyncExternalStore` with a
`false` server snapshot — the same three arguments the appearance and layout stores use, and for
the same reason: React sanctions that shape for a value that differs between server and client,
where setting state in an effect earns a cascading-render warning instead.

Hidden panels are **not rendered**, not collapsed to zero: the library's imperative
`collapse()` loses to its own layout solver exactly when the group is tight. Focus mode
(⌘\) is both panels away and is derived, not stored, so the two can never disagree. Below
1024px the side panels become overlays instead of columns.

**Restoring a width must never throw, and must be able to try again.** Because hidden panels
are not rendered, showing one *adds* a panel to an already-mounted group — and a panel handed
to `resize()` in that same commit has a ref but no layout yet, because the group only
recomputes its layout in a later render pass. `resize()` threw `Layout not found for Panel …`
there, out of an effect with no error boundary above it, which took the whole workspace down:
every panel toggle was fatal on the second click, as was leaving focus mode, and as was
navigating back to a chapter from the Codex or the Buffer (both drop the command centre, so
returning re-adds it). The effect now catches and retries on a timer — a timer rather than
`requestAnimationFrame`, which does not fire while the page is hidden.

**The header sheds labels before it sheds controls.** It was a fixed-width flex row needing
about 610px, and the overlay layout only begins at 1023px, so between those two the whole
right-hand cluster — both panel toggles, the palette, the Codex and Export — was painted past
the edge of the viewport with nothing to scroll to it. At `sm` the wordmark keeps only its
mark, at `md` the ⌘K and Export labels go, and the breadcrumb is `lg` and up; every control
survives to 320px. What goes at each step is text that is said again somewhere else.

### Accessibility

`role="tree"` with a roving tabindex (one tab stop, arrows move, Left/Right open and close);
`main`/`nav`/`aside` landmarks and a real `h1`; the `@` popover described from the editor with
`aria-expanded`/`aria-controls`/`aria-activedescendant` because focus deliberately never
leaves the manuscript; both gauges are real `role="progressbar"`s; autosave announces through
a polite live region; the mention hover card is a `dialog`, not a `tooltip` — it holds a
button.

### Safety net

`ChapterSnapshot` + `lib/data/snapshots.ts`. **On by default, not opt-in** — a version history
you have to remember to switch on only helps people who already thought about the problem,
which is never the person who needs it. A copy of the *previous* text is kept on save when
either rule fires: nothing kept in the last fifteen minutes, or the save removes a quarter of
the chapter (or 150 words), which is the shape of the accident this exists for. Restoring
snapshots the current text first, so it is never a one-way door, and hands the content back to
the open editor rather than reloading — a reload would race the autosave already in flight and
lose the version just restored.

**A restore is a content write like any other, so it owes the same bookkeeping.** It rewrites
the `ChapterCodex` index through the shared `lib/data/mentions.ts#syncMentions` — the restored
text carries its own @mentions, and leaving the index alone had the Codex's "where it appears"
counting mentions that were no longer in the chapter until the writer happened to type again.
It also prunes: the "before-restore" copy is kept unconditionally, so without a prune of its
own a chapter restored often enough sat above the twenty-copy limit indefinitely. `syncMentions`
lives in `lib/data/` rather than beside the save action because a `"use server"` module can
only export server actions, and both writers need it.

### Still open (as of this pass)

Exporting more than one chapter at once, the right-panel "Buffer" (release schedule), and
deeper Campfire-style worldbuilding (relationships, timelines, entry templates) — all three
shipped in **The Citrus Writing overhaul**, immediately below.

## The Citrus Writing overhaul

The redesign covered in **The visual world: Citrus Writing** and **Design language** above,
plus four features the handoff's screens called for that Phase 1 never built. Shipped in six
staged steps (`.claude/plans/vivid-wondering-walrus.md`): tokens/fonts/primitives, the
Workspace restyle and the Run band, the Codex work below, export scope, the Buffer, and the
Library.

### Codex: a full page, not a side panel

The handoff's Codex screen is Binder | entries list | entry detail, with the Command Centre
column gone entirely — not collapsed, gone, the same way focus mode removes a panel rather
than shrinking it. `/novels/[novelId]/codex` and `/codex/[entryId]` are new routes; their
`@panel` slot resolves to `null` (`@panel/codex/page.tsx` and `@panel/codex/[entryId]/page.tsx`)
so `WorkspaceShell` gives that width to `CodexBrowser` instead.

**The old in-chapter Codex tab was not replaced — it was kept, and pointed at the new one.**
Deleting it would have cost the one thing it does that the full page cannot:
`UnlinkedMentions` scans the *live*, unsaved document of whatever chapter is actually open, and
linking a mention there rewrites that same live editor through its own commands. Neither half
of that exists for a chapter that is not the one on screen. So the full-page Codex's own
unlinked-mentions card (`codex/unlinked-summary.tsx`) is deliberately read-only: it scans every
chapter's *saved* content (`lib/data/codex.ts#getUnlinkedMentionSummary`, reusing the same pure
`lib/codex/unlinked.ts` matcher) and links out to the chapter instead of linking for you — two
tools reading two different sources on purpose, not two attempts at the same thing.

**Ties** (`CodexTie`) are a new model: `fromEntryId`, `toEntryId`, a short `label`, a sentence
`description`. Authored from one entry's point of view and shown only there — no reciprocal
tie is inferred, because "a tie is a sentence, not a diagram" (the handoff's own words) extends
to not pretending every relationship is symmetric. Cascades with either entry's deletion.

**Character-sheet fields** (`CodexEntry.sheetFields`) are a JSON array of `{label, value}`
pairs, not fixed Role/Wants/Fears/Tell columns, even though that is the only template the
handoff shows — a future Location or Item template needs no migration this way. Edited inside
the existing `CodexFormDialog`, not a separate surface: the sheet is part of what "editing an
entry" means, the same as the summary or the aliases.

### Export scope: an arc, a volume, or the whole serial

`exportChapters()` (`lib/export/index.ts`) maps the untouched single-chapter `exportChapter()`
over an ordered list and decides only what sits between the results: each chapter's own title
as a heading, or a bare scene-break marker with no titles at all. `getChaptersForExport`
(`lib/actions/export.ts`) resolves the scope (arc/volume/novel) through the same
`descendantChapters` the Binder already orders by, so a multi-chapter export reads in the order
a reader would actually meet it. The dialog's "Include chapter title" toggle becomes "Between
chapters" once the scope is more than one chapter — two different questions that happen to
render as one control replacing the other, not the same question renamed.

### The Buffer: a release schedule that publishes nothing

`Novel.cadenceFrequency`/`cadenceWeekdays`/`cadenceTime`/`cadenceTargetWeeks`/`cadenceAnchor`
and `Chapter.scheduledFor` are the whole schema. `lib/schedule/cadence.ts` is pure day-by-day
slot arithmetic — Weekly, Twice weekly and Fortnightly share one implementation
(`nextSlots`/`previousSlots`) instead of three, and Fortnightly's on/off week is anchored to
`cadenceAnchor` (reset whenever the cadence changes) rather than to "today", so the pattern
does not redefine itself depending on which day you happen to open the page.

**Runway** is consecutive filled future slots from now, converted to weeks by how many slots
make up a week for the current cadence (`slotsPerWeek`) — not a count of scheduled chapters.
Two chapters scheduled with a gap between them read as less runway than two back-to-back ones,
which is the honest answer to "how far ahead am I" even though it can look strict right after
changing cadence (Weekly → Twice weekly can drop the runway to zero if the very next *new*
slot is empty, even with chapters already sitting further out on the old slots).

**Six cadences, from fortnightly to twice a day.** `slotsPerWeek` runs 0.5, 1, 2, 3, 7, 14, and
`weekdaysNeeded` says how many days each asks the writer to pick — one for Weekly and
Fortnightly, two and three for the weekly multiples, and **none** for Daily and Twice daily,
which release every day and never consult the weekday row at all. The editor hides that row for
them rather than showing seven buttons that do nothing.

Twice daily is the only cadence with two releases on one date, and it is the reason a slot is
now a *moment* rather than a day. Two decisions hold the old data together with the new:

- **Slot one of every day is still midnight**, not `cadenceTime`. `scheduledFor` has always
  stored `startOfDay`, so anchoring slot one anywhere else would strand every chapter already on
  a calendar. The clock time is what the board *displays*; it only becomes load-bearing for the
  second release of a day, which needs something to tell it apart from the first.
- **`toSlots` matches on the exact moment, not the calendar day.** Matching by day handed the
  same chapter to both of a twice-daily date's slots.

**Changing the cadence strands chapters, and the board says so rather than hiding them.** The
slot strip can only show dates the cadence still releases on, so a chapter scheduled for a
Monday under a Mon/Thu cadence has nowhere to appear once the writer switches to Thu/Sat. It
used to simply vanish from the board and turn up on the Bench, whose own heading reads "drafts
with no date yet" — which was false; the date was still in the database. `getScheduleBoard`
now queries every chapter carrying a `scheduledFor`, not only the ones landing in the visible
window, so the Bench excludes anything with a date and `offCadence` collects the ones whose
date `isSlotDay` no longer recognises. They render under **Off the calendar** with the date
they still hold and two ways out: *Move* to the next open slot, or *Clear*. Nothing is
re-slotted or wiped automatically — the date is the writer's plan, and this app does not
rewrite a plan unasked.

**The Bench-to-slot assignment is real drag-and-drop** (`@dnd-kit/core`'s `useDraggable`/
`useDroppable`, the same library the Binder already depends on), plus a "Queue" button
(`queueNextOpenSlot`) that finds the earliest open slot for a keyboard or non-drag path. A
chapter can only be scheduled once it is `EDITED` or later — enforced in the action, not just
the UI, matching the Bench's own "drafts with no date yet" framing.

`/novels/[novelId]/buffer` drops the run band (client-side, `usePathname()` in `run-band.tsx`)
and the Command Centre column (`@panel/buffer/page.tsx` → `null`, same mechanism as Codex) for
the same reason: this is a planning surface, not something to keep beside the manuscript.

**A `DndContext` needs an explicit `id` prop for SSR.** Without one, dnd-kit's internal
`DndDescribedBy-N` accessibility id increments per mount and disagrees between the server's
render and a client that has already mounted a different `DndContext` earlier in the session,
which React reports as a hydration mismatch. `id="binder-dnd"` already existed for the Binder;
the Buffer's is `id="buffer-dnd"`.

### The Library: a home page that did not exist before

`/` used to redirect into the latest novel the instant one existed — there was no dashboard to
skip. `listNovelCards()` and `getContinueWriting()` (`lib/data/novels.ts`) walk each novel's
own binder tree (`getBinderNodes` + `flattenTree`) rather than trusting `order` across
containers directly, so the Library's mini run-dots agree with the real Run band and Binder
about chapter sequence. `getContinueWriting()` is the single most-recently-touched chapter
*across every novel* — a different shape from `getLatestChapterId`, which stays scoped to one
novel for the workspace's own use.

**A `WorkspaceShell` prop is never truly `null`.** The same non-null-wrapper behaviour that
motivated the Codex/Buffer route detection above means a parallel route's `@panel` slot can
never be compared against `null` from its parent layout — Next wraps every slot in its own
internal element before the parent ever sees it, whether the leaf page returned `null` or not.
`WorkspaceShell` decides whether to render the Command Centre column by matching the pathname
(`/codex`, `/buffer`) instead, the same technique `RunBand` already used to decide whether to
render itself at all.

### Still open

Deeper Campfire-style worldbuilding beyond Ties: timelines and per-category entry templates.
The Buffer's slot strip only ever shows the next few release dates and two behind "now" — it
does not reconstruct a full publication history from `publishedAt`. The four mid-ramp status
marks `npm run theme:check` reports but does not enforce — see **Palettes and dark mode**,
which is the app's main open accessibility item.

## Accounts, plans and billing

The app had no users at all until this pass: one SQLite file, one implied writer, `/` was the
Library. It now has accounts, and everything else in this file has to be read through that —
every novel belongs to someone, and every read is scoped.

Built from the handoff's own Landing, Pricing and Accounts screens (`.claude/plans/` has the
staged plan; the design bundle is the three `.dc.html` files of those names).

### Routes moved

`/` is the **marketing landing**; the Library is `/library`. A signed-in writer landing on `/`
is deliberately *not* redirected away — the nav offers "Your library" instead of "Start
writing". Bouncing them would mean the person most likely to send someone the link is the one
person who cannot look at it.

New: `/pricing`, `/sign-in`, `/sign-up`, `/forgot`, `/reset`, `/account`, plus the route
handlers `/api/auth/oauth/[provider]{,/callback}` and `/api/stripe/webhook`.

### Sessions are rows, and the expiry is absolute

`src/lib/auth/session.ts`. The cookie holds 32 bytes of CSPRNG output; the row's id is a
**SHA-256 of that token, never the token** — a leaked database then hands an attacker hashes
rather than a drawer of usable cookies. Plain SHA-256, not scrypt: the input is already 256
bits of randomness, so there is nothing to brute-force and a memory-hard hash on every request
would be pure cost.

**The expiry is absolute (30 days), not sliding, and that is a framework constraint rather
than a preference.** Next only permits a cookie write from a Server Function or a Route
Handler, so a session read during an ordinary page render *cannot* re-issue the cookie. A
sliding window would therefore slide only on the routes that happen to mutate something, which
is a confusing half-measure. `lastSeenAt` is still refreshed so the DB row cannot lapse before
the cookie it backs.

This is also why the sign-in card does **not** render the handoff's "Keep me signed in on this
machine" checkbox: it would govern nothing.

### Passwords are scrypt, on nothing but `node:crypto`

`src/lib/auth/password.ts`. Every native hashing package (bcrypt, argon2) skips Windows on
ARM64 in its prebuilds, which is the same dead end that put this project on `node:sqlite` — so
scrypt from the standard library, at N=32768. The stored string carries its own parameters
(`scrypt$N$r$p$salt$hash`), so raising the cost later re-verifies old hashes instead of locking
everyone out; `needsRehash` upgrades one in place at the only moment the plaintext exists.

The minimum length lives in `password-rules.ts` — a separate, `node:crypto`-free module — so
the sign-up form's meter and the server's validator read the same number rather than each
holding a copy that can drift.

**Nothing tells an anonymous caller whether an address has an account.** Sign-in answers
identically for "no such user" and "wrong password" *and takes the same time doing it*
(`burnVerificationTime` burns one scrypt against a fixed dummy hash, because otherwise the two
differ by the whole cost of the KDF and that difference enumerates the user table). The
password-reset request returns the same success for any well-formed address. Sign-up is the
one unavoidable exception — it has to refuse a duplicate — so it says so plainly.

### Providers exist or they do not

`src/lib/auth/oauth.ts` — Google and GitHub, hand-rolled against their endpoints, because the
authorization-code flow is four HTTP calls and this project cannot take a dependency lightly.
PKCE for Google, which implements it; not for GitHub, whose OAuth apps reject the parameters.

`availableProviders()` reads the environment, and **a provider without both variables set does
not exist**: its button is never rendered and its route 404s. A "Continue with Google" that
cannot work is worse than no button. When none are configured the divider above the password
fields goes too, rather than leaving "or with a password" separating a form from nothing.

Linking rules are in `link-account.ts`. The provider's own account id is the key, never the
email — so changing your Google address keeps your account. Matching an *existing* account by
email is only safe because `fetchProfile` refuses an unverified address from either provider;
without that check, provider sign-in is an account-takeover route.

### Two plans, not the three the mock drew

`src/lib/billing/plans.ts` is the single source: the pricing table, the upgrade prompts and the
server-side checks all read the same object, so a limit cannot be advertised as one number and
enforced as another.

**Studio is not built.** Its five seats need shared novels, per-seat permissions and chapter
comments — none of which exist — and a plan whose headline feature is fiction does not belong
on a pricing page. It slots in beside these two without any call site changing shape.

| | Drawer (free) | Serial |
| --- | --- | --- |
| Serials | one | unlimited |
| Manuscript, volumes/arcs, notes, run, sweet spot, streak | yes | yes |
| Versions kept per chapter | 20 | unlimited |
| Export scope | chapter | chapter, arc, volume, serial |
| Export formats | all three | all three |
| The Buffer: schedule, runway, pace | — | yes |
| Codex entries / ties | entries only | both |

The split is the one the writer asked for: Drawer is the raw writing architecture, and
everything that measures a *schedule* rather than a sentence is Serial.

**There is deliberately no `advancedMetrics` flag.** "More advanced metrics" belong to Serial
and will come, but every metric that exists today — runway, pace, the release board — is
already behind `buffer`. A second flag gating nothing is a promise the code cannot keep and a
branch nobody can test. The metrics that are *not* going behind a plan: live word count, the
sweet-spot gauge, the daily goal and the streak. Those are writing feedback, the landing page
sells them as part of the free workspace, and removing them would make Drawer bad at the one
thing it exists to be good at.

**A downgrade never deletes.** `canCreateNovel` asks "may I add one more", counting what
exists — so a writer dropping to Drawer with three serials keeps all three and simply cannot
make a fourth, which is what the pricing FAQ promises. For the same reason `unscheduleChapter`
and `deleteCodexTie` are *not* gated: a Drawer writer must be able to clear the leftovers of a
subscription they no longer have.

### Authorization is one call at the top of every action

`src/lib/auth/guard.ts`. An action opens with `await authorizeNovel(id)` (or
`authorizeChapter` / `authorizeCodexEntry` / `authorizeCodexTie`), gets back either a failure
it returns verbatim or the user plus their capabilities, and contains no other authorization
code. **"No such novel" and "not yours" return the same message**, so an id cannot be probed
for existence.

This replaced a bare `novelExists` check that three binder actions ran and three skipped
entirely — `moveNode` and `deleteNode` took a novelId and a nodeId and trusted both, which was
fine while the database held one writer's work and is not fine now.

A disabled button is a courtesy; the action refusing is the control. Both exist, and the
server-side one is the one that matters.

### Stripe, over `fetch`

`src/lib/billing/stripe.ts`. Checkout plus the Billing Portal means this app never touches a
card number, renders no payment form, and does no tax, SCA, dunning or receipts — some of which
would be *compliance* work. Hand-rolled against the REST API rather than the `stripe` package:
the surface used is three POSTs and one HMAC, and the API is form-encoded, so
`URLSearchParams` is the whole client.

**The webhook grants the plan; the browser never does.** A browser returning from Checkout
proves nothing, so `?upgraded=1` only makes the account page say thank you. `/api/stripe/webhook`
reads `request.text()` and never `request.json()` — the signature is over the exact bytes sent,
and re-serialising them fails every signature. An unverified request is a 400 and nothing else;
without that the endpoint is a public "make me a subscriber" button. Handlers are idempotent
because delivery is at-least-once and out of order: each sets the account to the state the
*subscription* is in rather than nudging it. `PAST_DUE` keeps the plan, because Stripe retries
a failed card for days and locking someone out of their manuscript on the first retry is a
worse failure than the payment.

**Without `STRIPE_SECRET_KEY` the upgrade switches the plan directly and says so**, so every
gate above can be exercised end to end before a Stripe account exists — and that fallback is
refused in production, so a deploy missing its keys cannot quietly give the paid plan away.

### One email, and it is honest when it cannot send

`src/lib/mail/send.ts` — the password-reset link, over Resend's HTTP API (one POST; SMTP would
mean a dependency). With no key the message is **printed to the server log** and the
"check your email" screen says exactly that, because a reset that vanished silently leaves a
writer waiting for mail that was never coming.

Reset tokens are hashed like session tokens, single-use, thirty minutes. Redeeming one drops
every other outstanding link *and every session*, which is the whole point of a reset.

### `?next=` is validated

`src/lib/auth/safe-next.ts`. An open redirect is how a sign-in page becomes a phishing tool.
Both leading-slash checks matter: `//evil.example` is protocol-relative, and testing only the
first character lets it straight through.

### Base UI: a Button that renders a link needs `nativeButton={false}`

Thirteen call sites. Worth knowing because the failure is quiet in two different ways: Base UI
logs a console error rather than throwing, and — if the prop lands *after* the opening tag has
closed — `nativeButton={false}` is valid JSX for a text child plus an empty expression, so
**TypeScript accepts it and the literal string `nativeButton=` renders on the page**. That
shipped to a live page once during this work and was caught by reading the rendered text, not
by the compiler.

## Export: the finished dialog

Rebuilt against the handoff's "Export and history" screen. The shape is its: scope capsule,
then the chapters that scope contains as real rows, then format and separator side by side,
then the preview, then a footer stating the size of what is about to leave.

Three changes that are not cosmetic:

- **The chapter list is a control, not a receipt.** Each row's tick turns off. A serial author
  shipping a backlog nearly always wants "this arc, except the one I have not finished"; before,
  the list only *displayed* what was going, so they exported the arc and deleted a chapter out
  of the clipboard afterwards. Exclusions reset on a scope change — an arc's third chapter is
  not the serial's third chapter, and carrying one across would silently drop something.
- **Plain text is a real third format** (`lib/export/plain.ts`), not Markdown with the symbols
  removed. Markdown escapes characters *so a parser survives them*; plain text has no parser,
  so escaping would be actively wrong — a writer's own asterisks must arrive as typed. Every
  escape rule is dropped rather than adapted, which is why it is its own renderer.
- **Download sits beside Copy.** The clipboard is right for pasting into Royal Road; a file is
  right for an editor, a backup or a beta reader. Both come off the same rendered string.

Smaller, and each with a reason:

- **The chapter title exports as `<h2>` / `##`, not `<h1>` / `#`.** Royal Road and the rest
  already print the chapter title as the page's h1, so a second one put two page titles on the
  page; "its title as a heading" across an arc emitted three h1s in one document; and the
  editor's own schema stops at headings 2–3, so h1 was the only heading this engine could emit
  that a writer could not have typed.
- **The scene-break control appears only when the text contains a scene break.** Same rule the
  app applies to explanatory copy, applied to a control that could otherwise do nothing.
- **Locked scopes are shown padlocked, not hidden.** A Drawer writer who has just finished an
  arc should be able to see that exporting the whole arc is a thing this app does; the padlock
  routes to `/pricing?from=export`. The *action* refuses independently — see `getChaptersForExport`.
- **Run numbers come from `runNumbers()` in `lib/binder/tree.ts`**, extracted so the Run band,
  the Binder badge and this list cannot disagree about a chapter's position in the serial.

`npm run export:check` covers all three formats, including that plain text escapes nothing and
that an autolinked URL is not repeated after itself.

### Contrast

`npm run theme:check` now enforces **624 pairings** (was 472) across four palettes in light and
dark, all clear. Two things were added to its table:

- **`neutral-100` is a fifth audited ground.** The handoff sits its landing, pricing and auth
  cards on it rather than on `--card`, and the export preview well does too. In a dark palette
  it is the *darkest* neutral, so it is genuinely a different ground in one mode of four
  palettes — exactly what that table exists to catch.
- **The landing page's four figure discs**, which pair an accent-ramp numeral with a
  *neutral*-ramp caption on a tinted circle — a combination nothing in the workspace had painted.

The four mid-ramp status marks remain reported-but-not-enforced, unchanged.

## The legal pages

Terms of Service, Privacy Policy and Refund and Subscription Policy, at `/legal/terms`,
`/legal/privacy` and `/legal/refunds`, with an index at `/legal`. Written against what this
codebase actually does rather than against a template — every factual claim in the privacy
policy is one someone could check by reading the source, which is why it can say plainly that
the analytics are cookieless and identify nobody, that session rows carry no IP address, that
the typefaces are self-hosted so no request leaves for Google, and that the one cookie is
strictly necessary and therefore needs no banner.

That analytics clause read "there is no analytics of any kind" until Plausible was added, and
it is the clearest example of why these documents are kept in the repo rather than in a CMS:
the script tag and the sentence denying it are one commit apart in the same tree, so the
sentence could not quietly outlive the fact. See **Analytics** below.

Three documents, one renderer (`components/legal/legal-page.tsx`), one type
(`content/legal/document.ts`). Content lives in `src/content/legal/` beside `site-copy.ts` and
follows its spirit — plain strings, no HTML — but with its own two-rule inline grammar in
`LegalText`: `*bold*` and `[label](href)`. `Emphasis` was deliberately not extended to cover
the second. Its contract is "one rule, and an unmatched star is a star", which is what makes
`site-copy.ts` safe for a non-programmer to edit; giving that file a link syntax is giving it a
new way to break the landing page.

### Analytics

Plausible, added 2026-09-12, and it is the only thing in the app that measures a visitor. The
tag lives in the root layout behind `NODE_ENV === "production"` — on in a deploy, absent from a
dev run, so a writer's own localhost clicking never lands in the numbers.

It was chosen for what it does not do, and every one of those is load-bearing on a document:

- **No cookie, and nothing stored on the device.** The session cookie stays the only one, so the
  "strictly necessary, therefore no banner" position survives intact. A cookie-based tool would
  have meant a consent banner on every page under UK/EU e-privacy and Law 25, plus the consent
  state to carry it.
- **No identifier of any kind**, persistent or hashed, so it cannot follow a reader between
  visits or to another site, and it is never joined to an account.
- **EU servers** — the one processor in the stack that is not a transfer to the United States,
  which the privacy policy's **Where it goes** section now says explicitly.

**The tag and the policy changed in the same commit, and that is the point.** The privacy policy
had said, in as many words, that there was no analytics of any kind. Shipping the script without
the sentence would have made the document false at the moment the script loaded. Four claims had
to move: the gist line, the cookie section's "no analytics cookie", the "only third-party script
is Stripe's" line (there are two now), and the transfers section. A fifth surface — this file —
said it too.

Basis is legitimate interest, objectable at the contact address. A Do Not Track signal or any
content blocker prevents the script loading, and nothing works around that.

### Prices are read, never restated

The refund policy quotes `$9`, `$84` and `$7 a month` by calling into `lib/billing/plans.ts`,
the same rule the pricing page follows and for a stronger reason: a stale price on a marketing
page is embarrassing, and a stale price in a refund policy is a misrepresentation.

### Four values must be filled in, and a script enforces it

`content/legal/details.ts` ships the legal entity, its address, its country and a contact
address as the sentinel `‹fill in›`. UK/EU law requires the first three (the controller's
identity and a *geographic* address — a PO box or an email does not satisfy it) and the rights
sections are worthless without the fourth.

`npm run legal:check` fails while any remains, and it runs inside `npm run build`, so a deploy
cannot quietly ship a policy that names nobody. It also resolves every internal
`[label](/legal/slug#anchor)` against the real section ids, because anchors get renamed and a
cross-reference that lands on nothing is a clause the reader cannot follow.

### "Cancel anytime, no refunds" needed a mechanism, not just a sentence

The commercial stance is the writer's: cancel any day, access runs to the end of the paid
period, the unused part is not returned. That is a legitimate position and it is what the
policy says.

It could not be the *whole* position for an international userbase. A UK or EU consumer has a
14-day right to withdraw from a distance contract that no term of ours can remove; a page
flatly denying it would be unenforceable exactly where it mattered and would itself be an
unfair commercial practice. So the right is stated, and the lawful mechanism is used instead of
pretending it is not there — where the consumer expressly asks for the service to begin within
the 14 days **and acknowledges losing the right once it has been fully performed**, the right
falls away.

`components/billing/checkout-acknowledgement.tsx` is that consent: a box the writer ticks
themselves, **never pre-ticked** (a pre-ticked box is not consent, and the waiver would be
worth nothing), alongside a plain disclosure of price, renewal and cancellation that also
satisfies the pre-contract information rules and the US auto-renewal statutes.

**The refusal is in `CheckoutForm`'s `confirm` handler, not on a disabled button.** Stripe's
submit button lives inside its own iframe and cannot be disabled from here, so the confirm
handler is the only place the acknowledgement can actually be required — and it is the right
place anyway, being the step that takes the money. The handler reads a **ref**, not the state:
it is registered once while the SDK is being built, and would otherwise close over `false`
forever.

### Where they are linked from

The marketing footer carries all three directly rather than behind one "Legal" link — an app
store, a payment processor's onboarding check and a procurement form all want a direct one.
The list is read from `@/content/legal`, so a fourth document is added in one place. Short
names (`footerLabel`) there; full titles on the account page, which is the one surface a
signed-in writer sees that is about their account rather than their manuscript, and the place
they are standing when those questions occur to them.

`LegalConsent` is the line under a sign-up or checkout button. **A sentence, not a tick box**,
and the distinction is real: an unticked box is right for a *separate* consent — the marketing
opt-in beside it is one — but agreeing to the terms is not separate from creating the account,
it *is* creating the account. A box that cannot be left unticked and still get you anywhere is
friction pretending to be a choice. What makes the sentence hold up is where it sits:
immediately under the button, before the press, both documents named and linked. It is
deliberately not in `site-copy.ts`; it is the record of what was agreed to, and reworded by
someone rewriting the marketing it stops matching the thing it points at.

### Two claims the pricing page was making that the code did not honour

The FAQ answered "Can I get my work out?" with "Whole serial … on the free plan", and the
sign-up page promised "Export the whole serial whenever you like, even on the free plan".
Drawer's `exportScopes` is `["chapter"]`, and the comparison table three sections above the FAQ
said so. Both now describe what the free plan actually does — every chapter, all three formats
— and note that whole-arc and whole-serial exports are what Serial adds. Worth knowing that a
pass over the legal surfaces is what found them: the documents and the sales copy have to agree,
and only one of them is audited.

### Colour and overflow

The legal pages add **no line to `scripts/theme-check.ts`**, because they reach only for
pairings it already enforces — `neutral-800` body, `--foreground` headings and bold, `--press`
links, `ochre-900` on `ochre-100` for the gist panel, `neutral-800` on `neutral-100` for a
set-apart note. Picking an unaudited pairing for the one page nobody re-reads after launch is
how a palette quietly acquires an unreadable corner.

They also carry `overflow-x-clip`, and so does the pricing page now. The decorative circle the
marketing pages park top-right sits at `right: min(0px, 50vw - 760px)`, which puts it outside
the viewport below about 1520px — the pricing page had been shipping a horizontal scrollbar
with nothing but a background disc to scroll to, and these pages inherited it by copying the
decoration. **`clip` rather than `hidden`**: `overflow-x: hidden` computes `overflow-y: auto`,
which makes the element a scroll container and leaves the "On this page" nav sticking to *that*
instead of the viewport, so it would scroll away. `clip` establishes no scroll container.

### Canada, and specifically Quebec

`Citrus Writing Inc.` is established in Montreal, and that decides more of these documents than a
line in the footer. Three regimes apply at once, and the documents name all three rather than
picking one: **PIPEDA** federally, **Law 25** in Quebec, and — because the product is sold
internationally — UK/EU **GDPR** rights extended to everyone, which was already the stance.

What being in Quebec actually changed, beyond the address:

- **A published Privacy Officer.** Law 25 requires the title and contact details of the person
  responsible for personal information to be public. `privacyOfficerTitle` in `details.ts`, said
  in the privacy policy's first section. By default the role sits with the person of highest
  authority in the enterprise; naming the individual is better once there is more than one.
- **The transfer out of Quebec is disclosed, not buried.** Supabase, Railway, Stripe and Resend
  are all outside Canada, so every manuscript lives in the United States. Law 25 obliges us to
  say so *and* to have assessed beforehand that the information gets adequate protection where it
  lands. It is in the gist as well as the body, because that is the fact a Quebec writer is most
  likely to want and least likely to scroll for.
- **The regulators are a list now, not the ICO.** The CAI in Quebec, the OPC federally, the ICO
  in the UK, the reader's own authority in the EEA. Breach notification names the first two.
- **Portability is Law 25's word for what export already did**, and de-indexing is a right the
  policy states even though nothing here is ever published by us.
- **Age 14 is Quebec's line**, below which consent comes from a parent. The app's own threshold
  sits above it, so it should never bind — stated anyway, because "should never" is not "cannot".
- **Governing law is `${governingLaw}` / `${forum}`** — Quebec plus the federal laws applicable
  in it, judicial district of Montreal — which is why `country` alone was not enough and
  `province`, `governingLaw` and `forum` are their own fields.
- **The Quebec CPA outranks the refund policy**, and both documents say so. It gives a consumer
  the right to sue in their own district whatever a forum clause says, voids terms that remove
  it, and carries its own rules on renewals and unilateral changes. The checkout acknowledgement
  waives the *EU/UK* withdrawal right; it does not and cannot waive the CPA.
- **Currency and tax are stated at the price.** A Canadian company charging USD means a
  foreign-transaction fee the writer's bank adds and we do not see — better said on the page than
  discovered on a statement. GST/QST for Canadian customers.

#### The French version is owed, and the terms say so instead of pretending

The Charter of the French Language, as amended in 2022, is stricter than the familiar one-line
clause suggests. These terms are a **contract of adhesion**, and for those the Charter requires
the French version be provided *first*, with the reader bound by an English one only after
examining the French and expressly choosing it. Reciting that "the parties required this be drawn
up in English" is the standard wording, it is necessary, and on its own **it does not discharge
that obligation** for a consumer contract of adhesion offered from Quebec.

So `terms.ts` carries a `language` section saying what is true — the French version is owed and
is being prepared — plus the same in French, and an undertaking that the more favourable reading
applies until it exists. **This is a translation job with a real deadline, not a code change**,
and it is the one outstanding legal obligation the code cannot close by itself.

#### A consent collected for an email that is never sent

Writing the "why we hold it" table turned one up: `notifyStale` is offered on the sign-up form
*and* the account page, stored on `User`, and **nothing anywhere sends that message**. The only
mail this app sends is the password reset.

Rather than describe a data use that does not happen, the privacy policy says exactly that — the
box records a preference, nothing goes out, and when it does it will carry the name, postal
address and one-press unsubscribe that CASL requires of a commercial electronic message. Worth
knowing that collecting an opt-in for a feature that does not exist is the shape of a dark
pattern arrived at by accident, and that the honest fix is to ship the email or drop the box.
