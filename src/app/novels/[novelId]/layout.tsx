import { notFound } from "next/navigation";

import { Binder } from "@/components/binder/binder";
import { CodexProvider } from "@/components/codex/codex-provider";
import { AppHeader } from "@/components/workspace/app-header";
import { RunBand } from "@/components/workspace/run-band";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import { requireUser } from "@/lib/auth/session";
import { capabilitiesFor, type PlanId } from "@/lib/billing/plans";
import { getBinderNodes, getCodexEntries, getNovel, getSettings, listNovels } from "@/lib/data/novels";
import { getBufferSummary } from "@/lib/data/schedule";

// Always render from the live database; nothing here should be prerendered at build time.
export const dynamic = "force-dynamic";

export default async function NovelLayout({
  children,
  panel,
  params,
}: {
  children: React.ReactNode;
  /** Parallel route slot (`@panel`): the right-hand Command Center for the current route. */
  panel: React.ReactNode;
  params: Promise<{ novelId: string }>;
}) {
  const { novelId } = await params;
  const user = await requireUser("/novels/" + novelId);
  const [novel, novels, nodes, codexEntries, settings, bufferSummary] = await Promise.all([
    getNovel(novelId, user.id),
    listNovels(user.id),
    getBinderNodes(novelId),
    getCodexEntries(novelId),
    getSettings(user.id),
    // Not fetched at all without the plan for it: the pill it feeds links to a route that
    // would only redirect this writer to the pricing page.
    capabilitiesFor(user.plan as PlanId).buffer ? getBufferSummary(novelId) : Promise.resolve(undefined),
  ]);
  // getNovel is scoped to this writer, so a novel belonging to someone else is simply not
  // found here — which is the whole ownership check for every route under this layout.
  if (!novel) notFound();

  return (
    // The codex lives here, above both panels, so the editor's @ popover and the Codex tab
    // share one list: an entry created while writing shows up in the panel at once.
    <CodexProvider novelId={novel.id} entries={codexEntries}>
      <div className="flex h-dvh flex-col overflow-hidden">
        <AppHeader novel={{ id: novel.id, title: novel.title }} novels={novels} nodes={nodes} user={user} sweetSpotMin={settings.sweetSpotMin} />
        <RunBand
          novelId={novel.id}
          novelTitle={novel.title}
          nodes={nodes}
          sweetSpotMax={settings.sweetSpotMax}
          bufferSummary={bufferSummary}
        />
        <div className="min-h-0 flex-1">
          <WorkspaceShell binder={<Binder novelId={novel.id} nodes={nodes} />} panel={panel}>
            {children}
          </WorkspaceShell>
        </div>
      </div>
    </CodexProvider>
  );
}
