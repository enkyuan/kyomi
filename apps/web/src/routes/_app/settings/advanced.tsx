import { createFileRoute } from "@tanstack/react-router";
import { AdvancedPagePanel } from "@modules/settings/components/advanced";

export const Route = createFileRoute("/_app/settings/advanced")({
  component: AdvancedPagePanel,
});
