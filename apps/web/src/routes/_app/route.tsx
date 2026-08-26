import { Outlet, createFileRoute, type ErrorComponentProps } from "@tanstack/react-router";
import { AppShell } from "@/app/app-shell";
import { RouteErrorPage } from "@/app/error";
import { NotFoundPage } from "@/app/not-found";
import { INBOX_RECOVERY_ACTION } from "@lib/recovery";
import { requireAuth } from "@/routes/-guards";

export const Route = createFileRoute("/_app")({
  beforeLoad: ({ context, location }) => {
    requireAuth(context.authState, location.href);
  },
  component: AppLayout,
  errorComponent: AppRouteErrorPage,
  notFoundComponent: AppNotFoundPage,
});

function AppRouteErrorPage(props: ErrorComponentProps) {
  return <RouteErrorPage {...props} recoveryAction={INBOX_RECOVERY_ACTION} />;
}

function AppNotFoundPage() {
  return <NotFoundPage recoveryAction={INBOX_RECOVERY_ACTION} />;
}

function AppLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
