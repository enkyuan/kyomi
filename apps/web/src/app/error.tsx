"use client";

import { Link, useRouter, type ErrorComponentProps } from "@tanstack/react-router";
import { Button } from "@kyomi/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@kyomi/ui/empty";
import { KyomiLogo } from "@kyomi/ui/icons";

export function RouteErrorPage({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  const message =
    error instanceof Error && error.message.trim()
      ? error.message
      : "The page lost its place for a moment.";

  function handleRetry() {
    reset?.();
    void router.invalidate();
  }

  return (
    <main className="flex min-h-svh bg-background text-foreground">
      <Empty className="min-h-svh gap-5 px-6 py-10">
        <EmptyHeader className="max-w-md">
          <KyomiLogo size={28} className="mb-5 size-7 text-matcha" />
          <EmptyTitle className="text-2xl text-balance">We lost the plot</EmptyTitle>
          <EmptyDescription className="max-w-sm text-pretty">{message}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent className="flex flex-wrap justify-center gap-2 max-sm:w-full">
          <Button className="w-28 max-sm:flex-1" onClick={handleRetry}>
            Try again
          </Button>
          <Button
            variant="outline"
            className="w-32 max-sm:flex-1"
            render={<Link to="/inbox" search={{ filter: "my-feed" }} />}
          >
            Back to inbox
          </Button>
        </EmptyContent>
      </Empty>
    </main>
  );
}
