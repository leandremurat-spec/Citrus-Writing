import { defineConfig } from "prisma/config";

import { getDatabaseUrl } from "./src/lib/db/database-url.ts";

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
    url: getDatabaseUrl(),
  },
});
