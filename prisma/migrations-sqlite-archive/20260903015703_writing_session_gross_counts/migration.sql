-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_WritingSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "day" TEXT NOT NULL,
    "wordsWritten" INTEGER NOT NULL DEFAULT 0,
    "wordsAdded" INTEGER NOT NULL DEFAULT 0,
    "wordsRemoved" INTEGER NOT NULL DEFAULT 0,
    "streakCount" INTEGER NOT NULL DEFAULT 0,
    "goalMet" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_WritingSession" ("createdAt", "day", "goalMet", "id", "streakCount", "updatedAt", "wordsWritten") SELECT "createdAt", "day", "goalMet", "id", "streakCount", "updatedAt", "wordsWritten" FROM "WritingSession";
DROP TABLE "WritingSession";
ALTER TABLE "new_WritingSession" RENAME TO "WritingSession";
CREATE UNIQUE INDEX "WritingSession_day_key" ON "WritingSession"("day");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
