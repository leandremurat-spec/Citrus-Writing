import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ChapterWorkspace } from "@/components/editor/chapter-workspace";
import { getCurrentUser, requireUser } from "@/lib/auth/session";
import { getChapter, getChapterBrief, getSettings } from "@/lib/data/novels";
import { getWritingSummary } from "@/lib/data/writing";

type Params = Promise<{ novelId: string; chapterId: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { chapterId } = await params;
  // Metadata runs for signed-out requests too; a title is not worth a redirect, so this one
  // degrades to the generic name rather than calling requireUser.
  const user = await getCurrentUser();
  const chapter = user ? await getChapterBrief(chapterId, user.id) : null;
  return { title: chapter?.title ?? "Chapter" };
}

export default async function ChapterPage({ params }: { params: Params }) {
  const { novelId, chapterId } = await params;
  const user = await requireUser("/novels/" + novelId + "/chapters/" + chapterId);
  const [chapter, settings, summary] = await Promise.all([
    getChapter(chapterId, user.id),
    getSettings(user.id),
    getWritingSummary(user.id, novelId),
  ]);
  if (!chapter || chapter.novelId !== novelId) notFound();

  const crumbs = [chapter.arc?.volume?.title ?? chapter.volume?.title, chapter.arc?.title].filter(
    (crumb): crumb is string => Boolean(crumb),
  );

  return (
    <ChapterWorkspace
      key={chapter.id}
      chapter={{
        id: chapter.id,
        title: chapter.title,
        status: chapter.status,
        content: chapter.content,
        wordCount: chapter.wordCount,
        updatedAt: chapter.updatedAt.toISOString(),
      }}
      crumbs={crumbs}
      settings={{
        sweetSpotMin: settings.sweetSpotMin,
        sweetSpotMax: settings.sweetSpotMax,
        dailyGoal: settings.dailyGoal,
      }}
      summary={summary}
    />
  );
}
