import { CodexBrowser } from "@/components/codex/codex-browser";

export const dynamic = "force-dynamic";

/** The Codex with nothing selected: pick an entry from the list. */
export default async function CodexIndexPage({ params }: { params: Promise<{ novelId: string }> }) {
  const { novelId } = await params;
  return <CodexBrowser novelId={novelId} selectedEntryId={null} detail={null} />;
}
