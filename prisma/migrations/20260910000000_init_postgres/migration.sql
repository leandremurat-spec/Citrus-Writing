-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ChapterStatus" AS ENUM ('DRAFT', 'EDITED', 'QUEUED', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "CadenceFrequency" AS ENUM ('FORTNIGHTLY', 'WEEKLY', 'TWICE_WEEKLY', 'THRICE_WEEKLY', 'DAILY', 'TWICE_DAILY');

-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('DRAWER', 'SERIAL');

-- CreateEnum
CREATE TYPE "PlanStatus" AS ENUM ('NONE', 'ACTIVE', 'PAST_DUE', 'CANCELED');

-- CreateEnum
CREATE TYPE "CodexCategory" AS ENUM ('CHARACTER', 'LOCATION', 'ITEM');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "penName" TEXT NOT NULL,
    "passwordHash" TEXT,
    "notifyStale" BOOLEAN NOT NULL DEFAULT false,
    "plan" "Plan" NOT NULL DEFAULT 'DRAWER',
    "planStatus" "PlanStatus" NOT NULL DEFAULT 'NONE',
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "planRenewsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordReset" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordReset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OAuthAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OAuthAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Novel" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "cadenceFrequency" "CadenceFrequency" NOT NULL DEFAULT 'WEEKLY',
    "cadenceWeekdays" TEXT NOT NULL DEFAULT '6',
    "cadenceTime" TEXT NOT NULL DEFAULT '09:00',
    "cadenceTimeSecond" TEXT NOT NULL DEFAULT '21:00',
    "cadenceTargetWeeks" INTEGER NOT NULL DEFAULT 3,
    "cadenceAnchor" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Novel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Volume" (
    "id" TEXT NOT NULL,
    "novelId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Volume_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Arc" (
    "id" TEXT NOT NULL,
    "novelId" TEXT NOT NULL,
    "volumeId" TEXT,
    "title" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Arc_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Chapter" (
    "id" TEXT NOT NULL,
    "novelId" TEXT NOT NULL,
    "volumeId" TEXT,
    "arcId" TEXT,
    "title" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "status" "ChapterStatus" NOT NULL DEFAULT 'DRAFT',
    "content" TEXT NOT NULL DEFAULT '',
    "wordCount" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "publishedAt" TIMESTAMP(3),
    "scheduledFor" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Chapter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CodexEntry" (
    "id" TEXT NOT NULL,
    "novelId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "CodexCategory" NOT NULL DEFAULT 'CHARACTER',
    "summary" TEXT,
    "description" TEXT,
    "avatarUrl" TEXT,
    "aliases" TEXT,
    "sheetFields" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CodexEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CodexTie" (
    "id" TEXT NOT NULL,
    "novelId" TEXT NOT NULL,
    "fromEntryId" TEXT NOT NULL,
    "toEntryId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CodexTie_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChapterCodex" (
    "chapterId" TEXT NOT NULL,
    "codexEntryId" TEXT NOT NULL,
    "mentionCount" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChapterCodex_pkey" PRIMARY KEY ("chapterId","codexEntryId")
);

-- CreateTable
CREATE TABLE "ChapterSnapshot" (
    "id" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "wordCount" INTEGER NOT NULL DEFAULT 0,
    "reason" TEXT NOT NULL DEFAULT 'periodic',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChapterSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NovelDay" (
    "id" TEXT NOT NULL,
    "novelId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "wordsWritten" INTEGER NOT NULL DEFAULT 0,
    "wordsAdded" INTEGER NOT NULL DEFAULT 0,
    "wordsRemoved" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NovelDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WritingSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "wordsWritten" INTEGER NOT NULL DEFAULT 0,
    "wordsAdded" INTEGER NOT NULL DEFAULT 0,
    "wordsRemoved" INTEGER NOT NULL DEFAULT 0,
    "streakCount" INTEGER NOT NULL DEFAULT 0,
    "goalMet" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WritingSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthorSettings" (
    "userId" TEXT NOT NULL,
    "dailyGoal" INTEGER NOT NULL DEFAULT 1000,
    "sweetSpotMin" INTEGER NOT NULL DEFAULT 1500,
    "sweetSpotMax" INTEGER NOT NULL DEFAULT 2500,
    "exportProfile" TEXT NOT NULL DEFAULT 'royalroad',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthorSettings_pkey" PRIMARY KEY ("userId")
);

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
CREATE INDEX "PasswordReset_userId_idx" ON "PasswordReset"("userId");

-- CreateIndex
CREATE INDEX "PasswordReset_expiresAt_idx" ON "PasswordReset"("expiresAt");

-- CreateIndex
CREATE INDEX "OAuthAccount_userId_idx" ON "OAuthAccount"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthAccount_provider_providerAccountId_key" ON "OAuthAccount"("provider", "providerAccountId");

-- CreateIndex
CREATE INDEX "Novel_userId_createdAt_idx" ON "Novel"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Volume_novelId_order_idx" ON "Volume"("novelId", "order");

-- CreateIndex
CREATE INDEX "Arc_novelId_volumeId_order_idx" ON "Arc"("novelId", "volumeId", "order");

-- CreateIndex
CREATE INDEX "Chapter_novelId_volumeId_arcId_order_idx" ON "Chapter"("novelId", "volumeId", "arcId", "order");

-- CreateIndex
CREATE INDEX "Chapter_novelId_status_idx" ON "Chapter"("novelId", "status");

-- CreateIndex
CREATE INDEX "Chapter_novelId_scheduledFor_idx" ON "Chapter"("novelId", "scheduledFor");

-- CreateIndex
CREATE INDEX "CodexEntry_novelId_category_idx" ON "CodexEntry"("novelId", "category");

-- CreateIndex
CREATE INDEX "CodexEntry_novelId_name_idx" ON "CodexEntry"("novelId", "name");

-- CreateIndex
CREATE INDEX "CodexTie_fromEntryId_order_idx" ON "CodexTie"("fromEntryId", "order");

-- CreateIndex
CREATE INDEX "CodexTie_toEntryId_idx" ON "CodexTie"("toEntryId");

-- CreateIndex
CREATE INDEX "ChapterCodex_codexEntryId_idx" ON "ChapterCodex"("codexEntryId");

-- CreateIndex
CREATE INDEX "ChapterSnapshot_chapterId_createdAt_idx" ON "ChapterSnapshot"("chapterId", "createdAt");

-- CreateIndex
CREATE INDEX "NovelDay_day_idx" ON "NovelDay"("day");

-- CreateIndex
CREATE UNIQUE INDEX "NovelDay_novelId_day_key" ON "NovelDay"("novelId", "day");

-- CreateIndex
CREATE INDEX "WritingSession_userId_idx" ON "WritingSession"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "WritingSession_userId_day_key" ON "WritingSession"("userId", "day");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordReset" ADD CONSTRAINT "PasswordReset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthAccount" ADD CONSTRAINT "OAuthAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Novel" ADD CONSTRAINT "Novel_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Volume" ADD CONSTRAINT "Volume_novelId_fkey" FOREIGN KEY ("novelId") REFERENCES "Novel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Arc" ADD CONSTRAINT "Arc_novelId_fkey" FOREIGN KEY ("novelId") REFERENCES "Novel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Arc" ADD CONSTRAINT "Arc_volumeId_fkey" FOREIGN KEY ("volumeId") REFERENCES "Volume"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chapter" ADD CONSTRAINT "Chapter_novelId_fkey" FOREIGN KEY ("novelId") REFERENCES "Novel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chapter" ADD CONSTRAINT "Chapter_volumeId_fkey" FOREIGN KEY ("volumeId") REFERENCES "Volume"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chapter" ADD CONSTRAINT "Chapter_arcId_fkey" FOREIGN KEY ("arcId") REFERENCES "Arc"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CodexEntry" ADD CONSTRAINT "CodexEntry_novelId_fkey" FOREIGN KEY ("novelId") REFERENCES "Novel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CodexTie" ADD CONSTRAINT "CodexTie_novelId_fkey" FOREIGN KEY ("novelId") REFERENCES "Novel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CodexTie" ADD CONSTRAINT "CodexTie_fromEntryId_fkey" FOREIGN KEY ("fromEntryId") REFERENCES "CodexEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CodexTie" ADD CONSTRAINT "CodexTie_toEntryId_fkey" FOREIGN KEY ("toEntryId") REFERENCES "CodexEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChapterCodex" ADD CONSTRAINT "ChapterCodex_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChapterCodex" ADD CONSTRAINT "ChapterCodex_codexEntryId_fkey" FOREIGN KEY ("codexEntryId") REFERENCES "CodexEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChapterSnapshot" ADD CONSTRAINT "ChapterSnapshot_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NovelDay" ADD CONSTRAINT "NovelDay_novelId_fkey" FOREIGN KEY ("novelId") REFERENCES "Novel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WritingSession" ADD CONSTRAINT "WritingSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthorSettings" ADD CONSTRAINT "AuthorSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
