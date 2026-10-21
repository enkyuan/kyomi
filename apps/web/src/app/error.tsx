"use client";

import { useRouter, type ErrorComponentProps } from "@tanstack/react-router";
import {
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@kyomi/ui/components/empty";
import { KyomiLogo } from "@kyomi/ui/icons";
import { getUserSafeErrorMessage } from "@kyomi/reader/lib/errors";
import type { RouteRecoveryAction } from "@lib/recovery";
import { getErrorStatus } from "@lib/status";
import { NotFoundPage } from "./not-found";
import {
  RecoveryButton,
  RecoverySurface,
  useRecoveryContext,
  type RecoveryLayout,
} from "./recovery";

const FALLBACK_TITLE = "We lost the plot";
const FALLBACK_MESSAGE = "The page lost its place for a moment.";

const UNREACHABLE_COPY = {
  title: FALLBACK_TITLE,
  description: "Kyomi couldn't reach its server. Give it a moment.",
};

/** Fixed copy per HTTP status: a status error never shows the server's own words. */
const STATUS_COPY: Partial<Record<number, { title: string; description: string }>> = {
  401: { title: "Session ended", description: "Sign in again to pick up where you left off." },
  403: { title: "No entry", description: "This page isn't open to your account." },
  429: { title: "Easy there", description: "Too many requests at once. Give it a minute." },
  502: UNREACHABLE_COPY,
  503: UNREACHABLE_COPY,
  504: UNREACHABLE_COPY,
};

/** This page has no retry, so drop the "Try again." hint that shared error messages end with. */
const withoutRetryHint = (message: string) => message.replace(/\.\s+Try again\.?$/i, ".");

export function RouteErrorPage({
  error,
  recoveryAction,
  reset,
  layout = "page",
}: ErrorComponentProps & { recoveryAction: RouteRecoveryAction; layout?: RecoveryLayout }) {
  const router = useRouter();
  const status = getErrorStatus(error);
  const statusCopy = status === undefined ? undefined : STATUS_COPY[status];
  // Raw messages can carry server internals; only known-safe ones reach the page.
  const message = withoutRetryHint(getUserSafeErrorMessage(error, FALLBACK_MESSAGE));
  // Linking to the page that failed would not remount its error boundary, so recover in place.
  const recoverInPlace = (event: React.MouseEvent) => {
    if (router.state.location.pathname !== recoveryAction.to) return;
    event.preventDefault();
    void router.invalidate().then(reset, reset);
  };

  // A 404 from a loader or the server is the same page as an unmatched URL.
  if (status === 404) {
    return <NotFoundPage recoveryAction={recoveryAction} layout={layout} />;
  }

  return (
    <RecoverySurface layout={layout}>
      <EmptyHeader>
        <KyomiLogo size={28} className="mb-5 size-7 text-matcha" />
        <EmptyTitle>{statusCopy?.title ?? FALLBACK_TITLE}</EmptyTitle>
        <EmptyDescription className="max-w-sm text-balance">
          {statusCopy?.description ?? message}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <RecoveryButton onClick={recoverInPlace} recoveryAction={recoveryAction} />
      </EmptyContent>
    </RecoverySurface>
  );
}

/** The router-wide error page: contextual layout and recovery action, no per-route wiring. */
export function DefaultErrorPage(props: ErrorComponentProps) {
  return <RouteErrorPage {...props} {...useRecoveryContext()} />;
}
