import type { ArticleSort } from "@modules/articles/query";
import type { ArticleListItemDto, ArticlesCursorListResponseDto } from "@modules/articles/types";
import { encodeMergedListCursorFromItem } from "./cursor";

/** Global sort: latest first; tie-break by id descending (matches DB `orderBy`). */
export function mergeArticleListsSortedDesc(parts: ArticleListItemDto[][]): ArticleListItemDto[] {
  return parts.flat().sort((a, b) => {
    const dt = Date.parse(b.publishedAt) - Date.parse(a.publishedAt);
    if (dt !== 0) {
      return dt;
    }
    return b.id.localeCompare(a.id);
  });
}

export function mergeArticleListsSorted(
  parts: ArticleListItemDto[][],
  sort: ArticleSort,
): ArticleListItemDto[] {
  const items = parts.flat();
  if (sort === "oldest") {
    return items.sort((a, b) => {
      const dt = Date.parse(a.publishedAt) - Date.parse(b.publishedAt);
      if (dt !== 0) {
        return dt;
      }
      return a.id.localeCompare(b.id);
    });
  }
  if (sort === "unread-first") {
    return items.sort((a, b) => {
      if (a.isRead !== b.isRead) {
        return Number(a.isRead) - Number(b.isRead);
      }
      const dt = Date.parse(b.publishedAt) - Date.parse(a.publishedAt);
      if (dt !== 0) {
        return dt;
      }
      return b.id.localeCompare(a.id);
    });
  }
  return mergeArticleListsSortedDesc(parts);
}

export function mergeArticleItemsByDate(
  parts: ArticleListItemDto[][],
  limit: number,
): ArticleListItemDto[] {
  const cap = Math.min(Math.max(limit, 1), 200);
  return mergeArticleListsSortedDesc(parts).slice(0, cap);
}

export function mergedFeedClipResponse(items: ArticleListItemDto[]): ArticlesCursorListResponseDto {
  return {
    items,
    next_cursor: null,
    has_more: false,
    total_count: null,
  };
}

export function mergedFeedClipResponsePaged(
  mergedSorted: ArticleListItemDto[],
  limit: number,
  feedHasMore: boolean,
  clipHasMore: boolean,
  sort: ArticleSort,
): ArticlesCursorListResponseDto {
  const cap = Math.min(Math.max(limit, 1), 200);
  const page = mergedSorted.slice(0, cap);
  const hasMore = mergedSorted.length > cap || feedHasMore || clipHasMore;
  const nextCursor =
    hasMore && page.length > 0
      ? encodeMergedListCursorFromItem(page[page.length - 1]!, sort)
      : null;
  return {
    items: page,
    next_cursor: nextCursor,
    has_more: hasMore,
    total_count: null,
  };
}
