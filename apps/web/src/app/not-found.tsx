"use client";

import { Link } from "@tanstack/react-router";
import { Button } from "@kyomi/ui/atoms/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@kyomi/ui/atoms/empty";
import { KyomiLogo } from "@kyomi/ui/icons";
import type { RouteRecoveryAction } from "@/app/recovery";

export function NotFoundPage({ recoveryAction }: { recoveryAction: RouteRecoveryAction }) {
  return (
    <main className="flex min-h-svh bg-background text-foreground">
      <Empty className="min-h-svh gap-5 px-6 py-10">
        <EmptyHeader className="max-w-md">
          <KyomiLogo size={28} className="mb-5 size-7 text-matcha" />
          <EmptyTitle className="text-2xl text-balance">Page not found</EmptyTitle>
          <EmptyDescription className="max-w-sm text-pretty">
            This link wandered off the reading list.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button
            className="w-28 max-sm:w-full rounded-full"
            render={<Link to={recoveryAction.to} />}
          >
            {recoveryAction.label}
          </Button>
        </EmptyContent>
      </Empty>
    </main>
  );
}
