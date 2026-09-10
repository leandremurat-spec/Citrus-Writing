/** Shared vocabulary for the export engine. Pure types: safe on the server and the client. */

import type { DocNode } from "@/lib/editor/word-count";

export type ExportFormat = "html" | "markdown" | "text";

/** How a scene break (a horizontal rule in the manuscript) should look in the output. */
export type SceneBreakStyle = "hr" | "asterisks";

export interface ExportOptions {
  format: ExportFormat;
  /** Put the chapter title at the top of the output. */
  includeTitle: boolean;
  title: string;
  sceneBreak: SceneBreakStyle;
}

export interface ExportResult {
  /** What lands on the clipboard as plain text: the markup source itself. */
  text: string;
  /**
   * The same content as `text/html`, so pasting into a site's rich-text editor keeps the
   * formatting. Null for Markdown and plain text, both of which are meant to arrive as source.
   */
  html: string | null;
  wordCount: number;
  characterCount: number;
  /** Notes about anything the format cannot represent, shown above the preview. */
  warnings: string[];
}

export const DEFAULT_EXPORT_OPTIONS: Omit<ExportOptions, "title"> = {
  format: "html",
  includeTitle: false,
  sceneBreak: "hr",
};

/** One chapter going into a multi-chapter export. */
export interface ExportChapterItem {
  title: string;
  doc: DocNode | null;
}

/** What sits between chapters when exporting more than one: each one's own title, the way a
    single chapter's own heading works, or just a scene break with no titles at all. */
export type ChapterSeparator = "heading" | "sceneBreak";

export interface ExportChaptersOptions {
  format: ExportFormat;
  sceneBreak: SceneBreakStyle;
  separator: ChapterSeparator;
}
