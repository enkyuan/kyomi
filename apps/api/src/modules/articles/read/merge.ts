import type { ArticleListItemDto, ArticlesCursorListResponseDto } from "../types";

export function mergeArticleItemsByDate(
  parts: ArticleListItemDto[][],
  limit: number,
): ArticleListItemDto[] {
  const cap = Math.min(Math.max(limit, 1), 200);
  return parts
    .flat()
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
    .slice(0, cap);
}

export function mergedFeedClipResponse(items: ArticleListItemDto[]): ArticlesCursorListResponseDto {
  return {
    items,
    next_cursor: null,
    has_more: false,
    total_count: null,
  };
}
