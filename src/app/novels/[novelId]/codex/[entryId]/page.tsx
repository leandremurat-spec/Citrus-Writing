import { notFound } from "next/navigation";

import { CodexBrowser } from "@/components/codex/codex-browser";
import {
  getCodexEntryDetail,
  getCodexTies,
  getMentionThread,
  getOtherCodexEntries,
  getUnlinkedMentionSummary,
} from "@/lib/data/codex";

export const dynamic = "force-dynamic";

/** The Codex with one entry open: its sheet, its ties, and its thread through the run. */
export default async function CodexEntryPage({
  params,
}: {
  params: Promise<{ novelId: string; entryId: string }>;
}) {
  const { novelId, entryId } = await params;
  const entry = await getCodexEntryDetail(entryId);
  if (!entry || entry.novelId !== novelId) notFound();

  const [ties, mentionThread, unlinkedSummary, otherEntries] = await Promise.all([
    getCodexTies(entryId),
    getMentionThread(novelId, entryId),
    getUnlinkedMentionSummary(novelId, entry),
    getOtherCodexEntries(novelId, entryId),
  ]);

  return (
    <CodexBrowser
      novelId={novelId}
      selectedEntryId={entryId}
      detail={{ entry, ties, mentionThread, unlinkedSummary, otherEntries }}
    />
  );
}
