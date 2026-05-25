import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "@/routes/-guards";
import { Page } from "@modules/inbox";
import { getInboxLoaderData } from "@modules/inbox/services/route-loader";

type InboxSearch = {
  filter?: "inbox" | "today" | "unread" | "saved" | "recent";
  search?: string;
  feedId?: string;
  folderId?: string;
  itemId?: string;
  showHidden?: "1";
  showRead?: "1";
};

function parseOptionalString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function validateInboxSearch(search: Record<string, unknown>): InboxSearch {
  const filter =
    search.filter === "inbox" ||
    search.filter === "today" ||
    search.filter === "unread" ||
    search.filter === "saved" ||
    search.filter === "recent"
      ? search.filter
      : undefined;

  return {
    filter,
    search: parseOptionalString(search.search),
    feedId: parseOptionalString(search.feedId),
    folderId: parseOptionalString(search.folderId),
    itemId: parseOptionalString(search.itemId),
    showHidden: search.showHidden === "1" ? "1" : undefined,
    showRead: search.showRead === "1" ? "1" : undefined,
  };
}

export const Route = createFileRoute("/inbox/")({
  validateSearch: validateInboxSearch,
  loader: async () => {
    const [, loaderData] = await Promise.all([requireAuth(), getInboxLoaderData()]);
    return loaderData;
  },
  component: InboxRouteComponent,
});

function InboxRouteComponent() {
  const { initialInboxPreferences, initialSplitPanePercent } = Route.useLoaderData();
  return (
    <Page
      initialInboxPreferences={initialInboxPreferences}
      initialSplitPanePercent={initialSplitPanePercent}
    />
  );
}
