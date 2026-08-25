"use client";

import { useSyncExternalStore } from "react";

/** Nothing to subscribe to — the answer flips once, at hydration. */
const noop = () => () => {};

/**
 * `false` while rendering on the server and during the hydration pass,
 * `true` afterwards. Lets a component render a server-safe placeholder
 * without reaching for an effect (and without tripping
 * `react-hooks/set-state-in-effect`).
 */
export function useIsHydrated() {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false
  );
}
