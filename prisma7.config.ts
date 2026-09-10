import { defineConfig } from "prisma/config";

import { DATABASE_URL } from "./src/lib/db/database-url.ts";

// The Prisma CLI does not load .env; the app and the CLI share one default in database-url.ts.
// CLIs are invoked through node directly because the folder name contains "&", which breaks
// npm's Windows .cmd shims (see package.json scripts).
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "node node_modules/tsx/dist/cli.mjs prisma/seed.ts",
  },
  datasource: {
    url: DATABASE_URL,
  },
});
