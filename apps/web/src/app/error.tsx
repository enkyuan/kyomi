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
import {
  RecoveryButton,
  RecoverySurface,
  useRecoveryContext,
  type RecoveryLayout,
} from "./recovery";

const FALLBACK_MESSAGE = "The page lost its place for a moment.";

/** This page has no retry, so drop the "Try again." hint that shared error messages end with. */
const withoutRetryHint = (message: string) => message.replace(/\.\s+Try again\.?$/i, ".");

export function RouteErrorPage({
  error,
  recoveryAction,
  reset,
  layout = "page",
}: ErrorComponentProps & { recoveryAction: RouteRecoveryAction; layout?: RecoveryLayout }) {
  const router = useRouter();
  // Filtered and truncated (a deny-list of known internal shapes, not a guarantee of safe text).
  const message = withoutRetryHint(getUserSafeErrorMessage(error, FALLBACK_MESSAGE));
  // Linking to the page that failed would not remount its error boundary, so recover in place.
  const recoverInPlace = (event: React.MouseEvent) => {
    // Leave new-tab and new-window clicks to the browser.
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return;
    // Compare the full href: on `/inbox?feedId=x` the link must navigate to a clean `/inbox`, since
    // retrying in place would keep the search state that may be what failed.
    if (router.state.location.href !== recoveryAction.to) return;
    event.preventDefault();
    void router.invalidate().then(reset, reset);
  };

  return (
    <RecoverySurface layout={layout}>
      <EmptyHeader>
        <KyomiLogo size={28} className="mb-5 size-7 text-matcha" />
        <EmptyTitle>We lost the plot</EmptyTitle>
        <EmptyDescription className="max-w-sm text-balance">{message}</EmptyDescription>
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
