import { createFileRoute } from "@tanstack/react-router";
import { validateInboxSearch } from "@modules/inbox/lib/search";

import { loadInboxRoute } from "./-route-helpers";
import { InboxRouteComponent } from "./-shared";

export const Route = createFileRoute("/_app/inbox")({
  validateSearch: validateInboxSearch,
  loaderDeps: ({ search }) => search,
  loader: loadInboxRoute,
  component: InboxRouteComponent,
});
