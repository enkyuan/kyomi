import { createFileRoute } from "@tanstack/react-router";
import { AppearancePagePanel } from "@modules/settings/components/appearance";

export const Route = createFileRoute("/_app/settings/appearance")({
  component: AppearancePagePanel,
});
