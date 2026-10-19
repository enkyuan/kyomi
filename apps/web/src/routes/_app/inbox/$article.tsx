import { createFileRoute } from "@tanstack/react-router";
import { prefetchInboxArticleRoute } from "./-loader";

export const Route = createFileRoute("/_app/inbox/$article")({
  loader: prefetchInboxArticleRoute,
});
