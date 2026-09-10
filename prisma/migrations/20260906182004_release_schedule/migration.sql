-- AlterTable
ALTER TABLE "Chapter" ADD COLUMN "scheduledFor" DATETIME;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Novel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "cadenceFrequency" TEXT NOT NULL DEFAULT 'WEEKLY',
    "cadenceWeekdays" TEXT NOT NULL DEFAULT '6',
    "cadenceTime" TEXT NOT NULL DEFAULT '09:00',
    "cadenceTargetWeeks" INTEGER NOT NULL DEFAULT 3,
    "cadenceAnchor" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Novel" ("createdAt", "description", "id", "title", "updatedAt") SELECT "createdAt", "description", "id", "title", "updatedAt" FROM "Novel";
DROP TABLE "Novel";
ALTER TABLE "new_Novel" RENAME TO "Novel";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Chapter_novelId_scheduledFor_idx" ON "Chapter"("novelId", "scheduledFor");
