import { createFileRoute } from "@tanstack/react-router";
import { BillingPagePanel } from "@modules/settings/components/billing";

export const Route = createFileRoute("/_app/settings/billing")({
  component: BillingPagePanel,
});
