import { useQuery } from "@tanstack/react-query";
import { fetchMobileApiJson } from "@/lib/api";
import { readerArticlePath, readerArticlePrefetchKey } from "../lib/article-request";
import type { ReaderArticle } from "../lib/article";

export const articleQueryKey = (articleId: string) => ["reader", "article", articleId] as const;

export function useArticle(articleId: string) {
  return useQuery({
    enabled: Boolean(articleId),
    queryFn: ({ signal }) =>
      fetchMobileApiJson<ReaderArticle>(readerArticlePath(articleId), {
        prefetchKey: readerArticlePrefetchKey(articleId),
        signal,
      }),
    queryKey: articleQueryKey(articleId),
    staleTime: 60_000,
  });
}
