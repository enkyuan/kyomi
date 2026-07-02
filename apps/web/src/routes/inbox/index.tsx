import { createFileRoute } from "@tanstack/react-router";
import { loadInboxRoute, validateInboxSearch } from "./-route-helpers";
import { InboxRouteComponent } from "./-shared";

export const Route = createFileRoute("/inbox/")({
  validateSearch: validateInboxSearch,
  loader: loadInboxRoute,
  component: InboxRouteComponent,
});
