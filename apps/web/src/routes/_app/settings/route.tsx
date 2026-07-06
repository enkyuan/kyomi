import { createFileRoute } from "@tanstack/react-router";
import { SettingsPageLayout } from "@modules/settings/components/page";

export const Route = createFileRoute("/_app/settings")({
  component: SettingsPageLayout,
});
