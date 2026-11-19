"use client";

import {
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@kyomi/ui/components/empty";
import { KyomiLogo } from "@kyomi/ui/icons";
import type { RouteRecoveryAction } from "@lib/recovery";
import { RecoveryButton, RecoverySurface, useRecoveryContext } from "./recovery";

export function NotFoundPage({ recoveryAction }: { recoveryAction: RouteRecoveryAction }) {
  return (
    <RecoverySurface>
      <EmptyHeader>
        <KyomiLogo size={28} className="mb-5 size-7 text-matcha" />
        <EmptyTitle>Page not found</EmptyTitle>
        <EmptyDescription className="max-w-sm text-pretty">
          This link wandered off the reading list.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <RecoveryButton recoveryAction={recoveryAction} />
      </EmptyContent>
    </RecoverySurface>
  );
}

/** The router-wide not-found page: contextual recovery action, no per-route wiring. */
export function DefaultNotFoundPage() {
  return <NotFoundPage {...useRecoveryContext()} />;
}
