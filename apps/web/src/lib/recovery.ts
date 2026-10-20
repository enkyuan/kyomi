import type { AvailableAuthSessionState } from "@lib/auth/session";

export type RouteRecoveryAction = {
  label: string;
  to: "/" | "/inbox";
};

export const LOGIN_RECOVERY_ACTION = {
  label: "Go to login",
  to: "/",
} as const satisfies RouteRecoveryAction;

export const INBOX_RECOVERY_ACTION = {
  label: "Back to inbox",
  to: "/inbox",
} as const satisfies RouteRecoveryAction;

export function getAuthRecoveryAction(
  authState?: AvailableAuthSessionState,
): RouteRecoveryAction | undefined {
  if (!authState) {
    return undefined;
  }

  return authState.status === "authenticated" ? INBOX_RECOVERY_ACTION : LOGIN_RECOVERY_ACTION;
}

/**
 * The recovery target for a failure whose auth state is unknown (the session lookup itself failed):
 * the signed-in area keeps its inbox target, which the next navigation re-checks and redirects to
 * login if the session is gone; everywhere else goes to login.
 */
export function getPathRecoveryAction(pathname: string): RouteRecoveryAction {
  return pathname === INBOX_RECOVERY_ACTION.to ||
    pathname.startsWith(`${INBOX_RECOVERY_ACTION.to}/`)
    ? INBOX_RECOVERY_ACTION
    : LOGIN_RECOVERY_ACTION;
}
