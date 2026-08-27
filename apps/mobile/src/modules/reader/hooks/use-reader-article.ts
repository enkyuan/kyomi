import { useQuery } from "@tanstack/react-query";
import { fetchMobileApiJson } from "@/lib/api";
import { readerArticlePath, readerArticlePrefetchKey } from "../lib/article-request";
import type { ReaderArticle } from "../lib/article";

export const readerArticleQueryKey = (articleId: string) =>
  ["reader", "article", articleId] as const;

export function useReaderArticle(articleId: string) {
  return useQuery({
    enabled: Boolean(articleId),
    queryFn: ({ signal }) =>
      fetchMobileApiJson<ReaderArticle>(readerArticlePath(articleId), {
        prefetchKey: readerArticlePrefetchKey(articleId),
        signal,
      }),
    queryKey: readerArticleQueryKey(articleId),
    staleTime: 60_000,
  });
}
