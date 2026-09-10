/**
 * Validates a `?next=` destination before anything is redirected to it.
 *
 * An open redirect is the classic way a sign-in page becomes a phishing tool: land someone on
 * `/sign-in?next=https://not-citrus.example`, let them sign in for real, and bounce them
 * somewhere that asks for the password again. So a destination is only honoured when it is
 * unambiguously a path inside this app.
 *
 * Both leading-slash checks matter. `//evil.example` is a protocol-relative URL — a browser
 * treats it as another origin, and it starts with a slash, so testing only the first character
 * lets it straight through. A backslash is rejected for the same reason: some browsers have
 * normalised `/\evil.example` the same way.
 */
export function safeNext(value: string | undefined | null, fallback: string): string {
  if (!value) return fallback;
  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//") || value.startsWith("/\\")) return fallback;
  return value;
}
