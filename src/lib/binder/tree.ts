/**
 * Pure helpers for the Serial Binder tree. No React and no database access: the server
 * actions use these to recompute `order` values, and the client uses the very same functions
 * to update its optimistic copy, so both sides always agree on the result of a move.
 *
 * Hierarchy: Novel root → (Volume?) → (Arc?) → Chapter.
 *   - volumes live only at the root
 *   - arcs live at the root or inside a volume
 *   - chapters live anywhere (arcs are the recommended home)
 * `order` positions a node among all siblings of its container, regardless of type.
 */

export type NodeType = "volume" | "arc" | "chapter";
export type ChapterStatus = "DRAFT" | "EDITED" | "QUEUED" | "PUBLISHED";

export type ContainerRef =
  | { kind: "root" }
  | { kind: "volume"; id: string }
  | { kind: "arc"; id: string };

export interface BinderNode {
  type: NodeType;
  id: string;
  title: string;
  order: number;
  parent: ContainerRef;
  /** Chapter-only. */
  status?: ChapterStatus;
  /** Chapter-only. */
  wordCount?: number;
}

export interface FlatNode extends BinderNode {
  depth: number;
  /** True when the node is a container with at least one child in the full tree. */
  hasChildren: boolean;
}

export const ROOT: ContainerRef = { kind: "root" };

export function containerKey(container: ContainerRef): string {
  return container.kind === "root" ? "root" : `${container.kind}:${container.id}`;
}

export function sameContainer(a: ContainerRef, b: ContainerRef): boolean {
  return containerKey(a) === containerKey(b);
}

/** The container a node represents, or null for chapters, which are leaves. */
export function asContainer(node: Pick<BinderNode, "type" | "id">): ContainerRef | null {
  if (node.type === "volume") return { kind: "volume", id: node.id };
  if (node.type === "arc") return { kind: "arc", id: node.id };
  return null;
}

export function canContain(container: ContainerRef, childType: NodeType): boolean {
  if (container.kind === "root") return true;
  if (container.kind === "volume") return childType !== "volume";
  return childType === "chapter";
}

const TYPE_RANK: Record<NodeType, number> = { volume: 0, arc: 1, chapter: 2 };

function compareSiblings(a: BinderNode, b: BinderNode): number {
  return a.order - b.order || TYPE_RANK[a.type] - TYPE_RANK[b.type] || a.title.localeCompare(b.title);
}

/** Groups nodes by their container key, each group sorted in display order. */
export function groupByContainer(nodes: readonly BinderNode[]): Map<string, BinderNode[]> {
  const groups = new Map<string, BinderNode[]>();
  for (const node of nodes) {
    const key = containerKey(node.parent);
    const group = groups.get(key);
    if (group) group.push(node);
    else groups.set(key, [node]);
  }
  for (const group of groups.values()) group.sort(compareSiblings);
  return groups;
}

export function childrenOf(nodes: readonly BinderNode[], container: ContainerRef): BinderNode[] {
  return nodes.filter((node) => sameContainer(node.parent, container)).sort(compareSiblings);
}

export function findNode(nodes: readonly BinderNode[], id: string): BinderNode | undefined {
  return nodes.find((node) => node.id === id);
}

/** Ids of every container between `container` and the root, starting with `container` itself. */
export function ancestorIds(nodes: readonly BinderNode[], container: ContainerRef): string[] {
  const ids: string[] = [];
  let current = container;
  while (current.kind !== "root") {
    ids.push(current.id);
    const node = findNode(nodes, current.id);
    if (!node) break;
    current = node.parent;
  }
  return ids;
}

export interface FlattenOptions {
  /** Container keys whose children are hidden. */
  collapsed?: ReadonlySet<string>;
  /** Hide the descendants of this node while keeping the node itself (used during a drag). */
  hideChildrenOf?: string | null;
}

/** Depth-first, display-ordered list of the visible nodes. */
export function flattenTree(nodes: readonly BinderNode[], options: FlattenOptions = {}): FlatNode[] {
  const groups = groupByContainer(nodes);
  const result: FlatNode[] = [];

  const visit = (container: ContainerRef, depth: number) => {
    for (const node of groups.get(containerKey(container)) ?? []) {
      const own = asContainer(node);
      const hasChildren = own ? (groups.get(containerKey(own))?.length ?? 0) > 0 : false;
      result.push({ ...node, depth, hasChildren });
      if (!own || !hasChildren) continue;
      if (options.collapsed?.has(containerKey(own))) continue;
      if (options.hideChildrenOf === node.id) continue;
      visit(own, depth + 1);
    }
  };

  visit(ROOT, 0);
  return result;
}

/**
 * Every chapter under `container`, at any depth. Volumes and arcs show the sum of these as
 * their word count, so a writer can see how big an arc is without expanding it.
 */
export function descendantChapters(nodes: readonly BinderNode[], container: ContainerRef): BinderNode[] {
  const groups = groupByContainer(nodes);
  const found: BinderNode[] = [];

  const visit = (from: ContainerRef) => {
    for (const node of groups.get(containerKey(from)) ?? []) {
      if (node.type === "chapter") found.push(node);
      else {
        const own = asContainer(node);
        if (own) visit(own);
      }
    }
  };

  visit(container);
  return found;
}

/**
 * Every chapter's run number, by id.
 *
 * The run number is a chapter's position in the *serial* — global across every volume and arc
 * break, and never stored. It is document order and nothing else, which is why this is one
 * line: the ordering work has already been done by `flattenTree`.
 *
 * It lives here rather than in the components that show it because three of them now do — the
 * Run band, the Binder's active row badge, and the Export dialog's chapter list — and a
 * numbering that disagreed between the strand and the export would be a real bug in a serial
 * author's workflow.
 */
export function runNumbers(nodes: readonly BinderNode[]): Map<string, number> {
  const numbers = new Map<string, number>();
  let position = 0;
  for (const node of flattenTree(nodes)) {
    if (node.type === "chapter") numbers.set(node.id, ++position);
  }
  return numbers;
}

export interface MoveResult {
  nodes: BinderNode[];
  /** Nodes whose `parent` or `order` changed; the server persists exactly these. */
  changed: BinderNode[];
}

/**
 * Moves a node into `target` at `index` (position among the target's children, not counting
 * the moved node itself), then renumbers both the target and the source containers.
 */
export function applyMove(
  nodes: readonly BinderNode[],
  nodeId: string,
  target: ContainerRef,
  index: number,
): MoveResult {
  const node = findNode(nodes, nodeId);
  if (!node) throw new Error("That item no longer exists.");
  if (!canContain(target, node.type)) {
    throw new Error(`A ${node.type} cannot be placed inside ${describeContainer(target)}.`);
  }
  if (target.kind !== "root" && ancestorIds(nodes, target).includes(nodeId)) {
    throw new Error("A container cannot be moved inside itself.");
  }

  const copies = new Map(nodes.map((n) => [n.id, { ...n }]));
  const changed = new Map<string, BinderNode>();

  const renumber = (container: ContainerRef, ordered: readonly BinderNode[]) => {
    ordered.forEach((sibling, position) => {
      const copy = copies.get(sibling.id);
      if (!copy) return;
      if (copy.order !== position || !sameContainer(copy.parent, container)) {
        copy.order = position;
        copy.parent = container;
        changed.set(copy.id, copy);
      }
    });
  };

  const targetSiblings = childrenOf(nodes, target).filter((n) => n.id !== nodeId);
  const position = Math.max(0, Math.min(index, targetSiblings.length));
  targetSiblings.splice(position, 0, node);
  renumber(target, targetSiblings);

  if (!sameContainer(node.parent, target)) {
    renumber(node.parent, childrenOf(nodes, node.parent).filter((n) => n.id !== nodeId));
  }

  return { nodes: [...copies.values()], changed: [...changed.values()] };
}

export interface Projection {
  depth: number;
  parent: ContainerRef;
  /** Position among the parent's children, not counting the dragged node. */
  index: number;
}

function arrayMove<T>(items: readonly T[], from: number, to: number): T[] {
  const next = items.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/**
 * Where a dragged node would land if dropped now. Horizontal drag distance nudges the depth
 * (indent to nest inside the item above, outdent to leave a container); the result is clamped
 * to depths that are structurally possible and type-legal.
 */
export function getProjection(
  items: readonly FlatNode[],
  activeId: string,
  overId: string,
  dragOffsetX: number,
  indentationWidth: number,
): Projection | null {
  const overIndex = items.findIndex((item) => item.id === overId);
  const activeIndex = items.findIndex((item) => item.id === activeId);
  if (overIndex < 0 || activeIndex < 0) return null;

  const active = items[activeIndex];
  const ordered = arrayMove(items, activeIndex, overIndex);
  const previous = ordered[overIndex - 1];
  const next = ordered[overIndex + 1];

  const maxDepth = previous ? (asContainer(previous) ? previous.depth + 1 : previous.depth) : 0;
  const minDepth = next ? Math.min(next.depth, maxDepth) : 0;
  const wanted = active.depth + Math.round(dragOffsetX / indentationWidth);
  const preferred = Math.max(minDepth, Math.min(wanted, maxDepth));

  // Try the preferred depth first, then progressively shallower, then deeper.
  const candidates = [preferred];
  for (let d = preferred - 1; d >= minDepth; d--) candidates.push(d);
  for (let d = preferred + 1; d <= maxDepth; d++) candidates.push(d);

  for (const depth of candidates) {
    const parent = parentAtDepth(ordered, overIndex, depth);
    if (!parent || !canContain(parent, active.type)) continue;
    let index = 0;
    for (let i = overIndex - 1; i >= 0; i--) {
      if (ordered[i].depth < depth) break;
      if (ordered[i].depth === depth) index++;
    }
    return { depth, parent, index };
  }
  return null;
}

function parentAtDepth(ordered: readonly FlatNode[], position: number, depth: number): ContainerRef | null {
  if (depth === 0) return ROOT;
  for (let i = position - 1; i >= 0; i--) {
    const item = ordered[i];
    if (item.depth === depth - 1) return asContainer(item);
    if (item.depth < depth - 1) return null;
  }
  return null;
}

export function describeContainer(container: ContainerRef): string {
  if (container.kind === "root") return "the novel root";
  return container.kind === "volume" ? "a volume" : "an arc";
}

/** "Chapter 12", "Arc 3", "Volume 2": numbered across the whole novel, the way serials count. */
export function suggestTitle(nodes: readonly BinderNode[], type: NodeType): string {
  const count = nodes.filter((node) => node.type === type).length;
  const label = type === "chapter" ? "Chapter" : type === "arc" ? "Arc" : "Volume";
  return `${label} ${count + 1}`;
}

export const NODE_TYPE_LABEL: Record<NodeType, string> = {
  volume: "Volume",
  arc: "Arc",
  chapter: "Chapter",
};
