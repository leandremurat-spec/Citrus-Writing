# Citrus Writing — Tech Stack Reference

Extracted for debugging. Source of truth is `package.json` and `CLAUDE.md`/`AGENTS.md` —
re-check those if this drifts.

**Actual source files are copied into [`docs/tech-stack-code/`](tech-stack-code/)** so the
whole stack config is in one folder without hunting through `src/`:

- `tech-stack-code/config/` — `package.json`, `tsconfig.json`, `next.config.ts`,
  `postcss.config.mjs`, `eslint.config.mjs`, `components.json`, `prisma7.config.ts`,
  `.gitignore`
- `tech-stack-code/prisma/` — `schema.prisma`, `seed.ts`
- `tech-stack-code/db/` — `db.ts`, `database-url.ts`, `node-sqlite-adapter.ts` (the custom
  `node:sqlite` driver adapter)

These are point-in-time copies, not symlinks — re-copy after editing the originals if this
folder needs to stay current.

## Runtime / framework

| Layer | Choice | Version |
| --- | --- | --- |
| Framework | Next.js (App Router, Turbopack) | 16.3.4 |
| UI library | React / react-dom | 19.2.8 |
| Language | TypeScript | ^5 |
| Styling | Tailwind CSS | v4 (`@tailwindcss/postcss`) |
| Node | Node.js | via `C:\Program Files\nodejs` (may be missing from PATH) |

## UI components

- shadcn v4, `base-nova` style, built on **Base UI** (`@base-ui/react` ^1.7.0) primitives —
  NOT Radix. Composition uses the `render` prop, not `asChild`.
- Lucide icons (`lucide-react`)
- `cmdk`, `sonner` (toasts), `class-variance-authority`, `clsx`, `tailwind-merge`,
  `tw-animate-css`
- `react-resizable-panels` — the three-panel workspace shell
- `@dnd-kit/*` (core, sortable, modifiers, utilities) — Serial Binder and Buffer drag-and-drop

## Editor

- TipTap v3 (`@tiptap/core`, `react`, `starter-kit`, `extension-mention`, `suggestion`,
  `extensions`, `pm`) — pinned at 3.31.0

## Data layer

- **Prisma 7** (`@prisma/client`, `prisma` ^7.10.0) with a **custom driver adapter**
  (`@prisma/driver-adapter-utils`) wrapping Node 24's built-in `node:sqlite` —
  see `src/lib/db/node-sqlite-adapter.ts`. No `better-sqlite3` / `libsql` (no ARM64 Windows
  binaries).
- SQLite file at `prisma/dev.db`, URL resolved from `src/lib/db/database-url.ts`
  (`file:./prisma/dev.db`), used by both the app and `prisma7.config.ts`.
- DB client accessed only through `src/lib/db.ts` (server-only), dev-cached keyed by the
  generated `PrismaClient` constructor.

## Validation / actions

- `zod` (^4.5.4) validates server actions in `src/lib/actions/*` (`"use server"`).
- Actions return `ActionResult` (`src/lib/actions/result.ts`) instead of throwing.

## Dates

- `date-fns` ^4.4.0

## Dev tooling

- `tsx` — runs all `.ts` scripts (`scripts/*.ts`) since bare `next`/`prisma` CLI calls break
  in this folder (see Environment quirks)
- `eslint` ^9 + `eslint-config-next`
- `typescript` ^5, checked via `tsc --noEmit`

## Known environment quirks (Windows ARM64, folder name has `&`)

- npm's Windows `.cmd` shims break on the `&` in the folder path → every script invokes tools
  via `node node_modules/<pkg>/...` directly. Always use `npm run <script>`, never `npx`.
- No native SQLite module builds for Windows ARM64 → `node:sqlite` + custom adapter instead.
- Node may be missing from a shell's PATH; full path is `C:\Program Files\nodejs`.
- Running `npm run build` then `npm run dev` can poison `.next` (Turbopack postcss worker
  crash on `globals.css`, exit code `0xc0000409`). Fix: `rm -rf .next` and restart.
- Prisma CLI config is `prisma7.config.ts` (not `.env`-based); DB URL comes from
  `src/lib/db/database-url.ts`.
- `.claude/launch.json` runs `scripts/dev-server.mjs` via an absolute `node.exe` path for the
  in-app preview, since that shell's PATH may lack `node`.

## Common commands

| Task | Command |
| --- | --- |
| Dev server | `npm run dev` |
| Type check | `npm run typecheck` |
| Lint | `npm run lint` |
| Production build | `npm run build` |
| New migration | `npm run db:migrate -- --name <name>` |
| Seed demo novel | `npm run db:seed` |
| Reset database | `npm run db:reset` (stop dev server first) |
| Prisma Studio | `npm run db:studio` |
| DB smoke test | `npm run db:smoke` |
| Inspect DB (read-only) | `npm run db:inspect` |
| DB write timing | `npm run db:timing` |
| Export engine checks | `npm run export:check` |
| Rebuild palette CSS | `npm run theme:build` |
| Audit palettes/contrast | `npm run theme:check` |

## Architecture pointers for debugging

- `src/app/novels/[novelId]/layout.tsx` — three-panel shell (`WorkspaceShell`), `force-dynamic`
- `@panel` parallel route slot — right-hand Command Center / Codex / Buffer
- `src/lib/binder/tree.ts` — pure tree logic shared by server + client drag-and-drop
- `src/components/workspace/live-chapter.tsx` — module-level store (`useSyncExternalStore`)
  for live word counts, not React context (survives `revalidatePath` re-renders)
- `src/lib/export/` — pure, dependency-free export engine (HTML/Markdown)
- `src/lib/theme/palettes.ts` — single source of truth for all colour tokens; generates
  `src/app/palettes.css` via `scripts/build-theme-css.ts`. Never edit the generated CSS or put
  a hex value in `globals.css` / any `.tsx`.
- `ChapterSnapshot` + `src/lib/data/snapshots.ts` — autosave version-history safety net
