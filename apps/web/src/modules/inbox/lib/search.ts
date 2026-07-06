import type { InboxFilter, InboxSort } from "./articles/index";
import {
  isInboxRecapRailFolderBackTarget,
  isInboxRecapRailSection,
  type InboxRecapRailFolderBackTarget,
  type InboxRecapRailSection,
} from "./recap/index";

export type InboxSearch = {
  filter?: InboxFilter;
  search?: string;
  feedId?: string;
  folderId?: string;
  itemId?: string;
  rail?: InboxRecapRailSection;
  railFolderBack?: InboxRecapRailFolderBackTarget;
  railFolderId?: string;
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

  const sort = search.sort === "newest" || search.sort === "oldest" ? search.sort : undefined;
  const rail = isInboxRecapRailSection(search.rail) ? search.rail : undefined;
  const railFolderId = rail === "folders" ? parseOptionalString(search.railFolderId) : undefined;
  const railFolderBack =
    rail === "folders" && railFolderId && isInboxRecapRailFolderBackTarget(search.railFolderBack)
      ? search.railFolderBack
      : undefined;

  return {
    filter,
    search: parseOptionalString(search.search),
    feedId: parseOptionalString(search.feedId),
    folderId: parseOptionalString(search.folderId),
    itemId: parseOptionalString(search.itemId),
    rail,
    railFolderBack,
    railFolderId,
    showHidden: search.showHidden === "1" ? "1" : undefined,
    showRead: search.showRead === "1" ? "1" : undefined,
    sort,
  };
}
