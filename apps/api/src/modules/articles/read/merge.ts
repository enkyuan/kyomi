import type { ArticleListItemDto, ArticlesCursorListResponseDto } from "../types";
import { encodeMergedListCursorFromItem } from "./merged-view-cursor";

/** Global sort: newest first; tie-break by id descending (matches DB `orderBy`). */
export function mergeArticleListsSortedDesc(parts: ArticleListItemDto[][]): ArticleListItemDto[] {
  return parts.flat().sort((a, b) => {
    const dt = Date.parse(b.publishedAt) - Date.parse(a.publishedAt);
    if (dt !== 0) {
      return dt;
    }
    return b.id.localeCompare(a.id);
  });
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
): ArticlesCursorListResponseDto {
  const cap = Math.min(Math.max(limit, 1), 200);
  const page = mergedSorted.slice(0, cap);
  const hasMore = mergedSorted.length > cap || feedHasMore || clipHasMore;
  const nextCursor =
    hasMore && page.length > 0 ? encodeMergedListCursorFromItem(page[page.length - 1]!) : null;
  return {
    items: page,
    next_cursor: nextCursor,
    has_more: hasMore,
    total_count: null,
  };
}
