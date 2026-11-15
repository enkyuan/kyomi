import { articleDetailSchema } from "@kyomi/reader/schemas/article";
import { fetchValidatedJson } from "@kyomi/reader/schemas/json";
import { useQuery } from "@tanstack/react-query";
import { fetchMobileApiJson } from "@/lib/api";
import { readerDocumentHeaders } from "@/lib/reader-document";
import { readerArticlePath, readerArticlePrefetchKey } from "@modules/articles/lib/requests";
import { articleQueryKey } from "@modules/articles/queries/keys";
import type { ReaderArticle } from "../lib/article";

export function useArticle(articleId: string) {
  return useQuery({
    enabled: Boolean(articleId),
    // Validated like the web client, so an API contract change surfaces as one error here, not as
    // a crash deeper in the reader.
    queryFn: ({ signal }): Promise<ReaderArticle> =>
      fetchValidatedJson(articleDetailSchema, () =>
        fetchMobileApiJson<unknown>(readerArticlePath(articleId), {
          headers: readerDocumentHeaders(),
          prefetchKey: readerArticlePrefetchKey(articleId),
          signal,
        }),
      ),
    queryKey: articleQueryKey(articleId),
    staleTime: 60_000,
  });
}
