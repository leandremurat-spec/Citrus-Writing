/**
 * Deletes every novel whose title matches the argument exactly (cascades to all its content).
 * There is no delete-novel button in the UI yet, so this is the maintenance path.
 * Run: npm run db:delete-novel -- "Exact Title"
 */
import { PrismaClient } from "../src/generated/prisma/client";
import { DATABASE_URL } from "../src/lib/db/database-url";
import { PrismaNodeSqlite } from "../src/lib/db/node-sqlite-adapter";

const prisma = new PrismaClient({ adapter: new PrismaNodeSqlite({ url: DATABASE_URL }) });

async function main() {
  const title = process.argv[2];
  if (!title) throw new Error('Usage: npm run db:delete-novel -- "Exact Title"');
  const result = await prisma.novel.deleteMany({ where: { title } });
  console.log(`Deleted ${result.count} novel(s) titled "${title}".`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
