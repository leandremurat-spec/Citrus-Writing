import { redirect } from "next/navigation";

import { EmptyCanvas } from "@/components/canvas/empty-canvas";
import { ROOT, flattenTree, type ContainerRef } from "@/lib/binder/tree";
import { getBinderNodes, getLatestChapterId } from "@/lib/data/novels";

/** Reopens the chapter the author touched last, or offers to start one. */
export default async function NovelPage({ params }: { params: Promise<{ novelId: string }> }) {
  const { novelId } = await params;
  const latest = await getLatestChapterId(novelId);
  if (latest) redirect(`/novels/${novelId}/chapters/${latest}`);

  const nodes = await getBinderNodes(novelId);
  const firstArc = flattenTree(nodes).find((node) => node.type === "arc");
  const parent: ContainerRef = firstArc ? { kind: "arc", id: firstArc.id } : ROOT;

  return (
    <EmptyCanvas novelId={novelId} parent={parent} parentLabel={firstArc ? `“${firstArc.title}”` : "the novel root"} />
  );
}
