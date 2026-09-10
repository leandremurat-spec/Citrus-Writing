import { notFound, redirect } from "next/navigation";

import { BufferBoard } from "@/components/schedule/buffer-board";
import { requireUser } from "@/lib/auth/session";
import { capabilitiesFor, type PlanId } from "@/lib/billing/plans";
import { getNovel } from "@/lib/data/novels";
import { getScheduleBoard } from "@/lib/data/schedule";

export const dynamic = "force-dynamic";

/** The Buffer: the release schedule, replacing the run band and the Command Centre with the
    calendar and the bench, the same way the Codex replaces them with its list and detail. */
export default async function BufferPage({ params }: { params: Promise<{ novelId: string }> }) {
  const { novelId } = await params;
  const user = await requireUser("/novels/" + novelId + "/buffer");

  // The Buffer is the headline Serial feature, so the route itself refuses rather than
  // rendering a board full of locked controls. The Library and the run band both link here
  // only for writers who can use it; this is the check that holds if one is ever reached
  // another way.
  if (!capabilitiesFor(user.plan as PlanId).buffer) redirect("/pricing?from=buffer");

  const [novel, board] = await Promise.all([getNovel(novelId, user.id), getScheduleBoard(novelId)]);
  if (!novel) notFound();

  return <BufferBoard novelId={novelId} novelTitle={novel.title} board={board} />;
}
