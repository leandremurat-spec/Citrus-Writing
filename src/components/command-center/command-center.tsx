"use client";

import { BookMarked, Gauge, Settings2, StickyNote } from "lucide-react";

import type { ChapterMention } from "@/lib/codex/types";
import type { BufferSummary } from "@/lib/data/schedule";
import type { WeekDay } from "@/lib/data/writing";
import { PanelChrome } from "@/components/ui/panel-chrome";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { WritingStatus } from "@/components/workspace/live-chapter";

import { CodexPanel } from "./codex-panel";
import { NotesPanel } from "./notes-panel";
import { ProgressPanel } from "./progress-panel";
import { SettingsPanel } from "./settings-panel";

/**
 * The right panel. Progress opens by default: it is what an author glances at while writing,
 * and it holds the counters that used to be crammed into the footer. Codex entries come from
 * `CodexProvider` in the novel layout; the Buffer itself lives at its own full-page route (see
 * `WorkspaceShell`) and is reached from the Progress tab's card, not a tab here.
 *
 * Settings is icon-only and pushed to the end, so the three tabs an author actually moves
 * between keep their labels and their width.
 */
export function CommandCenter({
  novelId,
  mentions,
  chapter,
  status,
  weekDays = [],
  bufferSummary,
}: {
  /** Absent on the two "no chapter open" panel routes, which never reach the card that needs it. */
  novelId?: string;
  mentions: ChapterMention[];
  chapter: { id: string; notes: string | null } | null;
  /** Server-rendered progress figures, until the editor reports live ones. */
  status: WritingStatus | null;
  /** This calendar week, Monday first, for the streak's day-dots. Empty when no chapter is open. */
  weekDays?: WeekDay[];
  bufferSummary?: BufferSummary;
}) {
  return (
    <Tabs
      defaultValue="progress"
      // A complementary landmark, so the panel can be reached and skipped as one thing.
      render={<aside aria-label="Command centre" />}
      className="h-full min-h-0 gap-0"
    >
      <PanelChrome className="px-2">
        <TabsList variant="line" className="h-8 min-w-0 flex-1">
          <TabsTrigger value="progress">
            <Gauge /> Progress
          </TabsTrigger>
          <TabsTrigger value="codex">
            <BookMarked /> Codex
          </TabsTrigger>
          <TabsTrigger value="notes">
            <StickyNote /> Notes
          </TabsTrigger>
          <TabsTrigger value="settings" aria-label="Settings" className="flex-none px-2">
            <Settings2 />
          </TabsTrigger>
        </TabsList>
      </PanelChrome>

      <TabsContent value="progress" keepMounted className="min-h-0 flex-1">
        <ProgressPanel
          chapterId={chapter?.id ?? null}
          fallback={status}
          weekDays={weekDays}
          novelId={novelId}
          bufferSummary={bufferSummary}
        />
      </TabsContent>
      <TabsContent value="codex" keepMounted className="min-h-0 flex-1">
        <CodexPanel mentions={mentions} chapterId={chapter?.id ?? null} />
      </TabsContent>
      <TabsContent value="notes" keepMounted className="min-h-0 flex-1">
        {chapter ? (
          <NotesPanel key={chapter.id} chapterId={chapter.id} initialNotes={chapter.notes} />
        ) : (
          <p className="p-6 text-center text-sm text-muted-foreground">Open a chapter.</p>
        )}
      </TabsContent>
      <TabsContent value="settings" className="min-h-0 flex-1">
        <SettingsPanel />
      </TabsContent>
    </Tabs>
  );
}
