import { Outlet, createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/app/app-shell";
import { NotFoundPage } from "@/app/not-found";
import { requireAuth } from "@/routes/-guards";

export const Route = createFileRoute("/_app")({
  beforeLoad: async () => {
    await requireAuth();
  },
  component: AppLayout,
  notFoundComponent: NotFoundPage,
});

function AppLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
