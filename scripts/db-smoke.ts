/**
 * End-to-end check of the Prisma client + Postgres adapter against the seeded database.
 * Run: node node_modules/tsx/dist/cli.mjs scripts/db-smoke.ts
 */
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";
import { requireDatabaseUrl } from "../src/lib/db/database-url";

try {
  process.loadEnvFile(".env");
} catch {
  // No .env at all — requireDatabaseUrl() below will report it clearly.
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: requireDatabaseUrl() }) });

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`SMOKE FAIL: ${message}`);
}

async function main() {
  // 1. Nested reads across the whole hierarchy
  const novel = await prisma.novel.findFirstOrThrow({
    include: {
      volumes: {
        include: {
          arcs: { include: { chapters: { orderBy: { order: "asc" } } }, orderBy: { order: "asc" } },
          chapters: { where: { arcId: null } },
        },
      },
      chapters: { where: { arcId: null, volumeId: null } },
      codexEntries: true,
    },
  });
  // Everything below belongs to whoever owns the seeded novel: since accounts landed, there
  // is no such thing as an unowned settings row or writing day to check against.
  const userId = novel.userId;
  console.log(
    `novel "${novel.title}" | root chapters: ${novel.chapters.length} | volumes: ${novel.volumes.length} | codex: ${novel.codexEntries.length}`,
  );
  assert(novel.chapters.length === 1, "one chapter at the novel root");
  assert(novel.volumes[0].arcs.length === 2, "two arcs in volume 1");
  assert(novel.volumes[0].chapters.length === 1, "one loose chapter in volume 1");
  assert(novel.volumes[0].arcs[0].chapters.length === 3, "three chapters in arc 1");

  // 2. DateTime round trip
  const published = await prisma.chapter.findFirst({
    where: { status: "PUBLISHED" },
    orderBy: { publishedAt: "asc" },
  });
  assert(published?.publishedAt instanceof Date, "publishedAt comes back as a Date");
  assert(published.createdAt instanceof Date, "createdAt comes back as a Date");

  // 3. Enum + boolean round trip
  assert(published.status === "PUBLISHED", "enum value round trips");
  const session = await prisma.writingSession.findFirst({ where: { goalMet: true } });
  assert(session && session.goalMet === true, "boolean round trips");

  // 4. Aggregates and raw SQL (exercises inferred column types for expressions)
  const agg = await prisma.chapter.aggregate({ _sum: { wordCount: true }, _count: true });
  const raw = await prisma.$queryRaw<Array<{ n: number | bigint; total: number | bigint }>>`
    SELECT COUNT(*) AS n, SUM("wordCount") AS total FROM "Chapter"`;
  assert(Number(raw[0].n) === agg._count, "raw COUNT matches aggregate count");
  assert(Number(raw[0].total) === agg._sum.wordCount, "raw SUM matches aggregate sum");
  console.log(`chapters: ${agg._count} | total words: ${agg._sum.wordCount}`);

  // 5. Interactive transaction rollback
  const before = await prisma.codexEntry.count();
  await prisma
    .$transaction(async (tx) => {
      await tx.codexEntry.create({ data: { novelId: novel.id, name: "Rollback Me", category: "ITEM" } });
      throw new Error("rollback on purpose");
    })
    .catch((error: Error) => {
      if (!error.message.includes("rollback on purpose")) throw error;
    });
  assert((await prisma.codexEntry.count()) === before, "transaction rolled back");

  // 6. Interactive transaction commit (two writes, one transaction)
  await prisma.$transaction(async (tx) => {
    const updated = await tx.authorSettings.update({ where: { userId }, data: { dailyGoal: 1200 } });
    assert(updated.dailyGoal === 1200, "update inside transaction is visible to the transaction");
    await tx.authorSettings.update({ where: { userId }, data: { dailyGoal: 1000 } });
  });
  const settings = await prisma.authorSettings.findUniqueOrThrow({ where: { userId } });
  assert(settings.dailyGoal === 1000, "transaction committed");

  // 7. Unique violation surfaces as Prisma's P2002
  let code: string | undefined;
  try {
    // The unique key is [userId, day] now, so a duplicate has to repeat both.
    await prisma.writingSession.create({ data: { userId: session.userId, day: session.day } });
  } catch (error) {
    code = (error as { code?: string }).code;
  }
  assert(code === "P2002", `unique violation maps to P2002 (got ${code})`);

  // 8. Foreign keys are enforced and SetNull releases chapters when an arc is deleted
  const tempArc = await prisma.arc.create({ data: { novelId: novel.id, title: "Temp Arc", order: 99 } });
  const tempChapter = await prisma.chapter.create({
    data: { novelId: novel.id, arcId: tempArc.id, title: "Temp Chapter", order: 0 },
  });
  await prisma.arc.delete({ where: { id: tempArc.id } });
  const released = await prisma.chapter.findUniqueOrThrow({ where: { id: tempChapter.id } });
  assert(released.arcId === null, "deleting an arc releases its chapters (ON DELETE SET NULL)");
  await prisma.chapter.delete({ where: { id: tempChapter.id } });

  let fkCode: string | undefined;
  try {
    await prisma.chapter.create({ data: { novelId: "does-not-exist", title: "Orphan", order: 0 } });
  } catch (error) {
    fkCode = (error as { code?: string }).code;
  }
  assert(fkCode === "P2003", `foreign key violation maps to P2003 (got ${fkCode})`);

  console.log("SMOKE OK");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
