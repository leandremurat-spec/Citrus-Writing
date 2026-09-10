# Copilot instructions — Citrus Writing

Repo-wide guidance for GitHub Copilot, including Copilot code review. `CLAUDE.md` is the long
form; this is the short form a reviewer needs in front of them. Where the two disagree,
`CLAUDE.md` wins.

## What this is

A writing and publishing workspace for webnovel and serial-fiction authors — chapter-based
serial production, not single static books. Next.js 16 (App Router, Turbopack), React 19,
TypeScript, Tailwind CSS v4, shadcn v4 on Base UI, TipTap v3, Prisma 7 on SQLite through a
custom `node:sqlite` driver adapter.

The repo folder is still named "Pith & Ink Project"; only the product name changed.

## Environment constraints that look like bugs but are not

- **The folder name contains `&`.** npm's Windows `.cmd` shims break on it, so every
  `package.json` script invokes tools through `node node_modules/...` directly instead of
  `npx`. Do not "simplify" these back to `npx next` / `npx prisma`; they fail.
- **Windows on ARM64.** `better-sqlite3` and `libsql` have no ARM64 Windows binaries, so the
  app uses Node 24's built-in `node:sqlite` behind `src/lib/db/node-sqlite-adapter.ts`. Do not
  suggest adding a native SQLite package.
- The Prisma CLI config is `prisma7.config.ts` and does not read `.env`; both it and the app
  import the default URL from `src/lib/db/database-url.ts`.

## Rules worth flagging a PR over

### Colour and theming

- **No hex colours outside `src/lib/theme/palettes.ts`.** `src/app/palettes.css` is generated
  from it (`npm run theme:build`) and checked in; `src/app/globals.css` names no colour value;
  no `.tsx` under `src/` contains a hex. A hardcoded colour anywhere else is a bug in five
  palettes at once.
- **The colour ramps are ordered by role, not by lightness.** `--press-100` … `--press-900`
  (and `--ochre-*`, `--neutral-*`) run faintest-against-the-ground → strongest ink, which means
  in a dark palette `--neutral-100` is the *darkest* neutral. Code that assumes "higher number
  = darker" is wrong.
- **700 is the text rung, 600 the graphical-mark rung.** The 700 rung is guaranteed 4.5:1 as
  text on every ground; the 600 rung is guaranteed 3:1 as the boundary of a graphical object.
  Nothing below 600 promises either. A status dot, ring, or gauge arc drawn at 300/400/500 is
  an accessibility finding.
- Adding a new colour *pairing* to a component (ink X on fill Y) means adding a line to the
  table in `scripts/theme-check.ts`, or it ships unaudited across ten themes.
- Never read `localStorage` during render; it hydrates differently from the server. The stores
  in `src/components/workspace/*-store.ts` use `useSyncExternalStore` with a server snapshot
  for exactly this reason. Anything that must be right *before first paint* (the theme class,
  the palette attribute) goes in an inline script, not an effect.

### Data model

- Hierarchy is `Novel → (Volume?) → (Arc?) → Chapter`. A chapter has at most one parent
  pointer: `arcId`, else `volumeId`, else the novel root.
- Deleting a volume or arc must use `SetNull`, never cascade — chapters are released, not
  destroyed. Deleting a novel cascades.
- `WritingSession` is one row per local calendar day across every novel; `NovelDay` is one per
  novel per day. Both are written **only** by `recordWriting` in `src/lib/data/writing.ts`.
- `ChapterSnapshot` is the only version history. Anything that can destroy chapter text without
  a snapshot in the same transaction is a serious bug.

### Architecture

- Database access only through `src/lib/db.ts` (server-only). Scripts that run outside Next
  construct their own client, as `prisma/seed.ts` does.
- Server actions live in `src/lib/actions/*`, validate with zod, and **return** `ActionResult`
  rather than throwing.
- `src/lib/binder/tree.ts` is pure and shared by server and client. Move semantics change
  there and nowhere else.
- Never let a DB-backed route prerender: those routes are `force-dynamic`.
- Base UI (shadcn `base-nova`), not Radix: composition uses the `render` prop, not `asChild`;
  a `DropdownMenuLabel` must sit inside a `DropdownMenuGroup` or the popup crashes on open;
  callbacks receive `(value, eventDetails)`.
- A `DndContext` needs an explicit `id` prop, or its internal accessibility id disagrees
  between server and client and React reports a hydration mismatch.

### Style

- Comments explain *why*, not *what*, and are expected to survive: this codebase deliberately
  records the reasoning behind non-obvious choices, including choices that were reversed. Do
  not suggest deleting a comment for being long if it is carrying a reason.
- British spelling in prose and comments ("colour", "behaviour").
- Match the surrounding code's idiom rather than introducing a new one.

## Checks

```bash
npm run typecheck     # tsc --noEmit
npm run lint          # eslint
npm run theme:check   # contrast audit across all ten themes; also fails if palettes.css is stale
npm run export:check  # export engine, no browser or database needed
npm run build         # production build
```

There is no unit-test suite. `theme:check`, `export:check` and `db:smoke` are the automated
checks that exist; a PR that changes what they cover should extend them.
