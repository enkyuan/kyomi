import { createFileRoute } from "@tanstack/react-router";
import { AccountPagePanel } from "@modules/settings/components/account";
import { useSettingsLogout } from "@modules/settings/hooks/logout";

export const Route = createFileRoute("/_app/settings/account")({
  component: AccountSettingsRoute,
});

function AccountSettingsRoute() {
  const { logout } = useSettingsLogout({});

  return <AccountPagePanel onLogout={logout} />;
}
