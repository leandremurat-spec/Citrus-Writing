import "server-only";

import { cache } from "react";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import type { Plan, PlanStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";

/**
 * Sessions: a row in the database, addressed by an opaque cookie.
 *
 * Two decisions worth keeping straight.
 *
 * **The row's id is a SHA-256 of the cookie's token, never the token.** A database that leaks
 * then hands an attacker a list of hashes, not a drawer of usable cookies — the same reason a
 * password is not stored in the clear. The hash is plain SHA-256 rather than scrypt because
 * the input is already 256 bits of CSPRNG output: there is nothing to brute-force, and a
 * memory-hard hash on every single request would only be a cost.
 *
 * **The expiry is absolute, not sliding.** Next only lets a cookie be written from a Server
 * Function or a Route Handler (see the cookies API docs), so a session read during an ordinary
 * page render *cannot* re-issue the cookie — a sliding window would need middleware, and
 * middleware here cannot reach Prisma. Rather than a window that slides only on the routes
 * that happen to mutate something, which is a confusing half-measure, a session simply lasts
 * thirty days from sign-in. `lastSeenAt` is still kept fresh, because the account page shows it
 * and because the DB row must not lapse before the cookie it backs does.
 */

const COOKIE_NAME = "cw_session";
const SESSION_DAYS = 30;
const SESSION_MS = SESSION_DAYS * 24 * 60 * 60 * 1000;
/** How stale `lastSeenAt` may get before a read bothers to write. */
const TOUCH_AFTER_MS = 60 * 60 * 1000;

export interface SessionUser {
  id: string;
  email: string;
  penName: string;
  plan: Plan;
  planStatus: PlanStatus;
  planRenewsAt: Date | null;
  hasPassword: boolean;
  notifyStale: boolean;
  stripeCustomerId: string | null;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Issues a session for a user and puts its cookie on the outgoing response.
 *
 * Only callable from a Server Function or a Route Handler — anywhere else, `cookies().set`
 * throws, which is the correct failure: a sign-in that could not set a cookie has not signed
 * anyone in.
 */
export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_MS);

  await prisma.session.create({ data: { id: hashToken(token), userId, expiresAt } });

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    // Lax rather than Strict so returning from an OAuth provider's redirect still carries the
    // cookie; Strict would drop it on that exact navigation and bounce the user to sign-in.
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

/** Ends this browser's session, in the database and in the cookie jar. */
export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (token) {
    // deleteMany, not delete: a cookie pointing at a row that is already gone is not an error.
    await prisma.session.deleteMany({ where: { id: hashToken(token) } });
  }
  store.delete(COOKIE_NAME);
}

/** Signs every one of a user's browsers out — used after a password change. */
export async function destroyAllSessions(userId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { userId } });
}

/**
 * The signed-in writer, or null.
 *
 * Wrapped in React's `cache` so a layout, its page and three server components asking the same
 * question during one render cost one query rather than five.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { id: hashToken(token) },
    select: {
      expiresAt: true,
      lastSeenAt: true,
      user: {
        select: {
          id: true,
          email: true,
          penName: true,
          plan: true,
          planStatus: true,
          planRenewsAt: true,
          passwordHash: true,
          notifyStale: true,
          stripeCustomerId: true,
        },
      },
    },
  });
  if (!session) return null;

  if (session.expiresAt.getTime() <= Date.now()) {
    // Expired: clear the row so it stops being looked up. The cookie cannot be deleted from
    // here (this runs during render), but it now points at nothing.
    await prisma.session.deleteMany({ where: { id: hashToken(token) } });
    return null;
  }

  if (Date.now() - session.lastSeenAt.getTime() > TOUCH_AFTER_MS) {
    await prisma.session.update({
      where: { id: hashToken(token) },
      data: { lastSeenAt: new Date(), expiresAt: new Date(Date.now() + SESSION_MS) },
    });
  }

  const { passwordHash, ...user } = session.user;
  return { ...user, hasPassword: passwordHash !== null };
});

/**
 * The signed-in writer, or a thrown redirect to sign-in.
 *
 * `next` carries where they were headed, so signing in lands them there instead of on the
 * library. The redirect is built here rather than at each call site so no route can forget it.
 */
export async function requireUser(nextPath?: string): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (user) return user;
  redirect(nextPath ? "/sign-in?next=" + encodeURIComponent(nextPath) : "/sign-in");
}

/** Drops session rows that have already expired. Called opportunistically on sign-in. */
export async function pruneExpiredSessions(): Promise<void> {
  await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
}
