/**
 * Times a few small writes against the live database while the dev server is running.
 * Diagnoses lock contention (OneDrive, stray connections, unfinished statements).
 * Run: node node_modules/tsx/dist/cli.mjs scripts/db-write-timing.ts
 */
import { PrismaClient } from "../src/generated/prisma/client";
import { DATABASE_URL } from "../src/lib/db/database-url";
import { PrismaNodeSqlite } from "../src/lib/db/node-sqlite-adapter";

const prisma = new PrismaClient({ adapter: new PrismaNodeSqlite({ url: DATABASE_URL }) });

async function main() {
  const chapter = await prisma.chapter.findFirst({ select: { id: true, title: true } });
  if (!chapter) throw new Error("No chapters in the database.");
  const mode = await prisma.$queryRawUnsafe<{ journal_mode: string }[]>("PRAGMA journal_mode");
  console.log("journal_mode:", mode[0]?.journal_mode);

  for (let i = 0; i < 3; i++) {
    const started = performance.now();
    await prisma.chapter.update({ where: { id: chapter.id }, data: { title: chapter.title } });
    console.log(`update ${i + 1}: ${(performance.now() - started).toFixed(0)}ms`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
