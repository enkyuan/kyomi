import { createFileRoute } from "@tanstack/react-router";
import { prefetchInboxArticleRoute } from "./-route-helpers";

export const Route = createFileRoute("/_app/inbox/$article")({
  loader: prefetchInboxArticleRoute,
});
