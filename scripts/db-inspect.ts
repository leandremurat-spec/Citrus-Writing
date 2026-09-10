/** Read-only look at novels, chapters, and writing sessions. Run: npm run db:inspect */
import { PrismaClient } from "../src/generated/prisma/client";
import { DATABASE_URL } from "../src/lib/db/database-url";
import { PrismaNodeSqlite } from "../src/lib/db/node-sqlite-adapter";
import { docToPlainText, parseDoc } from "../src/lib/editor/word-count";

const prisma = new PrismaClient({ adapter: new PrismaNodeSqlite({ url: DATABASE_URL }) });

async function main() {
  const novels = await prisma.novel.findMany({
    select: {
      id: true,
      title: true,
      chapters: {
        select: { id: true, title: true, wordCount: true, content: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  for (const novel of novels) {
    console.log(`\n=== ${novel.title} (${novel.id}) ===`);
    for (const chapter of novel.chapters) {
      const doc = parseDoc(chapter.content);
      const preview = doc ? docToPlainText(doc).replace(/\s+/g, " ").slice(0, 70) : "(unparseable)";
      console.log(
        `${String(chapter.wordCount).padStart(6)}w ${String(chapter.content.length).padStart(7)}c ` +
          `${chapter.updatedAt.toISOString().slice(5, 19)} | ${chapter.title}`,
      );
      console.log(`         "${preview}"`);
    }
  }

  const sessions = await prisma.writingSession.findMany({ orderBy: { day: "asc" } });
  console.log("\nwriting sessions:");
  for (const s of sessions) {
    console.log(`  ${s.day}  net ${s.wordsWritten}  +${s.wordsAdded} -${s.wordsRemoved}  streak ${s.streakCount}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
