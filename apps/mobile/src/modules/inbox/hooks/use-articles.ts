import { useInfiniteQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { fetchMobileApiJson } from "@/lib/api";
import {
  exploreArticlesPath,
  exploreArticlesPrefetchKey,
  subscribedArticlesPath,
} from "@modules/inbox/lib/articles";
import type { ArticleListItemDto, CursorListResponseDto } from "@kyomi/reader/schemas/article";

export const subscribedArticlesQueryKey = ["inbox", "articles", "subscribed"] as const;
export const exploreArticlesQueryKey = ["inbox", "articles", "explore"] as const;

export type ArticleScope = "subscribed" | "explore";

async function fetchArticles(
  scope: ArticleScope,
  cursor: string | undefined,
): Promise<CursorListResponseDto> {
  const isExplore = scope === "explore";
  return fetchMobileApiJson<CursorListResponseDto>(
    isExplore ? exploreArticlesPath(cursor) : subscribedArticlesPath(cursor),
    {
      prefetchKey: isExplore && !cursor ? exploreArticlesPrefetchKey() : undefined,
    },
  );
}

function dedupeById(pages: CursorListResponseDto[] | undefined): ArticleListItemDto[] {
  if (!pages) return [];
  const unique = new Map<string, ArticleListItemDto>();
  for (const page of pages) {
    for (const item of page.items) {
      if (!unique.has(item.id)) unique.set(item.id, item);
    }
  }
  return Array.from(unique.values());
}

export function useArticles(scope: ArticleScope = "subscribed") {
  const query = useInfiniteQuery({
    queryKey: scope === "explore" ? exploreArticlesQueryKey : subscribedArticlesQueryKey,
    queryFn: ({ pageParam }) => fetchArticles(scope, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.has_more ? (lastPage.next_cursor ?? undefined) : undefined,
  });

  const items = useMemo(() => dedupeById(query.data?.pages), [query.data]);

  return {
    items,
    isLoading: query.isPending,
    isError: query.isError,
    error: query.error,
    isFetchingNextPage: query.isFetchingNextPage,
    hasNextPage: query.hasNextPage,
    fetchNextPage: query.fetchNextPage,
  };
}
