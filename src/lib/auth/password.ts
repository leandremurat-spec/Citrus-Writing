import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

import { MIN_PASSWORD_LENGTH } from "./password-rules";

/**
 * Password hashing, on nothing but `node:crypto`.
 *
 * No `server-only` guard on this module, deliberately: `prisma/seed.ts` runs it outside Next
 * to hash the demo account password, and that package throws anywhere the react-server
 * condition is absent. Nothing is lost — the module imports `node:crypto`, which no browser
 * bundle can resolve, so importing it from a client component fails at build time regardless.
 *
 * scrypt rather than bcrypt or argon2 for a reason this project has hit before: every native
 * hashing package ships prebuilt binaries that skip Windows on ARM64, and building one from
 * source is the same dead end that pushed the database onto `node:sqlite` (see CLAUDE.md,
 * "Environment quirks"). scrypt is in the standard library, is memory-hard, and is what
 * `crypto.scrypt` is for.
 *
 * The stored string carries its own parameters — `scrypt$N$r$p$salt$hash` — so raising the
 * cost later re-verifies old hashes correctly instead of locking everyone out. `needsRehash`
 * is how a login notices it is holding an old one.
 */

const scrypt = promisify(scryptCb) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

const N = 1 << 15; // 32768 — ~64 MB at r=8, the OWASP floor for scrypt.
const R = 8;
const P = 1;
const KEY_LENGTH = 32;
const SALT_LENGTH = 16;
/* Node's default maxmem is 32 MB, which N=32768 exceeds; without this every hash throws. */
const MAX_MEM = 256 * 1024 * 1024;

export { MIN_PASSWORD_LENGTH };

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const derived = await scrypt(password, salt, KEY_LENGTH, { N, r: R, p: P, maxmem: MAX_MEM });
  return ["scrypt", N, R, P, salt.toString("base64url"), derived.toString("base64url")].join("$");
}

/**
 * Constant-time verification. Returns false rather than throwing on a malformed stored value:
 * a corrupt row should fail the login, not crash the sign-in route.
 */
export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  if (!stored) return false;
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;

  const [, n, r, p, saltB64, hashB64] = parts;
  const cost = { N: Number(n), r: Number(r), p: Number(p), maxmem: MAX_MEM };
  if (!Number.isInteger(cost.N) || !Number.isInteger(cost.r) || !Number.isInteger(cost.p)) return false;

  const expected = Buffer.from(hashB64, "base64url");
  let derived: Buffer;
  try {
    derived = await scrypt(password, Buffer.from(saltB64, "base64url"), expected.length, cost);
  } catch {
    return false;
  }
  // Lengths are equal by construction above, but timingSafeEqual throws if they ever are not.
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

/** True when a stored hash was made with parameters weaker than the ones in use now. */
export function needsRehash(stored: string | null): boolean {
  if (!stored) return false;
  const [scheme, n, r, p] = stored.split("$");
  return scheme !== "scrypt" || Number(n) < N || Number(r) < R || Number(p) < P;
}

/**
 * Burns roughly one verification's worth of time against a throwaway hash.
 *
 * Sign-in calls this when the email matches nobody. Without it, "no such user" returns in
 * microseconds while "wrong password" takes the full scrypt cost, and the difference is a
 * usable oracle for enumerating which addresses hold accounts.
 */
export async function burnVerificationTime(): Promise<void> {
  await verifyPassword("citrus-writing-timing-equaliser", DUMMY_HASH);
}

/* A fixed hash of a fixed string. Precomputed rather than generated at import time, so the
   module has no top-level await and no startup cost. */
const DUMMY_HASH =
  "scrypt$32768$8$1$Y2l0cnVzLXdyaXRpbmctc2FsdA$" +
  "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
