/**
 * Single source of truth for the Postgres connection string.
 *
 * Both functions read `process.env.DATABASE_URL` live on every call rather than capturing it
 * once at module load. That matters here specifically: Next.js loads `.env` into `process.env`
 * before any app code runs, but nothing else in this project does — `prisma7.config.ts` and
 * every standalone `npm run db:*` script call `process.loadEnvFile(".env")` themselves, and a
 * frozen `export const DATABASE_URL = process.env.DATABASE_URL ?? ""` would have captured
 * `undefined` at the moment `database-url.ts` was first imported, which (thanks to how ES
 * module imports are evaluated before the rest of the importing file's own code) is generally
 * *before* that file's own `loadEnvFile` call gets to run.
 *
 * There is no local default the way there was for the SQLite file this replaced — a Postgres
 * URL names a real server, so there is nothing sensible to fall back to.
 */
export function getDatabaseUrl(): string {
  return process.env.DATABASE_URL ?? "";
}

/**
 * `generate` never opens a connection and has to keep working with no `.env` at all (exactly
 * as it did before this app needed a real database), so only callers that actually connect —
 * `src/lib/db.ts`, every `npm run db:*` script — reach for this instead of `getDatabaseUrl`.
 */
export function requireDatabaseUrl(): string {
  const url = getDatabaseUrl();
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Copy a Postgres connection string into .env (see .env.example).",
    );
  }
  return url;
}
