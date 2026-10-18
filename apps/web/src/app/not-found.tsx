"use client";

import { Link } from "@tanstack/react-router";
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

export function NotFoundPage({ recoveryAction }: { recoveryAction: RouteRecoveryAction }) {
  return (
    <main className="flex min-h-svh bg-background text-foreground">
      <Empty size="page">
        <EmptyHeader>
          <KyomiLogo size={28} className="mb-5 size-7 text-matcha" />
          <EmptyTitle>Page not found</EmptyTitle>
          <EmptyDescription className="max-w-sm text-pretty">
            This link wandered off the reading list.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button
            className="w-28 max-sm:w-full"
            render={<Link to={recoveryAction.to} />}
            shape="pill"
          >
            {recoveryAction.label}
          </Button>
        </EmptyContent>
      </Empty>
    </main>
  );
}
