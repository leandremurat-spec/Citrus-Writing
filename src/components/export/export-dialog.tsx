"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, ClipboardCopy, Download, Info, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { getChapterForExport, getChaptersForExport, type ExportChapterRow } from "@/lib/actions/export";
import { capabilitiesFor, type ExportScopeId, type PlanId } from "@/lib/billing/plans";
import { findNode, runNumbers, type BinderNode, type ContainerRef } from "@/lib/binder/tree";
import { parseDoc, type DocNode } from "@/lib/editor/word-count";
import {
  DEFAULT_EXPORT_OPTIONS,
  exportChapter,
  exportChapters,
  type ChapterSeparator,
  type ExportFormat,
  type SceneBreakStyle,
} from "@/lib/export";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { StatusDot } from "@/components/binder/status-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Segmented, type SegmentedOption } from "@/components/ui/segmented";
import { getLiveDoc } from "@/components/workspace/live-chapter";

/**
 * Export.
 *
 * Rebuilt against the "Export and history" screen from the Claude Design handoff, which is
 * where this dialog's *shape* comes from: a scope capsule at the top, then the chapters that
 * scope actually contains as real rows, then format and separator side by side, then the
 * preview, then a footer that states the size of what is about to leave.
 *
 * The three things the redesign changed that are not cosmetic:
 *
 * **The chapter list is a control, not a receipt.** Each row's tick can be turned off. A
 * serial author shipping a backlog nearly always wants "this arc, except the one I have not
 * finished", and the previous list — which only displayed what was going — made them export
 * the arc and delete a chapter out of the clipboard afterwards.
 *
 * **Plain text is a real third format**, not HTML with the tags stripped. See lib/export/plain.ts.
 *
 * **Download sits beside Copy.** The clipboard is right for pasting into Royal Road; a file is
 * right for an editor, a backup, or a beta reader. Both come off the same rendered string, so
 * they can never disagree.
 *
 * The scene-break control the previous version always showed now appears only when the
 * document contains a scene break — the same "earns its place or goes" rule the app applies to
 * explanatory copy, applied to a control that could do nothing.
 */

const FORMATS: SegmentedOption<ExportFormat>[] = [
  { value: "html", label: "HTML" },
  { value: "markdown", label: "Markdown" },
  { value: "text", label: "Plain text" },
];

const SCENE_BREAKS: SegmentedOption<SceneBreakStyle>[] = [
  { value: "hr", label: "Divider line" },
  { value: "asterisks", label: "* * *" },
];

const FILE_EXTENSION: Record<ExportFormat, string> = { html: "html", markdown: "md", text: "txt" };
const MIME: Record<ExportFormat, string> = {
  html: "text/html",
  markdown: "text/markdown",
  text: "text/plain",
};

/** The chapter's nearest arc and volume ancestors, if it has them — an interlude sitting
    directly under a volume has a volume but no arc; a chapter at the novel root has neither. */
function ancestorContainers(nodes: BinderNode[], chapterId: string): { arcId: string | null; volumeId: string | null } {
  const chapter = findNode(nodes, chapterId);
  let container: ContainerRef = chapter?.parent ?? { kind: "root" };
  let arcId: string | null = null;
  let volumeId: string | null = null;
  while (container.kind !== "root") {
    if (container.kind === "arc" && arcId === null) arcId = container.id;
    if (container.kind === "volume") {
      volumeId = container.id;
      break;
    }
    const node = findNode(nodes, container.id);
    if (!node) break;
    container = node.parent;
  }
  return { arcId, volumeId };
}

/** "file-name-like-this" — for the download, which needs something a filesystem will take. */
function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "export"
  );
}

export function ExportDialog({
  open,
  onOpenChange,
  novelId,
  nodes,
  chapterId,
  chapterTitle,
  plan,
  sweetSpotMin,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  novelId: string;
  nodes: BinderNode[];
  chapterId: string | null;
  chapterTitle: string;
  plan: PlanId;
  /** The low end of the writer's own band, for the "short of your band" note. */
  sweetSpotMin: number;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="gap-4.5 sm:max-w-[40rem]">
        {open && chapterId ? (
          <ExportForm
            key={chapterId}
            novelId={novelId}
            nodes={nodes}
            chapterId={chapterId}
            chapterTitle={chapterTitle}
            plan={plan}
            sweetSpotMin={sweetSpotMin}
            onOpenChange={onOpenChange}
          />
        ) : (
          <>
            <DialogTitle>Nothing to export</DialogTitle>
            <DialogDescription>Open a chapter first.</DialogDescription>
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ExportForm({
  novelId,
  nodes,
  chapterId,
  chapterTitle,
  plan,
  sweetSpotMin,
  onOpenChange,
}: {
  novelId: string;
  nodes: BinderNode[];
  chapterId: string;
  chapterTitle: string;
  plan: PlanId;
  sweetSpotMin: number;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const allowed = capabilitiesFor(plan).exportScopes;
  const { arcId, volumeId } = React.useMemo(() => ancestorContainers(nodes, chapterId), [nodes, chapterId]);
  const numbers = React.useMemo(() => runNumbers(nodes), [nodes]);

  /*
   * Every scope this chapter *could* have is offered; the ones the plan does not include are
   * padlocked rather than removed. A writer on Drawer who has just written an arc should be
   * able to see that exporting the whole arc is a thing this app does.
   */
  const scopeOptions = React.useMemo(() => {
    const options: SegmentedOption<ExportScopeId>[] = [{ value: "chapter", label: "This chapter" }];
    if (arcId) options.push({ value: "arc", label: "This arc" });
    if (volumeId) options.push({ value: "volume", label: "This volume" });
    options.push({ value: "novel", label: "Whole serial" });
    return options.map((option) => ({ ...option, locked: !allowed.includes(option.value) }));
  }, [arcId, volumeId, allowed]);

  const [scope, setScope] = React.useState<ExportScopeId>("chapter");
  const [format, setFormat] = React.useState<ExportFormat>(DEFAULT_EXPORT_OPTIONS.format);
  const [sceneBreak, setSceneBreak] = React.useState<SceneBreakStyle>(DEFAULT_EXPORT_OPTIONS.sceneBreak);
  const [includeTitle, setIncludeTitle] = React.useState(DEFAULT_EXPORT_OPTIONS.includeTitle);
  const [separator, setSeparator] = React.useState<ChapterSeparator>("heading");
  const [excluded, setExcluded] = React.useState<ReadonlySet<string>>(() => new Set());
  const [copied, setCopied] = React.useState(false);

  // This chapter: the live doc when it's the one open in the editor, else fetched once.
  const [singleDoc, setSingleDoc] = React.useState<DocNode | null>(() => getLiveDoc(chapterId));
  const [singleLoading, setSingleLoading] = React.useState(() => getLiveDoc(chapterId) === null);

  React.useEffect(() => {
    if (scope !== "chapter" || !singleLoading) return;
    let cancelled = false;
    void (async () => {
      const response = await getChapterForExport({ chapterId });
      if (cancelled) return;
      if (!response.ok) {
        toast.error(response.error);
        setSingleLoading(false);
        return;
      }
      setSingleDoc(parseDoc(response.content));
      setSingleLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [chapterId, scope, singleLoading]);

  // An arc, a volume, or the whole serial: every chapter in the scope, in run order. Each one
  // still prefers its own live doc, so a scope that happens to include the open chapter picks
  // up unsaved edits the same way a single-chapter export does.
  //
  // `chapters` is cleared to null in the effect's cleanup rather than by a synchronous setState
  // in its body, so switching scopes shows the loading state instead of the previous scope's
  // stale list for a moment.
  const [chapters, setChapters] = React.useState<ExportChapterRow[] | null>(null);
  const multiLoading = scope !== "chapter" && chapters === null;

  React.useEffect(() => {
    if (scope === "chapter") return;
    let cancelled = false;
    void (async () => {
      const input =
        scope === "arc" && arcId
          ? ({ scope: "arc", novelId, arcId } as const)
          : scope === "volume" && volumeId
            ? ({ scope: "volume", novelId, volumeId } as const)
            : ({ scope: "novel", novelId } as const);
      const response = await getChaptersForExport(input);
      if (cancelled) return;
      if (!response.ok) {
        toast.error(response.error);
        setChapters([]);
        return;
      }
      setChapters(response.chapters);
    })();
    return () => {
      cancelled = true;
      setChapters(null);
      // A chapter turned off in one scope has no meaning in the next: an arc's third chapter
      // is not the serial's third chapter, and carrying the exclusion across would silently
      // drop something the writer never deselected.
      setExcluded(new Set());
    };
  }, [scope, novelId, arcId, volumeId]);

  const loading = scope === "chapter" ? singleLoading : multiLoading;
  const included = React.useMemo(
    () => (chapters ?? []).filter((chapter) => !excluded.has(chapter.id)),
    [chapters, excluded],
  );

  const result = React.useMemo(() => {
    if (scope === "chapter") {
      return exportChapter(singleDoc, { format, sceneBreak, includeTitle, title: chapterTitle });
    }
    const items = included.map((chapter) => ({
      title: chapter.title,
      doc: getLiveDoc(chapter.id) ?? parseDoc(chapter.content),
    }));
    return exportChapters(items, { format, sceneBreak, separator });
  }, [scope, singleDoc, included, format, sceneBreak, includeTitle, separator, chapterTitle]);

  /** Only offer a scene-break style when the text has one to style. */
  const hasSceneBreak = React.useMemo(() => {
    const walk = (node: DocNode | null): boolean => {
      if (!node) return false;
      if (node.type === "horizontalRule") return true;
      return (node.content ?? []).some(walk);
    };
    if (scope === "chapter") return walk(singleDoc);
    return included.some((chapter) => walk(getLiveDoc(chapter.id) ?? parseDoc(chapter.content)));
  }, [scope, singleDoc, included]);

  const chapterCount = scope === "chapter" ? 1 : included.length;
  const minutes = Math.max(1, Math.round(result.wordCount / 230));
  const scopeTitle =
    scope === "arc" && arcId
      ? (findNode(nodes, arcId)?.title ?? "This arc")
      : scope === "volume" && volumeId
        ? (findNode(nodes, volumeId)?.title ?? "This volume")
        : scope === "novel"
          ? "The whole serial"
          : chapterTitle;

  /**
   * The one chapter worth mentioning before the writer presses copy: short of their band and
   * never published. It is not a warning — exporting it is fine — it is the thing they would
   * want to have noticed, which is exactly the handoff's own wording.
   */
  const flagged = React.useMemo(() => {
    if (scope === "chapter") return null;
    return included.find((chapter) => chapter.status !== "PUBLISHED" && chapter.wordCount < sweetSpotMin) ?? null;
  }, [scope, included, sweetSpotMin]);

  const copy = async () => {
    try {
      // Writing both flavours means one button serves both habits: pasting into a rich-text
      // editor keeps the formatting, pasting into an HTML box gets the source.
      if (result.html && typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([result.html], { type: "text/html" }),
            "text/plain": new Blob([result.text], { type: "text/plain" }),
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(result.text);
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
      toast.success(FORMATS.find((option) => option.value === format)!.label + " copied", {
        description: formatNumber(result.wordCount) + " words, ready to paste.",
      });
    } catch {
      toast.error("The clipboard refused the copy. Select the preview and copy manually.");
    }
  };

  const download = () => {
    const name = slugify(scopeTitle) + "." + FILE_EXTENSION[format];
    const url = URL.createObjectURL(new Blob([result.text], { type: MIME[format] + ";charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.click();
    // Revoked on the next tick rather than immediately: Chrome has been known to cancel a
    // download whose object URL is released in the same frame as the click.
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success("Saved " + name);
  };

  return (
    <>
      {/* ------------------------------------------------------------ header */}
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <DialogTitle className="font-heading text-[1.625rem] leading-tight">Export</DialogTitle>
          <DialogDescription className="mt-1.5 text-2xs">
            Clean HTML, Markdown or plain text for Royal Road, Scribble Hub and the rest. No classes, no wrappers.
          </DialogDescription>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          className="size-8.5 flex-none"
          aria-label="Close"
          onClick={() => onOpenChange(false)}
        >
          <X />
        </Button>
      </div>

      {/* -------------------------------------------------------- what goes out */}
      <div>
        <p className="label-section mb-2">What goes out</p>
        <Segmented
          size="sm"
          label="What goes out"
          options={scopeOptions}
          value={scope}
          onChange={setScope}
          onLocked={() => router.push("/pricing?from=export")}
        />
        <p className="mt-2.5 text-2xs text-neutral-800">
          {loading ? (
            "Reading the chapters…"
          ) : (
            <>
              <strong>{scopeTitle}</strong> — {formatNumber(chapterCount)}{" "}
              {chapterCount === 1 ? "chapter" : "chapters"}, {formatNumber(result.wordCount)} words, about {minutes}{" "}
              {minutes === 1 ? "minute" : "minutes"} of reading.
            </>
          )}
        </p>
      </div>

      {/* ------------------------------------------------------- chapter rows */}
      {scope !== "chapter" && chapters && chapters.length > 0 && (
        <div className="flex max-h-52 flex-col gap-1 overflow-y-auto">
          {chapters.map((chapter) => {
            const on = !excluded.has(chapter.id);
            const isOpenChapter = chapter.id === chapterId;
            return (
              <button
                key={chapter.id}
                type="button"
                aria-pressed={on}
                onClick={() =>
                  setExcluded((current) => {
                    const next = new Set(current);
                    if (next.has(chapter.id)) next.delete(chapter.id);
                    else next.add(chapter.id);
                    return next;
                  })
                }
                className={cn(
                  "focus-ring-inset flex items-center gap-2.75 rounded-[20px] px-3.5 py-2.5 text-left transition-colors duration-tint ease-state",
                  isOpenChapter ? "bg-press-100 hover:bg-press-200" : "bg-muted hover:bg-neutral-300",
                  !on && "opacity-55",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "flex size-5 flex-none items-center justify-center rounded-full transition-colors duration-tint ease-state",
                    on ? "bg-press text-press-foreground" : "shadow-[inset_0_0_0_1.5px_var(--neutral-600)]",
                  )}
                >
                  {on && <Check className="size-3" strokeWidth={3.5} />}
                </span>
                <span
                  className={cn(
                    "flex size-6 flex-none items-center justify-center rounded-full bg-neutral-100 text-3xs font-bold tabular-nums",
                    isOpenChapter ? "text-press-800" : "text-neutral-800",
                  )}
                >
                  {numbers.get(chapter.id) ?? "–"}
                </span>
                <span className={cn("min-w-0 flex-1 truncate text-sm", isOpenChapter && "text-press-900")}>
                  {chapter.title}
                </span>
                <span
                  className={cn("flex-none text-3xs tabular-nums", isOpenChapter ? "text-press-800" : "text-subtle")}
                >
                  {formatNumber(chapter.wordCount)}
                </span>
                <StatusDot status={chapter.status} className="size-2.25" title={chapter.status.toLowerCase()} />
              </button>
            );
          })}

          {flagged && (
            <p className="mt-1 text-3xs leading-relaxed text-press-800">
              {flagged.title} is {formatNumber(sweetSpotMin - flagged.wordCount)} words short of your band and has
              never gone out. Exporting it is fine — just know it is the one readers have not seen.
            </p>
          )}
        </div>
      )}

      {/* ----------------------------------------------- format and separator */}
      <div className="flex flex-wrap items-start gap-x-6 gap-y-4.5">
        <div>
          <p className="label-section mb-2">Format</p>
          <Segmented size="sm" label="Format" options={FORMATS} value={format} onChange={setFormat} />
        </div>

        {scope === "chapter" ? (
          <div>
            <p className="label-section mb-2">The title</p>
            <Segmented
              size="sm"
              label="Include the chapter title"
              options={[
                { value: "on", label: "Include it" },
                { value: "off", label: "Body only" },
              ]}
              value={includeTitle ? "on" : "off"}
              onChange={(value) => setIncludeTitle(value === "on")}
            />
          </div>
        ) : (
          <div className="min-w-0 flex-1">
            <p className="label-section mb-2">Between chapters</p>
            <div className="flex flex-col gap-1.5">
              <Radio
                name="cw-sep"
                checked={separator === "heading"}
                onChange={() => setSeparator("heading")}
                label="Its title as a heading"
              />
              <Radio
                name="cw-sep"
                checked={separator === "sceneBreak"}
                onChange={() => setSeparator("sceneBreak")}
                label="A scene break only"
              />
            </div>
          </div>
        )}

        {/* Only when the text actually has a scene break to style. A control that can do
            nothing is the same problem as a hint that says the label again. */}
        {hasSceneBreak && (
          <div>
            <p className="label-section mb-2">Scene breaks</p>
            <Segmented size="sm" label="Scene breaks" options={SCENE_BREAKS} value={sceneBreak} onChange={setSceneBreak} />
          </div>
        )}
      </div>

      {/* --------------------------------------------------------- the notice */}
      {result.warnings.length > 0 && (
        <div className="rounded-[20px] bg-ochre-100 px-4 py-3.5">
          <ul className="flex list-none flex-col gap-2 p-0">
            {result.warnings.map((warning) => (
              <li key={warning} className="flex gap-2.25 text-2xs leading-relaxed text-ochre-900">
                <Info className="mt-0.5 size-4 flex-none" aria-hidden />
                <span>{warning}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ------------------------------------------------------------ preview */}
      <div>
        <p className="label-section mb-2">Preview</p>
        <div className="max-h-40 overflow-auto rounded-[20px] bg-neutral-100 px-4 py-3.5 ring-1 ring-edge">
          {loading ? (
            <Loader2 className="size-4 animate-spin text-subtle" />
          ) : (
            <pre className="m-0 font-mono text-3xs leading-relaxed whitespace-pre-wrap text-neutral-900">
              {result.text || "There is nothing here yet."}
            </pre>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------- footer */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <span className="text-2xs text-subtle tabular-nums">
          {formatNumber(chapterCount)} {chapterCount === 1 ? "chapter" : "chapters"} ·{" "}
          {formatNumber(result.wordCount)} words
        </span>
        <span className="flex flex-wrap gap-2">
          <Button variant="outline" className="h-9.5" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="outline" className="h-9.5" disabled={loading || !result.text} onClick={download}>
            <Download />
            Download
          </Button>
          <Button
            className="h-9.5 bg-press text-press-foreground hover:bg-press-600"
            disabled={loading || !result.text}
            onClick={() => void copy()}
          >
            {copied ? <Check /> : <ClipboardCopy />}
            {copied ? "Copied" : chapterCount > 1 ? "Copy all " + chapterCount : "Copy"}
          </Button>
        </span>
      </div>
    </>
  );
}

/** The handoff's `.radio` — a ring that fills, with the ground showing through its middle. */
function Radio({
  name,
  checked,
  onChange,
  label,
}: {
  name: string;
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.25 text-2xs">
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onChange}
        className="focus-ring size-4 shrink-0 appearance-none rounded-full border-[1.5px] border-neutral-600 transition-colors duration-tint ease-state checked:border-press checked:bg-press checked:shadow-[inset_0_0_0_3px_var(--popover)]"
      />
      {label}
    </label>
  );
}
