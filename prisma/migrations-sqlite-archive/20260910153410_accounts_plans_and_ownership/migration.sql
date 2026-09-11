/*
  Warnings:

  - The primary key for the `AuthorSettings` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `AuthorSettings` table. All the data in the column will be lost.
  - Added the required column `userId` to the `AuthorSettings` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `Novel` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `WritingSession` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "penName" TEXT NOT NULL,
    "passwordHash" TEXT,
    "notifyStale" BOOLEAN NOT NULL DEFAULT false,
    "plan" TEXT NOT NULL DEFAULT 'DRAWER',
    "planStatus" TEXT NOT NULL DEFAULT 'NONE',
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "planRenewsAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OAuthAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OAuthAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AuthorSettings" (
    "userId" TEXT NOT NULL PRIMARY KEY,
    "dailyGoal" INTEGER NOT NULL DEFAULT 1000,
    "sweetSpotMin" INTEGER NOT NULL DEFAULT 1500,
    "sweetSpotMax" INTEGER NOT NULL DEFAULT 2500,
    "exportProfile" TEXT NOT NULL DEFAULT 'royalroad',
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AuthorSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_AuthorSettings" ("dailyGoal", "exportProfile", "sweetSpotMax", "sweetSpotMin", "updatedAt") SELECT "dailyGoal", "exportProfile", "sweetSpotMax", "sweetSpotMin", "updatedAt" FROM "AuthorSettings";
DROP TABLE "AuthorSettings";
ALTER TABLE "new_AuthorSettings" RENAME TO "AuthorSettings";
CREATE TABLE "new_Novel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "cadenceFrequency" TEXT NOT NULL DEFAULT 'WEEKLY',
    "cadenceWeekdays" TEXT NOT NULL DEFAULT '6',
    "cadenceTime" TEXT NOT NULL DEFAULT '09:00',
    "cadenceTimeSecond" TEXT NOT NULL DEFAULT '21:00',
    "cadenceTargetWeeks" INTEGER NOT NULL DEFAULT 3,
    "cadenceAnchor" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Novel_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Novel" ("cadenceAnchor", "cadenceFrequency", "cadenceTargetWeeks", "cadenceTime", "cadenceTimeSecond", "cadenceWeekdays", "createdAt", "description", "id", "title", "updatedAt") SELECT "cadenceAnchor", "cadenceFrequency", "cadenceTargetWeeks", "cadenceTime", "cadenceTimeSecond", "cadenceWeekdays", "createdAt", "description", "id", "title", "updatedAt" FROM "Novel";
DROP TABLE "Novel";
ALTER TABLE "new_Novel" RENAME TO "Novel";
CREATE INDEX "Novel_userId_createdAt_idx" ON "Novel"("userId", "createdAt");
CREATE TABLE "new_WritingSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "wordsWritten" INTEGER NOT NULL DEFAULT 0,
    "wordsAdded" INTEGER NOT NULL DEFAULT 0,
    "wordsRemoved" INTEGER NOT NULL DEFAULT 0,
    "streakCount" INTEGER NOT NULL DEFAULT 0,
    "goalMet" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WritingSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_WritingSession" ("createdAt", "day", "goalMet", "id", "streakCount", "updatedAt", "wordsAdded", "wordsRemoved", "wordsWritten") SELECT "createdAt", "day", "goalMet", "id", "streakCount", "updatedAt", "wordsAdded", "wordsRemoved", "wordsWritten" FROM "WritingSession";
DROP TABLE "WritingSession";
ALTER TABLE "new_WritingSession" RENAME TO "WritingSession";
CREATE INDEX "WritingSession_userId_idx" ON "WritingSession"("userId");
CREATE UNIQUE INDEX "WritingSession_userId_day_key" ON "WritingSession"("userId", "day");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_stripeCustomerId_key" ON "User"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "User_stripeSubscriptionId_key" ON "User"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "User_stripeCustomerId_idx" ON "User"("stripeCustomerId");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE INDEX "OAuthAccount_userId_idx" ON "OAuthAccount"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthAccount_provider_providerAccountId_key" ON "OAuthAccount"("provider", "providerAccountId");
