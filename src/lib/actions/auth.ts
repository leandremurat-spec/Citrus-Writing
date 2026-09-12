"use server";

import { createHash, randomBytes } from "node:crypto";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";

import { fail, type ActionResult } from "@/lib/actions/result";
import {
  burnVerificationTime,
  hashPassword,
  MIN_PASSWORD_LENGTH,
  needsRehash,
  verifyPassword,
} from "@/lib/auth/password";
import {
  createSession,
  destroyAllSessions,
  destroySession,
  getCurrentUser,
  pruneExpiredSessions,
} from "@/lib/auth/session";
import { clientIp, isLimited, record } from "@/lib/auth/rate-limit";
import { prisma } from "@/lib/db";
import { passwordResetEmail } from "@/lib/mail/messages";
import { deliver, type Delivery } from "@/lib/mail/send";

/**
 * Sign-up, sign-in and account maintenance.
 *
 * Every one of these returns an `ActionResult` rather than throwing, like the rest of the
 * app's actions — a wrong password is data, not an exception.
 *
 * The one rule worth stating out loud: **nothing here ever tells an anonymous caller whether
 * an address has an account.** Sign-in answers the same way for "no such user" and "wrong
 * password", and takes the same amount of time doing it (see `burnVerificationTime`). Sign-up
 * is the unavoidable exception — it has to refuse a duplicate — so it says so plainly rather
 * than pretending to succeed.
 */

const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, "That email address is too long.")
  .pipe(z.email("That does not look like an email address."));

const passwordField = z
  .string()
  .min(MIN_PASSWORD_LENGTH, "Use at least " + MIN_PASSWORD_LENGTH + " characters.")
  .max(200, "That password is too long.");

const penNameField = z
  .string()
  .trim()
  .min(1, "Your readers need something to call you.")
  .max(80, "Keep the pen name under 80 characters.");

const signUpSchema = z.object({
  penName: penNameField,
  email: emailField,
  password: passwordField,
  notifyStale: z.boolean().default(false),
});

/**
 * Creates an account, its settings row, and a session — then hands back to the caller, which
 * routes to the Library. The first *serial* is deliberately not created here: the Library's
 * own welcome asks for a title, and `createNovel` already lays down the Arc 1 and Chapter 1
 * the sign-up screen promises. An "Untitled serial" nobody asked for is worse than one screen.
 */
export async function signUp(input: z.input<typeof signUpSchema>): Promise<ActionResult<{ userId: string }>> {
  /*
   * Per-IP only. There is no third party to protect here — an address either is taken or is
   * not, and the duplicate check has to say so — so the thing worth limiting is one origin
   * manufacturing accounts, which is what a per-email rule cannot see at all.
   */
  const signUpFrom = clientIp(await headers());
  if (await isLimited("signUpIp", signUpFrom)) {
    return fail("Too many accounts created from here. Wait a while and try again.");
  }

  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the form and try again.");
  const data = parsed.data;

  const passwordHash = await hashPassword(data.password);

  let userId: string;
  try {
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: data.email,
          penName: data.penName,
          passwordHash,
          notifyStale: data.notifyStale,
        },
        select: { id: true },
      });
      await tx.authorSettings.create({ data: { userId: created.id } });
      return created;
    });
    userId = user.id;
  } catch {
    // The unique index on email is the only thing that realistically fails here, and it is
    // the race a "does this email exist" pre-check could never close anyway.
    return fail("There is already an account with that email. Sign in instead.");
  }

  // Counted on success rather than on every call: a refused duplicate is someone mistyping
  // which account they already have, and should not spend the allowance.
  await record("signUpIp", signUpFrom);

  await createSession(userId);
  revalidatePath("/", "layout");
  return { ok: true, userId };
}

const signInSchema = z.object({
  email: emailField,
  password: z.string().min(1, "Enter your password."),
});

export async function signIn(input: z.input<typeof signInSchema>): Promise<ActionResult> {
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the form and try again.");

  /*
   * The limit is checked before anything is looked up, and recorded only when the attempt
   * fails. Signing in correctly never counts against you, which is what separates a defence
   * from a quota — a writer with the app open on two machines should never meet this.
   *
   * Saying "too many attempts" plainly is deliberate, and does not leak: it is true whether or
   * not the address exists, because a failure against a non-existent account is counted exactly
   * like one against a real one.
   */
  const ip = clientIp(await headers());
  if ((await isLimited("signInEmail", parsed.data.email)) || (await isLimited("signInIp", ip))) {
    return fail("Too many sign-in attempts. Wait a few minutes and try again.");
  }

  const failed = async () => {
    await record("signInEmail", parsed.data.email);
    await record("signInIp", ip);
    return fail("That email and password do not match an account.");
  };

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true, passwordHash: true },
  });

  if (!user || !user.passwordHash) {
    // No account, or an account that has only ever used a provider. Both spend the same time
    // as a real failed verification, so the two cannot be told apart from outside.
    await burnVerificationTime();
    return failed();
  }

  if (!(await verifyPassword(parsed.data.password, user.passwordHash))) {
    return failed();
  }

  // Right password, hash made under weaker parameters than today's: upgrade it in place while
  // we are holding the plaintext, which is the only moment it can be done.
  if (needsRehash(user.passwordHash)) {
    const upgraded = await hashPassword(parsed.data.password);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: upgraded } });
  }

  await pruneExpiredSessions();
  await createSession(user.id);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function signOut(): Promise<ActionResult> {
  await destroySession();
  revalidatePath("/", "layout");
  return { ok: true };
}

const profileSchema = z.object({
  penName: penNameField,
  email: emailField,
  notifyStale: z.boolean(),
});

export async function updateProfile(input: z.input<typeof profileSchema>): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return fail("You are not signed in.");

  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the form and try again.");

  try {
    await prisma.user.update({ where: { id: user.id }, data: parsed.data });
  } catch {
    return fail("That email is already in use on another account.");
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

const passwordSchema = z
  .object({
    /** Empty for an account that has never had one — a provider sign-in adding a password. */
    currentPassword: z.string().default(""),
    newPassword: passwordField,
  })
  .refine((value) => value.currentPassword !== value.newPassword, {
    message: "That is the password you already have.",
    path: ["newPassword"],
  });

/**
 * Sets or changes the password, then signs every *other* browser out.
 *
 * The order matters: all sessions are dropped and a fresh one issued for this browser, so a
 * password changed because someone else has it actually evicts them, without logging the
 * person doing the changing out of the page they are standing on.
 */
export async function changePassword(input: z.input<typeof passwordSchema>): Promise<ActionResult> {
  const current = await getCurrentUser();
  if (!current) return fail("You are not signed in.");

  const parsed = passwordSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the form and try again.");

  const row = await prisma.user.findUnique({ where: { id: current.id }, select: { passwordHash: true } });
  if (!row) return fail("That account no longer exists.");

  if (row.passwordHash && !(await verifyPassword(parsed.data.currentPassword, row.passwordHash))) {
    return fail("That is not your current password.");
  }

  const passwordHash = await hashPassword(parsed.data.newPassword);
  await prisma.user.update({ where: { id: current.id }, data: { passwordHash } });

  await destroyAllSessions(current.id);
  await createSession(current.id);
  revalidatePath("/", "layout");
  return { ok: true };
}

const deleteSchema = z.object({ confirmEmail: z.string() });

/**
 * Deletes the account and everything under it.
 *
 * `User` cascades to novels, and a novel cascades to its volumes, arcs, chapters, snapshots,
 * codex and days — so this is strictly more destructive than `deleteNovel`, which already
 * makes a writer type the title. It asks for the email address for the same reason and checks
 * it on the server: a dialog that can be clicked through is not a confirmation.
 */
export async function deleteAccount(input: z.input<typeof deleteSchema>): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return fail("You are not signed in.");

  const parsed = deleteSchema.safeParse(input);
  if (!parsed.success) return fail("That request could not be understood.");

  const same = (value: string) => value.trim().toLocaleLowerCase();
  if (same(parsed.data.confirmEmail) !== same(user.email)) {
    return fail("That email did not match, so nothing was deleted.");
  }

  await destroySession();
  await prisma.user.delete({ where: { id: user.id } });
  revalidatePath("/", "layout");
  return { ok: true };
}

// ---------------------------------------------------------------- resets ---

/**
 * "Forgotten it?"
 *
 * Two rules shape everything here.
 *
 * **The response never reveals whether the address has an account.** Requesting a reset for an
 * unknown address returns exactly the same success as requesting one for a real account, and
 * does the same amount of work. Anything else turns this form into a way to enumerate the
 * user table, which is worse than the inconvenience it saves.
 *
 * **The token is emailed, and only its hash is stored** — the same shape as a session cookie,
 * for the same reason. Consuming one marks it used and drops every other outstanding reset for
 * that account, so a second link in an old email cannot be redeemed afterwards.
 */

const RESET_TTL_MS = 30 * 60 * 1000;

function resetId(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

const requestResetSchema = z.object({ email: emailField, origin: z.string().url() });

export async function requestPasswordReset(
  input: z.input<typeof requestResetSchema>,
): Promise<ActionResult<{ delivery: Delivery["kind"] }>> {
  const parsed = requestResetSchema.safeParse(input);
  // Even a malformed address gets the neutral answer: "that is not an email" is fine to say,
  // but nothing beyond it.
  if (!parsed.success) return fail("That does not look like an email address.");

  /*
   * Two limits, answered differently, and the difference is the point.
   *
   * The per-IP one is about the requester, so it can be refused out loud — it says nothing
   * about any address.
   *
   * The per-email one is about the *target*, and saying "that address has had too many resets"
   * would announce that the address exists, undoing the neutral answer this action is built
   * around. So it returns the same cheerful success as everything else and quietly sends
   * nothing. A person resetting their own password three times in an hour has their mail
   * already; someone burying a stranger's inbox gets no signal at all.
   */
  const ip = clientIp(await headers());
  if (await isLimited("resetIp", ip)) {
    return fail("Too many reset requests. Wait a while and try again.");
  }
  if (await isLimited("resetEmail", parsed.data.email)) {
    return { ok: true, delivery: "sent" };
  }
  await record("resetIp", ip);
  await record("resetEmail", parsed.data.email);

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email }, select: { id: true } });
  if (!user) return { ok: true, delivery: "sent" };

  await prisma.passwordReset.deleteMany({ where: { userId: user.id, usedAt: null } });

  const token = randomBytes(32).toString("base64url");
  await prisma.passwordReset.create({
    data: { id: resetId(token), userId: user.id, expiresAt: new Date(Date.now() + RESET_TTL_MS) },
  });

  const link = parsed.data.origin + "/reset?token=" + token;
  // The origin goes to the template too, not only into the link: a message sent from a preview
  // deployment should point its mark and its footer at that deployment rather than at the live
  // site, which is the one way to notice you tested the wrong one.
  const delivery = await deliver({ to: parsed.data.email, ...passwordResetEmail(link, parsed.data.origin) });

  if (delivery.kind === "failed") return fail("The email could not be sent: " + delivery.reason + ".");
  return { ok: true, delivery: delivery.kind };
}

const completeResetSchema = z.object({ token: z.string().min(1), newPassword: passwordField });

export async function completePasswordReset(
  input: z.input<typeof completeResetSchema>,
): Promise<ActionResult> {
  const parsed = completeResetSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the form and try again.");

  const row = await prisma.passwordReset.findUnique({
    where: { id: resetId(parsed.data.token) },
    select: { id: true, userId: true, expiresAt: true, usedAt: true },
  });
  if (!row || row.usedAt || row.expiresAt.getTime() <= Date.now()) {
    return fail("That link has already been used or has expired. Ask for a new one.");
  }

  const passwordHash = await hashPassword(parsed.data.newPassword);
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: row.userId }, data: { passwordHash } });
    await tx.passwordReset.update({ where: { id: row.id }, data: { usedAt: new Date() } });
    // Any other outstanding link is now stale, and so is every signed-in browser: a reset is
    // exactly the moment someone else's session has to end.
    await tx.passwordReset.deleteMany({ where: { userId: row.userId, usedAt: null } });
    await tx.session.deleteMany({ where: { userId: row.userId } });
  });

  await createSession(row.userId);
  revalidatePath("/", "layout");
  return { ok: true };
}
