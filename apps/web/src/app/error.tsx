"use client";

import { Link, type ErrorComponentProps, useRouter } from "@tanstack/react-router";
import { Button } from "@kyomi/ui/components/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@kyomi/ui/components/empty";
import { KyomiLogo } from "@kyomi/ui/icons";
import type { RouteRecoveryAction } from "@lib/recovery";

export function RouteErrorPage({
  error,
  recoveryAction,
  reset,
}: ErrorComponentProps & { recoveryAction?: RouteRecoveryAction }) {
  const router = useRouter();
  const message =
    error instanceof Error && error.message.trim()
      ? error.message
      : "The page lost its place for a moment.";
  const retry = () => {
    void router.invalidate().then(reset, reset);
  };

  return (
    <main className="flex min-h-svh bg-background text-foreground">
      <Empty size="page">
        <EmptyHeader>
          <KyomiLogo size={28} className="mb-5 size-7 text-matcha" />
          <EmptyTitle>We lost the plot</EmptyTitle>
          <EmptyDescription className="max-w-sm text-balance">{message}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent className="gap-2">
          <Button className="w-28 max-sm:w-full" shape="pill" onClick={retry}>
            Try again
          </Button>
          {recoveryAction ? (
            <Button
              className="w-28 max-sm:w-full"
              render={<Link to={recoveryAction.to} />}
              shape="pill"
              variant="outline"
            >
              {recoveryAction.label}
            </Button>
          ) : null}
        </EmptyContent>
      </Empty>
    </main>
  );
}
