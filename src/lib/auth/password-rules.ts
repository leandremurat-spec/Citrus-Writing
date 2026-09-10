/**
 * The one password rule, in a module a browser can import.
 *
 * It lives apart from `password.ts` because that file imports `node:crypto`, which no client
 * bundle can resolve — and the sign-up form has to know the minimum in order to draw the
 * strength meter and say "12 characters" in its placeholder. Server and client therefore read
 * the same number rather than each holding a copy that can drift.
 *
 * Twelve, and nothing else. No character-class rules: they push people toward `Passw0rd!` and
 * away from the long passphrase that is actually harder to guess.
 */
export const MIN_PASSWORD_LENGTH = 12;
