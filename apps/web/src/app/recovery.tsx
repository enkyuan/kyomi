"use client";

import { Link, useLocation, useMatch, useRouteContext } from "@tanstack/react-router";
import type { MouseEventHandler, ReactNode } from "react";
import { Button } from "@kyomi/ui/components/button";
import { Empty } from "@kyomi/ui/components/empty";
import type { FileRoutesById } from "@/routeTree.gen";
import {
  getAuthRecoveryAction,
  getPathRecoveryAction,
  type RouteRecoveryAction,
} from "@lib/recovery";

// Typed against the generated route tree so renaming the layout route fails to compile here.
const APP_SHELL_ROUTE_ID = "/_app" satisfies keyof FileRoutesById;

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
 * Where an error or not-found page renders and where it sends the user, read from the router. The
 * layout follows the route that owns the boundary, not the routes that matched the URL: a failed
 * session lookup at `/inbox` still matches `/_app`, but the shell never rendered, so it is a full
 * `page`. A boundary at or under `/_app` keeps the shell (`panel`). The action follows the resolved
 * auth state, or the failing area when the session lookup itself failed.
 */
export function useRecoveryContext(): {
  layout: RecoveryLayout;
  recoveryAction: RouteRecoveryAction;
} {
  // `shouldThrow: false`: this renders inside an error boundary that can outlive its match while
  // navigating away; a throw here would escape to the root and blank the page.
  const matchedRouteId = useMatch({
    strict: false,
    shouldThrow: false,
    select: (match) => match.routeId,
  });
  const boundaryRouteId: string = matchedRouteId ?? "";
  const inShell =
    boundaryRouteId === APP_SHELL_ROUTE_ID || boundaryRouteId.startsWith(`${APP_SHELL_ROUTE_ID}/`);
  const pathname = useLocation({ select: (location) => location.pathname });
  // The failing route may not have a context at all (the session lookup that builds it failed).
  const authState = useRouteContext({ strict: false, select: (context) => context?.authState });

  return {
    layout: inShell ? "panel" : "page",
    recoveryAction: getAuthRecoveryAction(authState) ?? getPathRecoveryAction(pathname),
  };
}
