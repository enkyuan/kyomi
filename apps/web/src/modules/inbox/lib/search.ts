import { isUuid } from "@lib/ids";
import type { InboxFilter, InboxSort } from "@modules/articles/lib/api";
import { normalizeInboxSort } from "@modules/articles/lib/urls";

export type InboxSearch = {
  filter?: InboxFilter;
  search?: string;
  feedId?: string;
  folderId?: string;
  itemId?: string;
  showHidden?: "1";
  showRead?: "1";
  sort?: InboxSort;
};

function parseOptionalString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function validateInboxSearch(search: Record<string, unknown>): InboxSearch {
  const filter = (() => {
    if (search.filter === "inbox" || search.filter === "today" || search.filter === "unread") {
      return "my-feed";
    }
    if (
      search.filter === "my-feed" ||
      search.filter === "all" ||
      search.filter === "saved" ||
      search.filter === "recent"
    ) {
      return search.filter;
    }
    return undefined;
  })();

  const sort = normalizeInboxSort(search.sort);

  return {
    filter,
    search: parseOptionalString(search.search),
    feedId: parseOptionalString(search.feedId),
    folderId: parseOptionalString(search.folderId),
    itemId: isUuid(search.itemId) ? search.itemId : undefined,
    showHidden: search.showHidden === "1" ? "1" : undefined,
    showRead: search.showRead === "1" ? "1" : undefined,
    sort,
  };
}
