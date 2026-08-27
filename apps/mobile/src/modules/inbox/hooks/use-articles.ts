import { useInfiniteQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { fetchMobileApiJson } from "@/lib/api";
import { allArticlesPath, allArticlesPrefetchKey } from "@modules/inbox/lib/articles";
import type { ArticleListItemDto, CursorListResponseDto } from "@kyomi/reader/schemas/article";

export const allArticlesQueryKey = ["inbox", "articles", "all"] as const;

async function fetchAllArticles(cursor: string | undefined): Promise<CursorListResponseDto> {
  return fetchMobileApiJson<CursorListResponseDto>(allArticlesPath(cursor), {
    prefetchKey: cursor ? undefined : allArticlesPrefetchKey(),
  });
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

export function useArticles() {
  const query = useInfiniteQuery({
    queryKey: allArticlesQueryKey,
    queryFn: ({ pageParam }) => fetchAllArticles(pageParam),
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
