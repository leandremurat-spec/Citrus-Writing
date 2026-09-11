-- AlterTable
ALTER TABLE "CodexEntry" ADD COLUMN "sheetFields" TEXT;

-- CreateTable
CREATE TABLE "CodexTie" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "novelId" TEXT NOT NULL,
    "fromEntryId" TEXT NOT NULL,
    "toEntryId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CodexTie_novelId_fkey" FOREIGN KEY ("novelId") REFERENCES "Novel" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CodexTie_fromEntryId_fkey" FOREIGN KEY ("fromEntryId") REFERENCES "CodexEntry" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CodexTie_toEntryId_fkey" FOREIGN KEY ("toEntryId") REFERENCES "CodexEntry" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "CodexTie_fromEntryId_order_idx" ON "CodexTie"("fromEntryId", "order");

-- CreateIndex
CREATE INDEX "CodexTie_toEntryId_idx" ON "CodexTie"("toEntryId");
