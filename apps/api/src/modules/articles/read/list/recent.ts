import type { ArticleSort } from "../../query";
import type { ArticleListItemDto } from "../../types";

export type RecentlyViewedItem = ArticleListItemDto & { lastViewedAt: Date };

export function compareRecentlyViewedItems(
  left: RecentlyViewedItem,
  right: RecentlyViewedItem,
  sort: ArticleSort,
) {
  if (sort === "unread-first" && left.isRead !== right.isRead) {
    return Number(left.isRead) - Number(right.isRead);
  }
  const timeDiff =
    sort === "oldest"
      ? left.lastViewedAt.getTime() - right.lastViewedAt.getTime()
      : right.lastViewedAt.getTime() - left.lastViewedAt.getTime();
  if (timeDiff !== 0) {
    return timeDiff;
  }
  return sort === "oldest" ? left.id.localeCompare(right.id) : right.id.localeCompare(left.id);
}

export function mergeRecentlyViewedItemsSorted(items: RecentlyViewedItem[], sort: ArticleSort) {
  return [...items].sort((left, right) => compareRecentlyViewedItems(left, right, sort));
}
