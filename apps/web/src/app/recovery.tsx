"use client";

import { Link, useLocation, useRouteContext } from "@tanstack/react-router";
import type { MouseEventHandler, ReactNode } from "react";
import { Button } from "@kyomi/ui/components/button";
import { Empty } from "@kyomi/ui/components/empty";
import {
  getAuthRecoveryAction,
  getPathRecoveryAction,
  type RouteRecoveryAction,
} from "@lib/recovery";

/** The single primary action on every error page: leave for the route's contextual recovery target. */
export function RecoveryButton({
  recoveryAction,
  onClick,
}: {
  recoveryAction: RouteRecoveryAction;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
}) {
  return (
    <Button
      className="w-28 max-sm:w-full"
      render={<Link onClick={onClick} to={recoveryAction.to} />}
      shape="pill"
    >
      {recoveryAction.label}
    </Button>
  );
}

/**
 * An error or not-found page is a whole page: it takes over the viewport, above the app shell and
 * its sidebar, wherever in the route tree the failure happened. It is fixed to the window rather
 * than sized to its parent because a failure under the signed-in shell renders inside that shell's
 * content column, which would leave the sidebar showing beside it.
 */
export function RecoverySurface({ children }: { children: ReactNode }) {
  return (
    <main
      className="fixed inset-0 z-50 flex bg-background text-foreground"
      data-slot="recovery-page"
    >
      <Empty size="page">{children}</Empty>
    </main>
  );
}

/**
 * Where an error or not-found page sends the user, read from the router: the action follows the
 * resolved auth state, or the failing area when the session lookup itself failed.
 */
export function useRecoveryContext(): { recoveryAction: RouteRecoveryAction } {
  const pathname = useLocation({ select: (location) => location.pathname });
  // The failing route may not have a context at all (the session lookup that builds it failed).
  const authState = useRouteContext({ strict: false, select: (context) => context?.authState });

  return {
    recoveryAction: getAuthRecoveryAction(authState) ?? getPathRecoveryAction(pathname),
  };
}
