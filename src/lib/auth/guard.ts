import "server-only";

import { fail } from "@/lib/actions/result";
import type { PlanCapabilities, PlanId } from "@/lib/billing/plans";
import { capabilitiesFor } from "@/lib/billing/plans";
import { prisma } from "@/lib/db";

import { getCurrentUser, type SessionUser } from "./session";

/**
 * The authorization layer every server action goes through.
 *
 * Two things are being defended, and they are different. **Ownership** — is this novel this
 * writer's? — is a security question, and getting it wrong hands one writer another's
 * manuscript. **Plan** — may this writer use the Buffer? — is a product question, and getting
 * it wrong gives away a paid feature. Both are checked on the server, in the action, never
 * only in the component that renders the button: a disabled button is a courtesy, not a
 * control.
 *
 * The pattern is deliberately uniform. An action opens with one `await authorizeNovel(id)`,
 * gets back either a failure it can return verbatim or the user and their capabilities, and
 * has no other authorization code in it. Anything that needs a novel is unreachable without
 * passing through here.
 */

export interface Authorized {
  ok: true;
  user: SessionUser;
  capabilities: PlanCapabilities;
}

type Denied = { ok: false; error: string };

/** The signed-in writer, or a failure the caller can return as-is. */
export async function authorize(): Promise<Authorized | Denied> {
  const user = await getCurrentUser();
  if (!user) return fail("You are not signed in.");
  return { ok: true, user, capabilities: capabilitiesFor(user.plan as PlanId) };
}

/**
 * The signed-in writer, provided they own this novel.
 *
 * "No such novel" and "not yours" deliberately return the same message. Distinguishing them
 * would let anyone with an id confirm that it exists and belongs to someone.
 */
export async function authorizeNovel(novelId: string): Promise<Authorized | Denied> {
  const auth = await authorize();
  if (!auth.ok) return auth;

  const count = await prisma.novel.count({ where: { id: novelId, userId: auth.user.id } });
  if (count === 0) return fail("That serial could not be found.");
  return auth;
}

/** The same, reached through a chapter rather than its novel. */
export async function authorizeChapter(chapterId: string): Promise<(Authorized & { novelId: string }) | Denied> {
  const auth = await authorize();
  if (!auth.ok) return auth;

  const chapter = await prisma.chapter.findFirst({
    where: { id: chapterId, novel: { userId: auth.user.id } },
    select: { novelId: true },
  });
  if (!chapter) return fail("That chapter could not be found.");
  return { ...auth, novelId: chapter.novelId };
}

/** The same again, reached through a codex entry. */
export async function authorizeCodexEntry(entryId: string): Promise<(Authorized & { novelId: string }) | Denied> {
  const auth = await authorize();
  if (!auth.ok) return auth;

  const entry = await prisma.codexEntry.findFirst({
    where: { id: entryId, novel: { userId: auth.user.id } },
    select: { novelId: true },
  });
  if (!entry) return fail("That codex entry could not be found.");
  return { ...auth, novelId: entry.novelId };
}

/** And through a tie, which is the only handle a delete has to work from. */
export async function authorizeCodexTie(tieId: string): Promise<(Authorized & { novelId: string }) | Denied> {
  const auth = await authorize();
  if (!auth.ok) return auth;

  const tie = await prisma.codexTie.findFirst({
    where: { id: tieId, novel: { userId: auth.user.id } },
    select: { novelId: true },
  });
  if (!tie) return fail("That tie could not be found.");
  return { ...auth, novelId: tie.novelId };
}

/** Ownership as a plain boolean, for pages that want `notFound()` rather than a message. */
export async function ownsNovel(userId: string, novelId: string): Promise<boolean> {
  return (await prisma.novel.count({ where: { id: novelId, userId } })) > 0;
}

/**
 * Refuses an action that the writer's plan does not include.
 *
 * The message names the plan rather than saying "upgrade required", because a writer who has
 * just been stopped wants to know what would unstop them.
 */
export function requireCapability(
  auth: Authorized,
  capability: "buffer" | "codexTies",
  what: string,
): Denied | null {
  if (auth.capabilities[capability]) return null;
  return fail(what + " is part of the Serial plan.");
}
