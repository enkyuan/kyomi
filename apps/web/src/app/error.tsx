"use client";

import { Link, type ErrorComponentProps } from "@tanstack/react-router";
import { Button } from "@kyomi/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@kyomi/ui/empty";
import { KyomiLogo } from "@kyomi/ui/icons";

const SESSION_LOAD_ERROR_MESSAGE = "Unable to load your session.";

export function getRouteErrorRecoveryAction(error: unknown) {
  return {
    label:
      error instanceof Error && error.message === SESSION_LOAD_ERROR_MESSAGE
        ? "Go to login"
        : "Go home",
    to: "/" as const,
  };
}

export function RouteErrorPage({ error, reset }: ErrorComponentProps) {
  const message =
    error instanceof Error && error.message.trim()
      ? error.message
      : "The page lost its place for a moment.";
  const recoveryAction = getRouteErrorRecoveryAction(error);

  return (
    <main className="flex min-h-svh bg-background text-foreground">
      <Empty className="min-h-svh gap-5 px-6 py-10">
        <EmptyHeader className="max-w-md">
          <KyomiLogo size={28} className="mb-5 size-7 text-matcha" />
          <EmptyTitle className="text-2xl text-balance">We lost the plot</EmptyTitle>
          <EmptyDescription className="max-w-sm text-balance">{message}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent className="gap-2">
          <Button className="w-28 max-sm:w-full rounded-full" onClick={reset}>
            Try again
          </Button>
          <Button
            className="w-28 max-sm:w-full rounded-full"
            render={<Link to={recoveryAction.to} />}
            variant="outline"
          >
            {recoveryAction.label}
          </Button>
        </EmptyContent>
      </Empty>
    </main>
  );
}
