import { redirect } from "@tanstack/react-router";
import type { AvailableAuthSessionState } from "@lib/auth/session";
import { buildAuthEntryHref, resolveAuthReturnTo } from "@modules/auth/redirect";

export function requireAuth(authState: AvailableAuthSessionState, returnTo: string) {
  if (authState.status === "anonymous") {
    throw redirect({
      href: buildAuthEntryHref("/", returnTo),
      replace: true,
    });
  }
}

export function requireGuest(authState: AvailableAuthSessionState, returnTo?: string) {
  if (authState.status === "authenticated") {
    throw redirect({ href: resolveAuthReturnTo(returnTo), replace: true });
  }
}
