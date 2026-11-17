import type { ArticleSort } from "@modules/articles/params";
import type { ArticleListItemDto, ArticlesCursorListResponseDto } from "@modules/articles/types";
import { encodeMergedListCursorFromItem } from "./cursor";
import { clampLimit } from "./window";

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
  return mergeArticleListsSortedDesc(parts).slice(0, clampLimit(limit));
}

/**
 * The first `limit` merged items, and whether more exist: the merge overflowed the page or either
 * source reported another page of its own.
 */
export function sliceMergedPage<T>(
  mergedSorted: T[],
  limit: number,
  sourcesHaveMore: readonly boolean[],
): { page: T[]; hasMore: boolean } {
  const cap = clampLimit(limit);
  return {
    page: mergedSorted.slice(0, cap),
    hasMore: mergedSorted.length > cap || sourcesHaveMore.some(Boolean),
  };
}

export function mergedFeedClipResponsePaged(
  mergedSorted: ArticleListItemDto[],
  limit: number,
  feedHasMore: boolean,
  clipHasMore: boolean,
  sort: ArticleSort,
): ArticlesCursorListResponseDto {
  const { page, hasMore } = sliceMergedPage(mergedSorted, limit, [feedHasMore, clipHasMore]);
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
