"use client";

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

export function useHydrated() {
  return useSyncExternalStore(
    subscribeHydration,
    getClientHydratedSnapshot,
    getServerHydratedSnapshot,
  );
}
