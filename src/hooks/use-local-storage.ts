"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * A localStorage-backed string value that is safe to render on the server: the server
 * snapshot is always `null`, and the client swaps in the stored value right after hydration.
 */
const listeners = new Set<() => void>();

function subscribe(callback: () => void) {
  listeners.add(callback);
  window.addEventListener("storage", callback);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

export function useLocalStorageValue(key: string): [string | null, (value: string | null) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => {
      try {
        return window.localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    () => null,
  );

  const setValue = useCallback(
    (next: string | null) => {
      try {
        if (next === null) window.localStorage.removeItem(key);
        else window.localStorage.setItem(key, next);
      } catch {
        // Storage can be unavailable (private mode, quota); the UI simply won't persist.
      }
      for (const listener of listeners) listener();
    },
    [key],
  );

  return [value, setValue];
}
