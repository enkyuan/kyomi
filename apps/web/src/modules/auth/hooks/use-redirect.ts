import { useSyncExternalStore } from "react";
import { useLocation } from "@tanstack/react-router";
import { preserveAuthEntryHash } from "@modules/auth/redirect";

function subscribeToHashChange(onStoreChange: () => void) {
  window.addEventListener("hashchange", onStoreChange);
  return () => window.removeEventListener("hashchange", onStoreChange);
}

function getBrowserHash() {
  return window.location.hash;
}

export function useAuthRedirect(redirect: unknown) {
  const { hash: routerHash } = useLocation();
  const browserHash = useSyncExternalStore(subscribeToHashChange, getBrowserHash, () => routerHash);

  return preserveAuthEntryHash(redirect, browserHash);
}
