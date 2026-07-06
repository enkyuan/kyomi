import { createFileRoute } from "@tanstack/react-router";
import { PersonalizationPagePanel } from "@modules/settings/components/personalization";

export const Route = createFileRoute("/_app/settings/personalization")({
  component: PersonalizationPagePanel,
});
