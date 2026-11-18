import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth";
import { adoptSessionUser, isSessionOwner } from "../lib/user-data";

type SessionData = { session?: unknown; user?: { id?: unknown } | null } | null | undefined;

function sessionUserId(data: SessionData): string | null {
  const id = data?.session ? data.user?.id : undefined;
  return typeof id === "string" && id ? id : null;
}

export function useSessionGate() {
  const { data, isPending } = authClient.useSession();
  const userId = sessionUserId(data as SessionData);
  const [adoptedUserId, setAdoptedUserId] = useState<string | null>(null);
  // Another account's cached data is gone before any signed-in screen can read it: the session
  // stays pending until this account owns the cache.
  const isAdopting = userId !== null && adoptedUserId !== userId && !isSessionOwner(userId);

  useEffect(() => {
    // Signing out ends the adoption: the next session, even the same account's, adopts again, so it
    // waits for `adoptSessionUser` to settle the owner record that the sign-out removed.
    if (userId === null) {
      setAdoptedUserId(null);
      return;
    }

    adoptSessionUser(userId);
    setAdoptedUserId(userId);
  }, [userId]);

  return {
    isAuthenticated: userId !== null && !isAdopting,
    isPending: isPending || isAdopting,
  };
}
