"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { Prisma } from "@/generated/prisma/client";
import { fail, type ActionResult } from "@/lib/actions/result";
import { authorizeNovel } from "@/lib/auth/guard";
import {
  applyMove,
  asContainer,
  canContain,
  childrenOf,
  findNode,
  suggestTitle,
  type BinderNode,
  type ContainerRef,
  type NodeType,
} from "@/lib/binder/tree";
import { getBinderNodes } from "@/lib/data/novels";
import { prisma } from "@/lib/db";

// ---------- schemas ----------

const idSchema = z.string().min(1);
const containerSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("root") }),
  z.object({ kind: z.literal("volume"), id: idSchema }),
  z.object({ kind: z.literal("arc"), id: idSchema }),
]);
const nodeTypeSchema = z.enum(["volume", "arc", "chapter"]);
const titleSchema = z.string().trim().min(1, "Give it a title.").max(200, "Keep the title under 200 characters.");

// ---------- helpers ----------

function messageOf(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function revalidateWorkspace() {
  revalidatePath("/", "layout");
}

/*
 * Every action below opens with `authorizeNovel`, which answers "is this novel this writer's"
 * — and answers "no such novel" the same way, so an id cannot be probed for existence.
 *
 * It replaced a bare `novelExists` check that three of these actions ran and the other three
 * skipped entirely: `moveNode` and `deleteNode` took a novelId and a nodeId and trusted both,
 * which was fine while the database held one writer's work and is not fine now.
 */

/** The foreign-key columns that express a node's parent, per node type. */
function placementColumns(type: NodeType, parent: ContainerRef) {
  if (type === "volume") return {};
  if (type === "arc") return { volumeId: parent.kind === "volume" ? parent.id : null };
  return {
    arcId: parent.kind === "arc" ? parent.id : null,
    volumeId: parent.kind === "volume" ? parent.id : null,
  };
}

async function persistPlacement(tx: Prisma.TransactionClient, node: BinderNode) {
  const data = { order: node.order, ...placementColumns(node.type, node.parent) };
  if (node.type === "volume") await tx.volume.update({ where: { id: node.id }, data });
  else if (node.type === "arc") await tx.arc.update({ where: { id: node.id }, data });
  else await tx.chapter.update({ where: { id: node.id }, data });
}

/** Next free position at the end of a container (tolerates gaps left by deletions). */
function nextOrder(nodes: readonly BinderNode[], container: ContainerRef): number {
  const siblings = childrenOf(nodes, container);
  return siblings.length ? Math.max(...siblings.map((sibling) => sibling.order)) + 1 : 0;
}

/** Confirms a container exists in this novel and may hold `childType`. */
function resolveContainer(
  nodes: readonly BinderNode[],
  container: ContainerRef,
  childType: NodeType,
): ContainerRef | null {
  if (!canContain(container, childType)) return null;
  if (container.kind === "root") return container;
  const node = findNode(nodes, container.id);
  return node && node.type === container.kind ? container : null;
}

// ---------- actions ----------

const moveSchema = z.object({
  novelId: idSchema,
  nodeId: idSchema,
  target: containerSchema,
  index: z.number().int().min(0),
});

export async function moveNode(input: z.input<typeof moveSchema>): Promise<ActionResult> {
  const parsed = moveSchema.safeParse(input);
  if (!parsed.success) return fail("That move could not be understood.");
  const { novelId, nodeId, target, index } = parsed.data;

  const auth = await authorizeNovel(novelId);
  if (!auth.ok) return auth;

  const nodes = await getBinderNodes(novelId);
  if (!findNode(nodes, nodeId)) return fail("That item no longer exists.");
  if (!resolveContainer(nodes, target, findNode(nodes, nodeId)!.type)) {
    return fail("That destination no longer exists.");
  }

  let changed: BinderNode[];
  try {
    ({ changed } = applyMove(nodes, nodeId, target, index));
  } catch (error) {
    return fail(messageOf(error, "That move is not allowed."));
  }

  if (changed.length > 0) {
    await prisma.$transaction(async (tx) => {
      for (const node of changed) await persistPlacement(tx, node);
    });
  }
  revalidateWorkspace();
  return { ok: true };
}

const createChapterSchema = z.object({
  novelId: idSchema,
  parent: containerSchema,
  title: titleSchema.optional(),
});

export async function createChapter(
  input: z.input<typeof createChapterSchema>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = createChapterSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid chapter.");
  const { novelId, title } = parsed.data;
  const auth = await authorizeNovel(novelId);
  if (!auth.ok) return auth;

  const nodes = await getBinderNodes(novelId);
  const parent = resolveContainer(nodes, parsed.data.parent, "chapter");
  if (!parent) return fail("That container no longer exists.");

  const chapter = await prisma.chapter.create({
    data: {
      novelId,
      title: title ?? suggestTitle(nodes, "chapter"),
      order: nextOrder(nodes, parent),
      ...placementColumns("chapter", parent),
    },
    select: { id: true },
  });
  revalidateWorkspace();
  return { ok: true, id: chapter.id };
}

const createArcSchema = z.object({
  novelId: idSchema,
  parent: containerSchema,
  title: titleSchema.optional(),
});

export async function createArc(input: z.input<typeof createArcSchema>): Promise<ActionResult<{ id: string }>> {
  const parsed = createArcSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid arc.");
  const { novelId, title } = parsed.data;
  const auth = await authorizeNovel(novelId);
  if (!auth.ok) return auth;

  const nodes = await getBinderNodes(novelId);
  const parent = resolveContainer(nodes, parsed.data.parent, "arc");
  if (!parent) return fail("Arcs can live at the novel root or inside a volume.");

  const arc = await prisma.arc.create({
    data: {
      novelId,
      title: title ?? suggestTitle(nodes, "arc"),
      order: nextOrder(nodes, parent),
      ...placementColumns("arc", parent),
    },
    select: { id: true },
  });
  revalidateWorkspace();
  return { ok: true, id: arc.id };
}

const createVolumeSchema = z.object({ novelId: idSchema, title: titleSchema.optional() });

export async function createVolume(
  input: z.input<typeof createVolumeSchema>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = createVolumeSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid volume.");
  const { novelId, title } = parsed.data;
  const auth = await authorizeNovel(novelId);
  if (!auth.ok) return auth;

  const nodes = await getBinderNodes(novelId);
  const volume = await prisma.volume.create({
    data: {
      novelId,
      title: title ?? suggestTitle(nodes, "volume"),
      order: nextOrder(nodes, { kind: "root" }),
    },
    select: { id: true },
  });
  revalidateWorkspace();
  return { ok: true, id: volume.id };
}

const renameSchema = z.object({ novelId: idSchema, type: nodeTypeSchema, id: idSchema, title: titleSchema });

export async function renameNode(input: z.input<typeof renameSchema>): Promise<ActionResult> {
  const parsed = renameSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid title.");
  const { novelId, type, id, title } = parsed.data;

  const auth = await authorizeNovel(novelId);
  if (!auth.ok) return auth;

  try {
    const where = { id, novelId };
    if (type === "volume") await prisma.volume.update({ where, data: { title } });
    else if (type === "arc") await prisma.arc.update({ where, data: { title } });
    else await prisma.chapter.update({ where, data: { title } });
  } catch {
    return fail("That item no longer exists.");
  }
  revalidateWorkspace();
  return { ok: true };
}

const deleteSchema = z.object({ novelId: idSchema, type: nodeTypeSchema, id: idSchema });

/**
 * Deletes a node. Chapters are removed for good. Deleting a volume or arc releases its
 * contents up one level, keeping their order, so no chapter is ever lost by accident.
 */
export async function deleteNode(input: z.input<typeof deleteSchema>): Promise<ActionResult> {
  const parsed = deleteSchema.safeParse(input);
  if (!parsed.success) return fail("That delete could not be understood.");
  const { novelId, type, id } = parsed.data;

  const auth = await authorizeNovel(novelId);
  if (!auth.ok) return auth;

  const nodes = await getBinderNodes(novelId);
  const node = findNode(nodes, id);
  if (!node || node.type !== type) return fail("That item no longer exists.");

  if (node.type === "chapter") {
    await prisma.chapter.delete({ where: { id } });
    revalidateWorkspace();
    return { ok: true };
  }

  // Move every direct child to the container's own parent, right after the container's slot.
  const own = asContainer(node)!;
  const position = childrenOf(nodes, node.parent).findIndex((sibling) => sibling.id === id);
  let working: BinderNode[] = nodes;
  const changed = new Map<string, BinderNode>();
  childrenOf(nodes, own).forEach((child, offset) => {
    const result = applyMove(working, child.id, node.parent, position + 1 + offset);
    working = result.nodes;
    for (const entry of result.changed) changed.set(entry.id, entry);
  });

  await prisma.$transaction(async (tx) => {
    for (const entry of changed.values()) {
      if (entry.id !== id) await persistPlacement(tx, entry);
    }
    if (node.type === "arc") await tx.arc.delete({ where: { id } });
    else await tx.volume.delete({ where: { id } });
  });
  revalidateWorkspace();
  return { ok: true };
}
