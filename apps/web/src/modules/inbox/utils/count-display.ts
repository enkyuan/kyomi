import type { InboxFilter } from "../services/api";

export type InboxListHeaderCount = {
  /** Shown before the unit label (may include a trailing "+" when more pages exist). */
  numberPart: string;
  /** Short noun after the number ("today", "saved", "read", …). */
  unitPart: string;
};

function unitForFilter(filter: InboxFilter, activeScopeLabel: string | null | undefined): string {
  if (activeScopeLabel) {
    return activeScopeLabel;
  }
  if (filter === "today") {
    return "today";
  }
  if (filter === "saved") {
    return "saved";
  }
  if (filter === "recent") {
    return "read";
  }
  if (filter === "all") {
    return "items";
  }
  return "unread";
}

/**
 * Inbox list header count: prefer API totals when the view-count query ran; otherwise show
 * loaded-cardinality (never implying a full total when only a page is loaded).
 */
export function deriveInboxListHeaderCount(input: {
  filter: InboxFilter;
  loadedCount: number;
  hasNextPage: boolean;
  viewCountQuery: { isSuccess: boolean; data?: { count: number } | undefined };
  includeRead: boolean;
  activeScopeLabel?: string | null;
}): InboxListHeaderCount {
  const unitPart = unitForFilter(input.filter, input.activeScopeLabel);

  const knownCount =
    input.viewCountQuery.isSuccess && !input.includeRead
      ? input.viewCountQuery.data?.count
      : undefined;
  const usesKnownTotal = knownCount !== undefined;
  const rawCount = knownCount ?? input.loadedCount;

  const hasMoreLoadedItems = !usesKnownTotal && input.hasNextPage;
  const numberPart =
    rawCount >= 999 && hasMoreLoadedItems
      ? "999+"
      : rawCount > 999
        ? "999+"
        : `${rawCount}${hasMoreLoadedItems ? "+" : ""}`;

  return {
    numberPart,
    unitPart,
  };
}
