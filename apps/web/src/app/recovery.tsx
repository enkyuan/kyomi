"use client";

import { Link, useLocation, useMatches, useRouteContext } from "@tanstack/react-router";
import type { MouseEventHandler, ReactNode } from "react";
import { Button } from "@kyomi/ui/components/button";
import { Empty } from "@kyomi/ui/components/empty";
import {
  getAuthRecoveryAction,
  getPathRecoveryAction,
  type RouteRecoveryAction,
} from "@lib/recovery";

/** `page` takes over the viewport; `panel` fills the content area and keeps the app shell around it. */
export type RecoveryLayout = "page" | "panel";

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

export function RecoverySurface({
  layout,
  children,
}: {
  layout: RecoveryLayout;
  children: ReactNode;
}) {
  return layout === "panel" ? (
    <div className="flex h-full min-h-0 flex-1 bg-background text-foreground">
      <Empty size="md">{children}</Empty>
    </div>
  ) : (
    <main className="flex min-h-svh bg-background text-foreground">
      <Empty size="page">{children}</Empty>
    </main>
  );
}

/**
 * Where an error or not-found page renders and where it sends the user, read from the router: a
 * failure under the signed-in shell keeps the shell (`panel`), anything else is a full `page`; the
 * action follows the resolved auth state, or the failing area when the session lookup itself failed.
 */
export function useRecoveryContext(): {
  layout: RecoveryLayout;
  recoveryAction: RouteRecoveryAction;
} {
  const inShell = useMatches({ select: (matches) => matches.some((m) => m.routeId === "/_app") });
  const pathname = useLocation({ select: (location) => location.pathname });
  // The failing route may not have a context at all (the session lookup that builds it failed).
  const authState = useRouteContext({ strict: false, select: (context) => context?.authState });

  return {
    layout: inShell ? "panel" : "page",
    recoveryAction: getAuthRecoveryAction(authState) ?? getPathRecoveryAction(pathname),
  };
}
