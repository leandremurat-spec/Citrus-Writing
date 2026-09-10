import { CommandCenter } from "@/components/command-center/command-center";
import type { WritingStatus } from "@/components/workspace/live-chapter";
import { requireUser } from "@/lib/auth/session";
import { capabilitiesFor, type PlanId } from "@/lib/billing/plans";
import { getChapterBrief, getChapterMentions, getSettings } from "@/lib/data/novels";
import { getBufferSummary } from "@/lib/data/schedule";
import { getCurrentWeekDays, getWritingSummary } from "@/lib/data/writing";

/** Right panel for an open chapter: progress, codex, and the chapter's notes. */
export default async function ChapterPanel({ params }: { params: Promise<{ novelId: string; chapterId: string }> }) {
  const { novelId, chapterId } = await params;
  const user = await requireUser("/novels/" + novelId + "/chapters/" + chapterId);
  const [mentions, chapter, settings, summary, weekDays, bufferSummary] = await Promise.all([
    getChapterMentions(chapterId),
    getChapterBrief(chapterId, user.id),
    getSettings(user.id),
    getWritingSummary(user.id, novelId),
    getCurrentWeekDays(user.id),
    capabilitiesFor(user.plan as PlanId).buffer ? getBufferSummary(novelId) : Promise.resolve(undefined),
  ]);
  const current =
    chapter && chapter.novelId === novelId
      ? { id: chapter.id, notes: chapter.notes, wordCount: chapter.wordCount }
      : null;

  // Shown until the editor mounts and reports live figures; "this sitting" starts at zero
  // because nothing has been written in this visit yet.
  const status: WritingStatus | null = current
    ? {
        chapterId: current.id,
        wordCount: current.wordCount,
        sweetSpotMin: settings.sweetSpotMin,
        sweetSpotMax: settings.sweetSpotMax,
        sittingAdded: 0,
        sittingRemoved: 0,
        novelWords: summary.novelWords,
        novelAdded: summary.novelAdded,
        novelRemoved: summary.novelRemoved,
        todayWords: summary.todayWords,
        todayAdded: summary.todayAdded,
        todayRemoved: summary.todayRemoved,
        dailyGoal: summary.dailyGoal,
        streak: summary.streak,
        streakAlive: summary.todayWords > 0,
        saveState: "saved",
      }
    : null;

  return (
    <CommandCenter
      key={chapterId}
      novelId={novelId}
      mentions={current ? mentions : []}
      chapter={current}
      status={status}
      weekDays={weekDays}
      bufferSummary={bufferSummary}
    />
  );
}
