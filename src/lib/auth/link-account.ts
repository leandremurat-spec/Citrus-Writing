import "server-only";

import { prisma } from "@/lib/db";

import type { ProviderId, ProviderProfile } from "./oauth";

/**
 * Turns a verified provider profile into a user id, in the three cases that can arise.
 *
 * 1. **The provider account is already linked** — sign that user in. The provider's id is the
 *    key, not the email, so a writer who changes their Google address stays the same account.
 * 2. **The email belongs to an existing account** — link the provider to it. This is the step
 *    that has to be earned: it is only safe because `fetchProfile` refuses an unverified
 *    address for either provider, so nobody can claim an email they do not control.
 * 3. **Neither** — create the account, with no password. `hasPassword` is false for such a
 *    writer, which is why the account page offers "set a password" rather than "change" it.
 */
export async function linkOrCreateUser(provider: ProviderId, profile: ProviderProfile): Promise<string> {
  const email = profile.email.trim().toLowerCase();

  const existingLink = await prisma.oAuthAccount.findUnique({
    where: { provider_providerAccountId: { provider, providerAccountId: profile.accountId } },
    select: { userId: true },
  });
  if (existingLink) return existingLink.userId;

  const byEmail = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (byEmail) {
    await prisma.oAuthAccount.create({
      data: { userId: byEmail.id, provider, providerAccountId: profile.accountId },
    });
    return byEmail.id;
  }

  const created = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { email, penName: profile.name.slice(0, 80) || email.split("@")[0] },
      select: { id: true },
    });
    await tx.authorSettings.create({ data: { userId: user.id } });
    await tx.oAuthAccount.create({
      data: { userId: user.id, provider, providerAccountId: profile.accountId },
    });
    return user;
  });
  return created.id;
}
