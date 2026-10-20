import { Outlet, createFileRoute, type ErrorComponentProps } from "@tanstack/react-router";
import { AppShell } from "@/app/shell";
import { RouteErrorPage } from "@/app/error";
import { DefaultNotFoundPage } from "@/app/not-found";
import { INBOX_RECOVERY_ACTION } from "@lib/recovery";
import { requireAuth } from "@/routes/-guards";

export const Route = createFileRoute("/_app")({
  beforeLoad: ({ context, location }) => {
    requireAuth(context.authState, location.href);
  },
  component: AppLayout,
  errorComponent: AppRouteErrorPage,
  notFoundComponent: DefaultNotFoundPage,
});

/** The shell itself failed, so this is a full page. Content failures stay inside the shell. */
function AppRouteErrorPage(props: ErrorComponentProps) {
  return <RouteErrorPage {...props} recoveryAction={INBOX_RECOVERY_ACTION} />;
}

function AppLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
