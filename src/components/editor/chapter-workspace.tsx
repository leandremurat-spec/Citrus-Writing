"use client";

import * as React from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

import { setChapterStatus, updateChapterTitle } from "@/lib/actions/chapters";
import { createCodexEntry } from "@/lib/actions/codex";
import { saveChapterContent } from "@/lib/actions/editor";
import { CHAPTER_STATUSES, STATUS_META, isChapterStatus } from "@/lib/binder/status";
import type { ChapterStatus } from "@/lib/binder/tree";
import type { CodexCategory, CodexEntryCard } from "@/lib/codex/types";
import type { WritingSummary } from "@/lib/data/writing";
import { MENTION_TEXT_SERIALIZERS, createEditorExtensions } from "@/lib/editor/extensions";
import { namePattern } from "@/lib/codex/unlinked";
import { mentionsInDoc } from "@/lib/editor/mentions";
import { hashSeed } from "@/lib/editor/sweet-spot";
import { countWordsInText, docToPlainText, parseDoc, type DocNode } from "@/lib/editor/word-count";
import { diffWordBags, formatSigned, wordBag, type WordBag, type WordDiff } from "@/lib/editor/word-diff";
import { formatNumber } from "@/lib/format";
import { StatusBadge, StatusDot } from "@/components/binder/status-badge";
import { StatusBar } from "@/components/canvas/status-bar";
import { useCodex } from "@/components/codex/codex-provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppearance } from "@/components/workspace/appearance-store";
import {
  setLiveCount,
  setLiveDoc,
  setLiveMentions,
  setWritingStatus,
  type SaveState,
} from "@/components/workspace/live-chapter";

import { EditorToolbar } from "./editor-toolbar";
import { HistoryDialog } from "./history-dialog";
import { MentionHoverCard } from "./mention-hover-card";
import { createMentionSuggestion } from "./mention-suggestion";
import { LINK_MENTIONS_EVENT, type LinkMentionsDetail } from "@/components/codex/unlinked-mentions";

import { SelectionMenu } from "./selection-menu";
import { createSlashSuggestion } from "./slash-suggestion";

export interface WorkspaceChapter {
  id: string;
  title: string;
  status: ChapterStatus;
  /** Serialized TipTap JSON, or "" for an empty chapter. */
  content: string;
  wordCount: number;
  /** ISO timestamp. */
  updatedAt: string;
}

export interface WorkspaceSettings {
  sweetSpotMin: number;
  sweetSpotMax: number;
  dailyGoal: number;
}

const SAVE_DELAY_MS = 900;
const GOAL_CELEBRATED_KEY = "pith:goal-celebrated";
const NO_DIFF: WordDiff = { added: 0, removed: 0 };

interface PendingSave {
  content: string;
  /** Plain text of `content`, for the live added/removed diff. */
  text: string;
  /** Word bag of the last saved text; built lazily on first edit. */
  baseline: WordBag | null;
  dirty: boolean;
  inFlight: boolean;
  timer: number | undefined;
}

/**
 * The center panel: toolbar, chapter header, the TipTap editor, and the live footer.
 * Mount it with `key={chapter.id}` so switching chapters starts a fresh editor.
 */
export function ChapterWorkspace({
  chapter,
  crumbs,
  settings,
  summary,
}: {
  chapter: WorkspaceChapter;
  crumbs: string[];
  settings: WorkspaceSettings;
  summary: WritingSummary;
}) {
  const { novelId, entries, upsert } = useCodex();
  const appearance = useAppearance();
  const [editorRoot, setEditorRoot] = React.useState<HTMLElement | null>(null);
  const wellRef = React.useRef<HTMLDivElement>(null);
  const [wordCount, setWordCount] = React.useState(chapter.wordCount);
  const [saveState, setSaveState] = React.useState<SaveState>("saved");
  const [session, setSession] = React.useState(summary);
  const [lastSavedCount, setLastSavedCount] = React.useState(chapter.wordCount);
  /** Added/removed since the last save (unsaved edits). */
  const [liveDiff, setLiveDiff] = React.useState<WordDiff>(NO_DIFF);
  /** Added/removed confirmed by saves since this chapter was opened. */
  const [sitting, setSitting] = React.useState<WordDiff>(NO_DIFF);

  const initialDoc = React.useMemo(() => parseDoc(chapter.content), [chapter.content]);
  const initialText = React.useMemo(() => (initialDoc ? docToPlainText(initialDoc) : ""), [initialDoc]);
  /**
   * Stored content that will not parse. Mounting an empty editor over it would let the first
   * autosave overwrite the chapter with nothing, so the editor refuses to open instead.
   */
  const unreadable = chapter.content !== "" && initialDoc === null;
  const pending = React.useRef<PendingSave>({
    content: chapter.content,
    text: initialText,
    baseline: null,
    dirty: false,
    inFlight: false,
    timer: undefined,
  });

  // Stable for the life of the (chapter-keyed) component: it only touches refs and setters.
  const persist = React.useMemo(
    () =>
      async function persist(): Promise<void> {
        const state = pending.current;
        window.clearTimeout(state.timer);
        if (state.inFlight || !state.dirty || unreadable) return;

        state.inFlight = true;
        state.dirty = false;
        setSaveState("saving");
        const savedText = state.text;
        let response: Awaited<ReturnType<typeof saveChapterContent>>;
        try {
          response = await saveChapterContent({ chapterId: chapter.id, content: state.content });
        } catch {
          // Network drop or an unexpected server failure: keep the edits and try again later.
          response = { ok: false, error: "Could not reach the server. Your words are safe here; saving again shortly." };
        }
        state.inFlight = false;

        if (!response.ok) {
          state.dirty = true;
          setSaveState("error");
          toast.error(response.error);
          state.timer = window.setTimeout(() => void persist(), SAVE_DELAY_MS * 5);
          return;
        }

        setSession(response.session);
        setLastSavedCount(response.wordCount);
        setSitting((previous) => ({
          added: previous.added + response.added,
          removed: previous.removed + response.removed,
        }));
        // The saved text is the new baseline; anything typed meanwhile is the new live diff.
        state.baseline = wordBag(savedText);
        setLiveDiff(state.dirty ? diffWordBags(state.baseline, wordBag(state.text)) : NO_DIFF);

        if (state.dirty) {
          // Edits landed while the request was out: debounce one more save.
          setSaveState("dirty");
          state.timer = window.setTimeout(() => void persist(), SAVE_DELAY_MS);
        } else {
          setSaveState("saved");
        }
      },
    [chapter.id, unreadable],
  );

  // The @ popover reads the codex through a ref, so the extension list stays stable while
  // entries change (rebuilding it would tear down and remount the editor).
  const entriesRef = React.useRef(entries);
  entriesRef.current = entries;
  const codexRef = React.useRef({ novelId, upsert });
  codexRef.current = { novelId, upsert };

  const extensions = React.useMemo(
    () =>
      createEditorExtensions({
        mentionSuggestion: createMentionSuggestion({
          getEntries: () => entriesRef.current,
          createEntry: async (name: string, category: CodexCategory): Promise<CodexEntryCard | null> => {
            const response = await createCodexEntry({ novelId: codexRef.current.novelId, name, category });
            if (!response.ok) {
              toast.error(response.error);
              return null;
            }
            codexRef.current.upsert(response.entry);
            return response.entry;
          },
        }),
        slashSuggestion: createSlashSuggestion(),
      }),
    [],
  );

  const reportDocument = React.useCallback(
    (doc: DocNode) => {
      setLiveMentions(chapter.id, Object.fromEntries(mentionsInDoc(doc)));
      setLiveDoc(chapter.id, doc);
    },
    [chapter.id],
  );

  const editor = useEditor({
    extensions,
    content: initialDoc ?? "",
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
    editorProps: {
      attributes: {
        class: "manuscript chapter-editor",
        "aria-label": "Chapter text",
        spellcheck: "true",
      },
    },
    onUpdate: ({ editor: instance }) => {
      const text = instance.getText({ blockSeparator: "\n", textSerializers: MENTION_TEXT_SERIALIZERS });
      const count = countWordsInText(text);
      setWordCount(count);
      setLiveCount(chapter.id, count);

      const state = pending.current;
      const json = instance.getJSON() as DocNode;
      reportDocument(json);
      state.content = JSON.stringify(json);
      state.text = text;
      state.dirty = true;
      state.baseline ??= wordBag(initialText);
      setLiveDiff(diffWordBags(state.baseline, wordBag(text)));
      setSaveState("dirty");
      window.clearTimeout(state.timer);
      state.timer = window.setTimeout(() => void persist(), SAVE_DELAY_MS);
    },
    onBlur: () => {
      if (pending.current.dirty) void persist();
    },
  });

  // Seed the panel's "In this chapter" list and the export dialog from the document as loaded.
  React.useEffect(() => {
    if (initialDoc) reportDocument(initialDoc);
  }, [initialDoc, reportDocument]);

  // Flush pending edits when the tab hides, the page unloads, or the chapter is switched.
  React.useEffect(() => {
    const state = pending.current;
    const flush = () => {
      if (state.dirty && !state.inFlight) void persist();
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", flush);
      window.clearTimeout(state.timer);
      if (state.dirty && !unreadable) void saveChapterContent({ chapterId: chapter.id, content: state.content });
    };
  }, [chapter.id, persist, unreadable]);

  // Between saves, project today's figures from the unsaved edits so the footer moves as you type.
  const liveDelta = wordCount - lastSavedCount;
  const todayWords = Math.max(0, session.todayWords + liveDelta);
  const todayAdded = session.todayAdded + liveDiff.added;
  const todayRemoved = session.todayRemoved + liveDiff.removed;
  // The same projection scoped to this novel. Both move together while you type in one
  // book; only the personal totals also carry what you wrote in the others.
  const novelWords = Math.max(0, session.novelWords + liveDelta);
  const novelAdded = session.novelAdded + liveDiff.added;
  const novelRemoved = session.novelRemoved + liveDiff.removed;
  const streakAlive = todayWords > 0;
  const streak = streakAlive ? (session.todayWords > 0 ? session.streak : session.streakIfWriteToday) : session.streak;
  const sittingAdded = sitting.added + liveDiff.added;
  const sittingRemoved = sitting.removed + liveDiff.removed;

  /*
   * The goal moment. Crossing the daily goal is the one thing in this app worth interrupting
   * for, and only just — a single line, once, on the day it happens. The day is remembered so
   * a reload or a chapter switch does not congratulate the writer twice.
   */
  const goalReached = todayWords >= session.dailyGoal && session.dailyGoal > 0;
  React.useEffect(() => {
    if (!goalReached) return;
    const today = new Date().toISOString().slice(0, 10);
    try {
      if (window.localStorage.getItem(GOAL_CELEBRATED_KEY) === today) return;
      window.localStorage.setItem(GOAL_CELEBRATED_KEY, today);
    } catch {
      // Without storage it may repeat across reloads; that is better than never saying it.
    }
    toast.success("Daily goal met.", { description: "Everything after this is a gift to future you." });
  }, [goalReached]);

  // Publish to the Progress panel, which renders in the right-hand route slot and so cannot
  // receive these as props.
  React.useEffect(() => {
    setWritingStatus({
      chapterId: chapter.id,
      wordCount,
      sweetSpotMin: settings.sweetSpotMin,
      sweetSpotMax: settings.sweetSpotMax,
      sittingAdded,
      sittingRemoved,
      novelWords,
      novelAdded,
      novelRemoved,
      todayWords,
      todayAdded,
      todayRemoved,
      dailyGoal: session.dailyGoal,
      streak,
      streakAlive,
      saveState,
    });
  }, [
    chapter.id,
    wordCount,
    settings.sweetSpotMin,
    settings.sweetSpotMax,
    sittingAdded,
    sittingRemoved,
    novelWords,
    novelAdded,
    novelRemoved,
    todayWords,
    todayAdded,
    todayRemoved,
    session.dailyGoal,
    streak,
    streakAlive,
    saveState,
  ]);

  /*
   * Turning already-written text into @mentions, on request from the codex panel.
   *
   * Done here rather than on the server: the editor owns the document and its schema, so the
   * replacement goes through the same commands typing a mention would, and the ordinary
   * autosave persists it. Ranges are applied last-first so earlier positions stay valid.
   */
  React.useEffect(() => {
    if (!editor) return;

    const onLink = (event: Event) => {
      const detail = (event as CustomEvent<LinkMentionsDetail>).detail;
      if (!detail || detail.chapterId !== chapter.id) return;

      const pattern = namePattern(detail.names);
      if (!pattern) return;

      const ranges: { from: number; to: number }[] = [];
      editor.state.doc.descendants((node, pos) => {
        if (!node.isText || !node.text) return;
        pattern.lastIndex = 0;
        for (const match of node.text.matchAll(pattern)) {
          const index = match.index ?? 0;
          ranges.push({ from: pos + index, to: pos + index + match[0].length });
        }
      });
      if (ranges.length === 0) return;

      let chain = editor.chain().focus();
      for (const range of ranges.reverse()) {
        chain = chain.insertContentAt(range, {
          type: "mention",
          attrs: { id: detail.entryId, label: detail.label },
        });
      }
      chain.run();
      toast.success(`Linked ${ranges.length} mention${ranges.length === 1 ? "" : "s"} of ${detail.label}.`);
    };

    window.addEventListener(LINK_MENTIONS_EVENT, onLink);
    return () => window.removeEventListener(LINK_MENTIONS_EVENT, onLink);
  }, [editor, chapter.id]);

  /*
   * Adopt a restored version in place. The server has already written it, so the point here
   * is to stop the editor overwriting it right back: the pending buffer, the baseline and the
   * last-saved count all become the restored text, and the sitting diff is left alone because
   * a restore is not writing.
   */
  const adoptRestored = React.useCallback(
    (content: string, restoredWordCount: number) => {
      if (!editor) return;
      const doc = parseDoc(content);
      if (!doc) {
        toast.error("That version could not be opened in the editor. Nothing was changed here.");
        return;
      }
      editor.commands.setContent(doc as never, { emitUpdate: false });
      const text = docToPlainText(doc);
      const state = pending.current;
      window.clearTimeout(state.timer);
      state.content = content;
      state.text = text;
      state.baseline = wordBag(text);
      state.dirty = false;
      setWordCount(restoredWordCount);
      setLastSavedCount(restoredWordCount);
      setLiveCount(chapter.id, restoredWordCount);
      setLiveDiff(NO_DIFF);
      setSaveState("saved");
      reportDocument(doc);
    },
    [editor, chapter.id, reportDocument],
  );

  // Typewriter scrolling. The caret's viewport position is compared against a fixed line
  // in the well and the difference is scrolled away, so the line you are writing stays put
  // while the page moves under it. Off by default; `behavior: auto` because a smooth scroll
  // on every keystroke fights the typing.
  React.useEffect(() => {
    const well = wellRef.current;
    if (!editor || !well || !appearance.typewriter) return;

    const hold = () => {
      if (!editor.isFocused) return;
      const caret = editor.view.coordsAtPos(editor.state.selection.head);
      const box = well.getBoundingClientRect();
      const line = box.top + box.height * 0.42;
      const drift = caret.top - line;
      if (Math.abs(drift) > 1) well.scrollBy({ top: drift, behavior: "auto" });
    };

    editor.on("selectionUpdate", hold);
    editor.on("update", hold);
    return () => {
      editor.off("selectionUpdate", hold);
      editor.off("update", hold);
    };
  }, [editor, appearance.typewriter]);

  return (
    // The manuscript is the page's main content and had no landmark at all, so "skip to
    // main" and every landmark-based navigation had nowhere to go.
    <main aria-label="Manuscript" className="flex h-full min-h-0 flex-col">
      {appearance.showToolbar && <EditorToolbar editor={editor} />}
      <SelectionMenu editor={editor} root={editorRoot} />

      {/*
        The well and the sheet. The canvas gutter is the darkest surface in the app and the
        page is the lightest, which is what makes the manuscript read as the lit thing rather
        than as one more panel. The sheet fills the canvas; the *measure* is set inside it by
        `.manuscript`, so a wide canvas gives generous margins instead of 120-character lines.
        Both surfaces read their brightness from the Settings tab.
      */}
      <div ref={wellRef} className="canvas-well min-h-0 flex-1 overflow-y-auto px-4 sm:px-6">
        <div className="canvas-sheet mx-auto min-h-full max-w-5xl rounded-t-xl px-6 pt-10 pb-32 sm:px-10">
          <article className="manuscript-column mx-auto w-full">
          {crumbs.length > 0 && (
            <p className="label-eyebrow mb-3">
              {crumbs.join("  ›  ")}
            </p>
          )}
          {/* The title is an editable input; the page still needs a real heading, and a
              screen reader still needs to hear what chapter this is on arrival. */}
          <h1 className="sr-only">{chapter.title || "Untitled chapter"}</h1>
          <ChapterTitle key={`${chapter.id}:${chapter.title}`} chapterId={chapter.id} title={chapter.title} />
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <StatusMenu key={`${chapter.id}:${chapter.status}`} chapterId={chapter.id} status={chapter.status} />
            <span suppressHydrationWarning>
              Edited {formatDistanceToNow(new Date(chapter.updatedAt), { addSuffix: true })}
            </span>
            <HistoryDialog chapterId={chapter.id} onRestore={adoptRestored} />
            {(sittingAdded > 0 || sittingRemoved > 0) && (
              <span
                className="flex items-center gap-1 tabular-nums"
                title="Words added and removed in this chapter since you opened it"
              >
                <span aria-hidden>·</span>
                This sitting
                <span className="text-press">+{formatNumber(sittingAdded)}</span>
                <span>−{formatNumber(sittingRemoved)}</span>
                <span className="text-foreground/80">({formatSigned(sittingAdded - sittingRemoved)})</span>
              </span>
            )}
          </div>
          <Separator className="my-8" />

          {unreadable ? (
            <div className="rounded-lg border border-proof/40 bg-proof/5 p-4 text-sm">
              <p className="font-medium text-proof">This chapter&rsquo;s saved text could not be read.</p>
              <p className="mt-1 text-muted-foreground">
                The editor stays closed so nothing overwrites it. Your words are still saved.
              </p>
            </div>
          ) : /* Own the wrapper element: `EditorContent`'s own ref points at its component
              instance, and the hover card needs the DOM node to listen on. */
          editor ? (
            <div ref={setEditorRoot}>
              <EditorContent editor={editor} />
            </div>
          ) : (
            <div className="space-y-4" aria-hidden>
              <Skeleton className="h-5 w-11/12" />
              <Skeleton className="h-5 w-4/5" />
              <Skeleton className="h-5 w-10/12" />
            </div>
          )}
          </article>
        </div>
      </div>

      <StatusBar
        wordCount={wordCount}
        sweetSpotMin={settings.sweetSpotMin}
        sweetSpotMax={settings.sweetSpotMax}
        saveState={saveState}
        messageSeed={hashSeed(chapter.id)}
      />

      <MentionHoverCard editorRoot={editorRoot} />
    </main>
  );
}

function ChapterTitle({ chapterId, title }: { chapterId: string; title: string }) {
  const [value, setValue] = React.useState(title);
  const [saved, setSaved] = React.useState(title);

  const commit = async () => {
    const next = value.trim();
    if (!next) {
      setValue(saved);
      return;
    }
    if (next === saved) return;
    setSaved(next);
    const response = await updateChapterTitle({ chapterId, title: next });
    if (!response.ok) toast.error(response.error);
  };

  return (
    <input
      value={value}
      onChange={(event) => setValue(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          event.currentTarget.blur();
        } else if (event.key === "Escape") {
          setValue(saved);
          event.currentTarget.blur();
        }
      }}
      aria-label="Chapter title"
      placeholder="Untitled chapter"
      maxLength={200}
      className="focus-ring w-full rounded-sm bg-transparent font-heading text-3xl leading-tight outline-none placeholder:text-muted-foreground/40"
    />
  );
}

function StatusMenu({ chapterId, status: initial }: { chapterId: string; status: ChapterStatus }) {
  const [status, setStatus] = React.useState(initial);

  const change = async (value: string) => {
    if (!isChapterStatus(value) || value === status) return;
    setStatus(value);
    const response = await setChapterStatus({ chapterId, status: value });
    if (!response.ok) {
      setStatus(initial);
      toast.error(response.error);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<button type="button" className="focus-ring rounded-full outline-none" />}
        aria-label="Change status"
      >
        <StatusBadge status={status} className="cursor-pointer transition-[filter] duration-tint ease-state hover:brightness-125" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-52">
        <DropdownMenuRadioGroup value={status} onValueChange={(value) => void change(String(value))}>
          {CHAPTER_STATUSES.map((entry) => (
            <DropdownMenuRadioItem key={entry} value={entry}>
              <StatusDot status={entry} />
              <span className="flex-1">{STATUS_META[entry].label}</span>
              <span className="text-2xs text-muted-foreground">{STATUS_META[entry].description}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
