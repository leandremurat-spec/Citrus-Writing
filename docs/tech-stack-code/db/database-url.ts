/**
 * Single source of truth for where the SQLite file lives.
 * Relative `file:` URLs resolve against the project root (the working directory of
 * `next dev`, `next build`, and every `npm run db:*` script).
 */
export const DEFAULT_DATABASE_URL = "file:./prisma/dev.db";

export const DATABASE_URL = process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL;
