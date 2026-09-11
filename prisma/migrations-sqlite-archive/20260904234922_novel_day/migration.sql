-- CreateTable
CREATE TABLE "NovelDay" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "novelId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "wordsWritten" INTEGER NOT NULL DEFAULT 0,
    "wordsAdded" INTEGER NOT NULL DEFAULT 0,
    "wordsRemoved" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "NovelDay_novelId_fkey" FOREIGN KEY ("novelId") REFERENCES "Novel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "NovelDay_day_idx" ON "NovelDay"("day");

-- CreateIndex
CREATE UNIQUE INDEX "NovelDay_novelId_day_key" ON "NovelDay"("novelId", "day");
