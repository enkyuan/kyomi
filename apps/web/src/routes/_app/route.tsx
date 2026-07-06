import { Outlet, createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/app/app-shell";
import { requireAuth } from "@/routes/-guards";

export const Route = createFileRoute("/_app")({
  beforeLoad: async () => {
    await requireAuth();
  },
  component: AppLayout,
});

function AppLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
