import "server-only";

import { PrismaClient } from "@/generated/prisma/client";
import { DATABASE_URL } from "@/lib/db/database-url";
import { PrismaNodeSqlite } from "@/lib/db/node-sqlite-adapter";

/**
 * App-wide Prisma client.
 *
 * In development the instance is cached on `globalThis` so hot reloads reuse one SQLite
 * connection. The cache is keyed by the generated `PrismaClient` constructor: after
 * `prisma generate` rewrites `src/generated/prisma`, the module is re-evaluated with a new
 * constructor, the stale client (which knows nothing about new columns) is dropped, and a
 * fresh one is built. No dev-server restart needed after a migration.
 */
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaCtor?: typeof PrismaClient;
};

function createPrismaClient() {
  const adapter = new PrismaNodeSqlite({ url: DATABASE_URL });
  return new PrismaClient({ adapter });
}

function getPrismaClient(): PrismaClient {
  if (process.env.NODE_ENV === "production") return createPrismaClient();

  if (globalForPrisma.prisma && globalForPrisma.prismaCtor === PrismaClient) {
    return globalForPrisma.prisma;
  }
  void globalForPrisma.prisma?.$disconnect();
  const client = createPrismaClient();
  globalForPrisma.prisma = client;
  globalForPrisma.prismaCtor = PrismaClient;
  return client;
}

export const prisma = getPrismaClient();
