/**
 * Demo content so every panel has something to show on first run.
 * Safe to re-run: it replaces only the demo novel, never other novels, and it only creates
 * writing sessions when none exist yet (set SEED_FRESH_SESSIONS=1 to replace them with the demo
 * history). Run via `npm run db:seed` (also part of `npm run db:reset`).
 */
import { format, subDays } from "date-fns";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";
import { requireDatabaseUrl } from "../src/lib/db/database-url";
import { hashPassword } from "../src/lib/auth/password";
import { mentionsInDoc } from "../src/lib/editor/mentions";
import { countWordsInDoc } from "../src/lib/editor/word-count";

try {
  process.loadEnvFile(".env");
} catch {
  // No .env at all — requireDatabaseUrl() below will report it clearly.
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: requireDatabaseUrl() }) });

const DEMO_TITLE = "The Lantern Tide";

/*
 * The demo account everything below belongs to.
 *
 * Novels hang off a user now, so the seed needs one to hang them from. It is a real account
 * with a real password hash — sign in with these and the demo is simply your library — and it
 * starts on Serial because the seeded release schedule and pace history are Serial features;
 * a demo whose most distinctive screen is locked demonstrates nothing. Downgrade from
 * Settings to see the Drawer experience.
 */
const DEMO_EMAIL = (process.env.SEED_EMAIL ?? "demo@citruswriting.app").trim().toLowerCase();
const DEMO_PASSWORD = process.env.SEED_PASSWORD ?? "lantern-tide-demo";
const DEMO_PEN_NAME = process.env.SEED_PEN_NAME ?? "The Lamplighter";

// ---------- tiny TipTap document builders ----------

type Mention = { id: string; label: string };
type Inline = string | Mention;
type DocNode = { type: string; attrs?: Record<string, unknown>; content?: DocNode[]; text?: string };

function p(...parts: Inline[]): DocNode {
  return {
    type: "paragraph",
    content: parts.map((part) =>
      typeof part === "string"
        ? { type: "text", text: part }
        : { type: "mention", attrs: { id: part.id, label: part.label } },
    ),
  };
}

function doc(...nodes: DocNode[]): DocNode {
  return { type: "doc", content: nodes };
}

// ---------- seed ----------

async function main() {
  // The demo writer. Upserted rather than created, so re-running the seed keeps the same
  // account (and the same sessions) instead of orphaning the one you are signed in as.
  const author = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: {},
    create: {
      email: DEMO_EMAIL,
      penName: DEMO_PEN_NAME,
      passwordHash: await hashPassword(DEMO_PASSWORD),
      plan: "SERIAL",
      planStatus: "ACTIVE",
    },
    select: { id: true },
  });

  // Only the demo novel is replaced, and only this author's — anything else is left alone.
  await prisma.novel.deleteMany({ where: { title: DEMO_TITLE, userId: author.id } });

  await prisma.authorSettings.upsert({
    where: { userId: author.id },
    update: {},
    create: { userId: author.id },
  });

  const novel = await prisma.novel.create({
    data: {
      userId: author.id,
      title: DEMO_TITLE,
      description:
        "A lamplighter inherits the last flame of a drowned city, and the sea wants it back.",
    },
  });

  // Codex first, so chapter text can reference entry ids.
  const wren = await prisma.codexEntry.create({
    data: {
      novelId: novel.id,
      name: "Wren Ashcombe",
      category: "CHARACTER",
      summary: "Lamplighter of the Ninth Pier. Keeper, unwillingly, of the last lantern.",
      description:
        "Nineteen, stubborn, and better with knots than with people. Wren took the lamplighter post after her mother vanished on a low-tide walk. She counts steps when she is frightened.",
      aliases: "Wren, the lamplighter",
    },
  });
  const idris = await prisma.codexEntry.create({
    data: {
      novelId: novel.id,
      name: "Idris Vale",
      category: "CHARACTER",
      summary: "Retired tide-warden. Reluctant mentor to Wren.",
      description:
        "Once commanded the warden boats that kept the sea-gates of Saltmarrow. Now mends nets, drinks too much, and knows exactly what the lantern is.",
      aliases: "the Warden, Vale",
    },
  });
  const saltmarrow = await prisma.codexEntry.create({
    data: {
      novelId: novel.id,
      name: "Saltmarrow",
      category: "LOCATION",
      summary: "A drowned harbor city that surfaces for one hour at the lowest tide.",
      description:
        "Its bell towers still ring when the water drains. Nobody agrees on who rings them.",
    },
  });
  const lantern = await prisma.codexEntry.create({
    data: {
      novelId: novel.id,
      name: "The Cinder Lantern",
      category: "ITEM",
      summary: "A brass lantern whose flame burns underwater.",
      description:
        "Heavier than it should be. The flame leans toward whoever last lied in its light.",
      aliases: "the lantern",
    },
  });

  const m = (entry: { id: string; name: string }, label = entry.name): Mention => ({
    id: entry.id,
    label,
  });

  // ----- Structure -----
  // Novel root: Prologue (order 0), Volume 1 (order 1)
  // Volume 1:   Arc "Embers on the Pier" (0), Interlude chapter (1), Arc "Salt and Signal" (2)

  const volume = await prisma.volume.create({
    data: { novelId: novel.id, title: "Volume 1: Low Water", order: 1 },
  });
  const arcEmbers = await prisma.arc.create({
    data: { novelId: novel.id, volumeId: volume.id, title: "Arc 1: Embers on the Pier", order: 0 },
  });
  const arcSignal = await prisma.arc.create({
    data: { novelId: novel.id, volumeId: volume.id, title: "Arc 2: Salt and Signal", order: 2 },
  });

  const chapters: Array<{
    title: string;
    order: number;
    status: "DRAFT" | "EDITED" | "QUEUED" | "PUBLISHED";
    volumeId?: string;
    arcId?: string;
    notes?: string;
    body: DocNode;
    publishedDaysAgo?: number;
  }> = [
    {
      title: "Prologue: The Night the Sea Forgot",
      order: 0,
      status: "EDITED",
      notes: "Keep this under 800 words. It is a hook, not a history lesson.",
      body: doc(
        p(
          "The bells of ",
          m(saltmarrow),
          " rang at midnight, which was impossible, because the city had been underwater for sixty years.",
        ),
        p("Every lamplighter on the coast heard them. Most rolled over. One did not."),
      ),
    },
    {
      title: "Chapter 1: Lamplighter's Hour",
      order: 0,
      status: "PUBLISHED",
      arcId: arcEmbers.id,
      publishedDaysAgo: 14,
      body: doc(
        p(
          m(wren),
          " counted the steps to the end of the Ninth Pier because counting was easier than thinking about what waited there.",
        ),
        p(
          "Two hundred and twelve. The same as every night. The lamp post stood where it always stood, salt-bitten and leaning, and the lantern hanging from it was not hers.",
        ),
        p(
          "Hers was tin. This one was brass, and the glass was warm, and the flame inside it burned a steady blue that did not move when the wind did.",
        ),
        p(
          "She should have left it. Every story she had ever been told about the drowned city started with someone who should have left something alone.",
        ),
        p("She lifted it off the hook."),
      ),
    },
    {
      title: "Chapter 2: What the Tide Returns",
      order: 1,
      status: "PUBLISHED",
      arcId: arcEmbers.id,
      publishedDaysAgo: 7,
      body: doc(
        p(
          "The ledger of the harbor master listed every object the sea had given back in sixty years. Rope. Bottles. A church door. Never anything that burned.",
        ),
        p(
          m(wren),
          " read the ledger twice while ",
          m(lantern, "the lantern"),
          " sat on the table between them, humming faintly, like a kettle deciding whether to boil.",
        ),
        p(
          "“You will want the Warden,” the harbor master said at last, not looking at it. “And you will want to go before the tide turns.”",
        ),
      ),
    },
    {
      title: "Chapter 3: The Warden's Bargain",
      order: 2,
      status: "EDITED",
      arcId: arcEmbers.id,
      notes: "Idris should refuse twice before he agrees. The third refusal is the real one.",
      body: doc(
        p(
          m(idris),
          " lived at the wrong end of the seawall, where the wind came straight off the drowned city and nothing grew.",
        ),
        p("He looked at the lantern for a long time. Then he looked at ", m(wren), ", which was worse."),
        p("“Put it back,” he said. “Tonight. Before it learns your name.”"),
        p("“It already knows,” she said. “It said it.”"),
      ),
    },
    {
      title: "Interlude: The Warden's Ledger",
      order: 1,
      status: "DRAFT",
      volumeId: volume.id,
      notes: "A found-document chapter. Short. Sits between the two arcs.",
      body: doc(
        p("Entry, seventh low tide of the season. Gate three held. Gate four did not."),
        p("Entry, eighth low tide. The bells again. I have stopped writing down who I think rings them."),
      ),
    },
    {
      title: "Chapter 4: Beneath the Ninth Pier",
      order: 0,
      status: "QUEUED",
      arcId: arcSignal.id,
      body: doc(
        p(
          "At the lowest tide of the year the water drew back from ",
          m(saltmarrow),
          " like a held breath, and the streets came up black and shining.",
        ),
        p(
          m(wren),
          " went down the pier ladder with the lantern hooked to her belt. ",
          m(idris),
          " followed, cursing every rung.",
        ),
        p("The flame turned green the moment her boots touched the drowned cobbles. Neither of them mentioned it."),
      ),
    },
    {
      title: "Chapter 5: A Name for the Dark",
      order: 1,
      status: "DRAFT",
      arcId: arcSignal.id,
      notes: "Outline only. Wren finds the bell tower. Someone is already there.",
      body: doc(p("The bell tower was not empty.")),
    },
  ];

  for (const chapter of chapters) {
    const created = await prisma.chapter.create({
      data: {
        novelId: novel.id,
        volumeId: chapter.volumeId,
        arcId: chapter.arcId,
        title: chapter.title,
        order: chapter.order,
        status: chapter.status,
        notes: chapter.notes,
        content: JSON.stringify(chapter.body),
        wordCount: countWordsInDoc(chapter.body),
        publishedAt:
          chapter.publishedDaysAgo !== undefined ? subDays(new Date(), chapter.publishedDaysAgo) : null,
      },
    });

    for (const [codexEntryId, mentionCount] of mentionsInDoc(chapter.body)) {
      await prisma.chapterCodex.create({
        data: { chapterId: created.id, codexEntryId, mentionCount },
      });
    }
  }

  // Five consecutive writing days ending today, so the streak counter has something to show.
  // Only when no sessions exist yet: a real writing history is never overwritten unless the
  // author explicitly asks for demo history with SEED_FRESH_SESSIONS=1.
  if (process.env.SEED_FRESH_SESSIONS === "1") {
    await prisma.writingSession.deleteMany({ where: { userId: author.id } });
    // The demo novel is recreated on every run, which cascades its own NovelDay rows away;
    // this clears any left by an *earlier* demo novel so the two histories cannot double up.
    await prisma.novelDay.deleteMany();
  }
  const history =
    (await prisma.writingSession.count({ where: { userId: author.id } })) === 0
      ? [
          { added: 910, removed: 90 },
          { added: 1640, removed: 210 },
          { added: 750, removed: 140 },
          { added: 1280, removed: 160 },
          { added: 400, removed: 60 },
        ]
      : [];
  for (let i = 0; i < history.length; i++) {
    const { added, removed } = history[i];
    const net = added - removed;
    const daysAgo = history.length - 1 - i;
    const day = format(subDays(new Date(), daysAgo), "yyyy-MM-dd");
    await prisma.writingSession.create({
      data: {
        userId: author.id,
        day,
        wordsWritten: net,
        wordsAdded: added,
        wordsRemoved: removed,
        streakCount: i + 1,
        goalMet: net >= 1000,
      },
    });
    /*
     * The same day, attributed to the demo novel.
     *
     * `recordWriting` always writes both rows, so a history with only the cross-novel one is
     * a shape the app itself never produces — and the two surfaces that read them disagreed
     * about the same five days: the Progress panel showed the streak off WritingSession while
     * the Buffer's Pace chart, which reads NovelDay, drew every one of those weeks as zero.
     */
    await prisma.novelDay.create({
      data: { novelId: novel.id, day, wordsWritten: net, wordsAdded: added, wordsRemoved: removed },
    });
  }

  const counts = {
    signIn: DEMO_EMAIL + " / " + DEMO_PASSWORD,
    chapters: await prisma.chapter.count(),
    codexEntries: await prisma.codexEntry.count(),
    mentionLinks: await prisma.chapterCodex.count(),
    sessions: await prisma.writingSession.count(),
    novelDays: await prisma.novelDay.count(),
  };
  console.log("Seeded demo novel:", counts);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
