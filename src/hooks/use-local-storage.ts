"use client";

import { useCallback, useSyncExternalStore } from "react";

import { useIsHydrated } from "@/hooks/use-is-hydrated";

type Entry = { raw: string; value: unknown };

/**
 * Parsed values, keyed by storage key. Exists so that `getSnapshot` can hand
 * React the *same object reference* on every call while the underlying string
 * is unchanged — returning a fresh `JSON.parse` each time would make React
 * think the store changed on every render and loop forever.
 */
const cache = new Map<string, Entry>();
const listeners = new Map<string, Set<() => void>>();

function emit(key: string) {
  const set = listeners.get(key);
  if (set) for (const listener of set) listener();
}

function subscribe(key: string, onStoreChange: () => void) {
  let set = listeners.get(key);

  if (!set) {
    set = new Set();
    listeners.set(key, set);
  }

  set.add(onStoreChange);

  // `storage` fires in *other* tabs, keeping several open tabs in step.
  const onStorage = (event: StorageEvent) => {
    if (event.key === key) onStoreChange();
  };

  window.addEventListener("storage", onStorage);

  return () => {
    set.delete(onStoreChange);
    window.removeEventListener("storage", onStorage);
  };
}

function read<T>(key: string, initial: T): T {
  let raw: string | null;

  try {
    raw = window.localStorage.getItem(key);
  } catch {
    // Private mode or a blocked origin: fall back to whatever we hold in
    // memory so the UI still responds to writes for this page view.
    const cached = cache.get(key);
    return cached ? (cached.value as T) : initial;
  }

  if (raw === null) return initial;

  const cached = cache.get(key);
  if (cached && cached.raw === raw) return cached.value as T;

  try {
    const value = JSON.parse(raw) as T;
    cache.set(key, { raw, value });
    return value;
  } catch {
    return initial;
  }
}

/**
 * State that lives in localStorage.
 *
 * Returns `[value, setValue, hydrated]`. `hydrated` is false for the server
 * render and the hydration pass, during which `value` is `initial` — check it
 * before rendering a stored number, or the markup will not match.
 *
 * `initial` must be referentially stable (a module-level constant). It is
 * returned as-is when no stored value exists, and React compares snapshots
 * by identity.
 */
export function useLocalStorage<T>(key: string, initial: T) {
  const value = useSyncExternalStore(
    useCallback(
      (onStoreChange: () => void) => subscribe(key, onStoreChange),
      [key]
    ),
    useCallback(() => read(key, initial), [key, initial]),
    useCallback(() => initial, [initial])
  );

  const setValue = useCallback(
    (update: T | ((previous: T) => T)) => {
      const previous = read(key, initial);
      const next =
        typeof update === "function"
          ? (update as (previous: T) => T)(previous)
          : update;

      const raw = JSON.stringify(next);
      cache.set(key, { raw, value: next });

      try {
        window.localStorage.setItem(key, raw);
      } catch {
        // Quota exceeded or storage disabled — the cache above still serves
        // reads, so the session keeps working in memory.
      }

      emit(key);
    },
    [key, initial]
  );

  return [value, setValue, useIsHydrated()] as const;
}
