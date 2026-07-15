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
