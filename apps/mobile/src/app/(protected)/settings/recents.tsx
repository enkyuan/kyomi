import { RecentsScreen } from "@modules/recents/screen";
import { SettingsDetailToolbar } from "@modules/settings/components/detail-toolbar";

export default function SettingsRecentsRoute() {
  return (
    <>
      <RecentsScreen showHeader={false} title="Recents" />
      <SettingsDetailToolbar />
    </>
  );
}
