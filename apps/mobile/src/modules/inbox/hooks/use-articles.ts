import { useInfiniteQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { fetchMobileApiJson } from "@/lib/api-client";
import type { ArticleListItem, ArticleListPage } from "@modules/inbox/lib/articles";

const PAGE_LIMIT = 100;
export const allArticlesQueryKey = ["inbox", "articles", "all"] as const;

type ArticlesAllResponse = {
  items: ArticleListItem[];
  next_cursor: string | null;
  has_more: boolean;
};

async function fetchAllArticles(cursor: string | undefined): Promise<ArticleListPage> {
  const query = new URLSearchParams({
    limit: String(PAGE_LIMIT),
    sort: "latest",
  });
  if (cursor) query.set("cursor", cursor);

  const data = await fetchMobileApiJson<ArticlesAllResponse>(
    `/api/v1/articles/views/all?${query.toString()}`,
  );

  return { items: data.items, nextCursor: data.next_cursor, hasMore: data.has_more };
}

function dedupeById(pages: ArticleListPage[] | undefined): ArticleListItem[] {
  if (!pages) return [];
  const unique = new Map<string, ArticleListItem>();
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
      lastPage.hasMore ? (lastPage.nextCursor ?? undefined) : undefined,
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
