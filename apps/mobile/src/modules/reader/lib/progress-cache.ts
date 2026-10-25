import type { InfiniteData, QueryClient } from "@tanstack/react-query";
import type { CursorListResponseDto } from "@kyomi/reader/schemas/article";
import { articleListQueryKeys, articleQueryKey } from "@modules/articles/queries/keys";
import type { ProgressUpdate } from "./progress-buffer";
import type { ReadingProgressResult } from "./progress-sync";
import type { ReaderArticle } from "./article";

/**
 * Brings the cached lists and the cached article up to date with a write the server accepted, so
 * the Continue reading badge and the next open of the article need no refetch.
 */
export function applyReadingProgressToCache(
  queryClient: QueryClient,
  articleId: string,
  readingProgress: ReadingProgressResult,
  body: ProgressUpdate,
) {
  for (const queryKey of articleListQueryKeys) {
    queryClient.setQueryData<InfiniteData<CursorListResponseDto>>(queryKey, (current) => {
      if (!current) return current;

      return {
        ...current,
        pages: current.pages.map((page) => ({
          ...page,
          items: page.items.map((item) =>
            item.id === articleId ? { ...item, readingProgress } : item,
          ),
        })),
      };
    });
  }

  queryClient.setQueryData<ReaderArticle>(articleQueryKey(articleId), (current) =>
    current
      ? {
          ...current,
          readingPosition: {
            anchor: body.anchor,
            contentKey: body.contentKey,
            progress: body.progress,
            updatedAt: body.clientUpdatedAt,
          },
          readingProgress,
        }
      : current,
  );
}
