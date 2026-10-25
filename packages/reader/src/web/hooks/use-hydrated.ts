import { useSyncExternalStore } from "react";

function subscribeHydration() {
  return () => {};
}

function getClientHydratedSnapshot() {
  return true;
}

function getServerHydratedSnapshot() {
  return false;
}

/** `false` during SSR and the hydration pass, `true` once the client owns the DOM. */
export function useHydrated() {
  return useSyncExternalStore(
    subscribeHydration,
    getClientHydratedSnapshot,
    getServerHydratedSnapshot,
  );
}
