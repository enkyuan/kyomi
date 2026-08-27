import { prefetchMobileApi } from "@/lib/api";
import { mobileApiPrefetchKey } from "@/lib/prefetch";

export function readerArticlePath(articleId: string): string {
  return `/api/v1/articles/${encodeURIComponent(articleId)}`;
}

export function readerArticlePrefetchKey(articleId: string): string {
  return mobileApiPrefetchKey(readerArticlePath(articleId));
}

export function prefetchReaderArticle(articleId: string): void {
  const path = readerArticlePath(articleId);
  prefetchMobileApi(path, { prefetchKey: mobileApiPrefetchKey(path) });
}
