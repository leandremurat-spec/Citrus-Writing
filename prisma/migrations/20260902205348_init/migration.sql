-- CreateTable
CREATE TABLE "Novel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Volume" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "novelId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Volume_novelId_fkey" FOREIGN KEY ("novelId") REFERENCES "Novel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Arc" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "novelId" TEXT NOT NULL,
    "volumeId" TEXT,
    "title" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Arc_novelId_fkey" FOREIGN KEY ("novelId") REFERENCES "Novel" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Arc_volumeId_fkey" FOREIGN KEY ("volumeId") REFERENCES "Volume" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Chapter" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "novelId" TEXT NOT NULL,
    "volumeId" TEXT,
    "arcId" TEXT,
    "title" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "content" TEXT NOT NULL DEFAULT '',
    "wordCount" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "publishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Chapter_novelId_fkey" FOREIGN KEY ("novelId") REFERENCES "Novel" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Chapter_volumeId_fkey" FOREIGN KEY ("volumeId") REFERENCES "Volume" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Chapter_arcId_fkey" FOREIGN KEY ("arcId") REFERENCES "Arc" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CodexEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "novelId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'CHARACTER',
    "summary" TEXT,
    "description" TEXT,
    "avatarUrl" TEXT,
    "aliases" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CodexEntry_novelId_fkey" FOREIGN KEY ("novelId") REFERENCES "Novel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChapterCodex" (
    "chapterId" TEXT NOT NULL,
    "codexEntryId" TEXT NOT NULL,
    "mentionCount" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("chapterId", "codexEntryId"),
    CONSTRAINT "ChapterCodex_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChapterCodex_codexEntryId_fkey" FOREIGN KEY ("codexEntryId") REFERENCES "CodexEntry" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WritingSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "day" TEXT NOT NULL,
    "wordsWritten" INTEGER NOT NULL DEFAULT 0,
    "streakCount" INTEGER NOT NULL DEFAULT 0,
    "goalMet" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AuthorSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "dailyGoal" INTEGER NOT NULL DEFAULT 1000,
    "sweetSpotMin" INTEGER NOT NULL DEFAULT 1500,
    "sweetSpotMax" INTEGER NOT NULL DEFAULT 2500,
    "exportProfile" TEXT NOT NULL DEFAULT 'royalroad',
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "Volume_novelId_order_idx" ON "Volume"("novelId", "order");

-- CreateIndex
CREATE INDEX "Arc_novelId_volumeId_order_idx" ON "Arc"("novelId", "volumeId", "order");

-- CreateIndex
CREATE INDEX "Chapter_novelId_volumeId_arcId_order_idx" ON "Chapter"("novelId", "volumeId", "arcId", "order");

-- CreateIndex
CREATE INDEX "Chapter_novelId_status_idx" ON "Chapter"("novelId", "status");

-- CreateIndex
CREATE INDEX "CodexEntry_novelId_category_idx" ON "CodexEntry"("novelId", "category");

-- CreateIndex
CREATE INDEX "CodexEntry_novelId_name_idx" ON "CodexEntry"("novelId", "name");

-- CreateIndex
CREATE INDEX "ChapterCodex_codexEntryId_idx" ON "ChapterCodex"("codexEntryId");

-- CreateIndex
CREATE UNIQUE INDEX "WritingSession_day_key" ON "WritingSession"("day");
