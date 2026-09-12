import { defineConfig } from "prisma/config";

import { getDirectDatabaseUrl } from "./src/lib/db/database-url.ts";

// The Prisma CLI does not load .env on its own, so this loads it explicitly — before reading
// DATABASE_URL, since that read has to happen after .env is in process.env, not before.
try {
  process.loadEnvFile(".env");
} catch {
  // No .env at all is fine for commands that never open a connection (e.g. `generate`).
}

// CLIs are invoked through node directly because the folder name contains "&", which breaks
// npm's Windows .cmd shims (see package.json scripts).
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "node node_modules/tsx/dist/cli.mjs prisma/seed.ts",
  },
  datasource: {
    /*
     * The session-mode connection, not the pooled one the app uses — and for the whole config,
     * not just migrations.
     *
     * `directUrl` is not a key this config honours; setting it alongside `url` changes nothing
     * and `migrate` goes on hanging. Pointing `url` itself at session mode is the fix, and it
     * is safe because **nothing but the Prisma CLI reads this file**. The app builds its own
     * client in `src/lib/db.ts`, and every `db:*` script builds its own too, all from
     * `requireDatabaseUrl()` — so the transaction pooler still serves every query the product
     * actually makes. This only moves `migrate`, `studio` and `db seed` onto a connection that
     * can hold a session lock.
     */
    url: getDirectDatabaseUrl(),
  },
});
