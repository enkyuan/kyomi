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

export function requireCompletedOnboarding(status: "pending" | "complete", returnTo: string) {
  if (status === "pending") {
    throw redirect({
      to: "/onboarding",
      search: { redirect: resolveAuthReturnTo(returnTo), step: undefined },
      replace: true,
    });
  }
}
