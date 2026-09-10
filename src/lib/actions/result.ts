/** Shared return shape for server actions: errors come back as data, never as thrown exceptions. */
export type ActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };

export function fail(error: string): { ok: false; error: string } {
  return { ok: false, error };
}
