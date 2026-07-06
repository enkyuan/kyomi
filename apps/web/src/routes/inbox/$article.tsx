import { createFileRoute } from "@tanstack/react-router";
import { prefetchInboxArticleRoute } from "./-route-helpers";

export const Route = createFileRoute("/inbox/$article")({
  loader: prefetchInboxArticleRoute,
});
