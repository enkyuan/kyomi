import { useQuery } from "@tanstack/react-query";
import { fetchMobileApiJson } from "@/lib/api";
import { readerDocumentHeaders } from "@/lib/reader-document";
import { readerArticlePath, readerArticlePrefetchKey } from "@modules/articles/lib/requests";
import { articleQueryKey } from "@modules/articles/queries/keys";
import type { ReaderArticle } from "../lib/article";

export function useArticle(articleId: string) {
  return useQuery({
    enabled: Boolean(articleId),
    queryFn: ({ signal }) =>
      fetchMobileApiJson<ReaderArticle>(readerArticlePath(articleId), {
        headers: readerDocumentHeaders(),
        prefetchKey: readerArticlePrefetchKey(articleId),
        signal,
      }),
    queryKey: articleQueryKey(articleId),
    staleTime: 60_000,
  });
}
