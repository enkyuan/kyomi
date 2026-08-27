import { prefetchMobileApi } from "@lib/api";
import { mobileApiPrefetchKey } from "@lib/prefetch";

const PAGE_LIMIT = 100;

export function allArticlesPath(cursor?: string): string {
  const query = new URLSearchParams({
    limit: String(PAGE_LIMIT),
    sort: "latest",
  });
  if (cursor) query.set("cursor", cursor);

  return `/api/v1/articles/views/all?${query.toString()}`;
}

export function allArticlesPrefetchKey(): string {
  return mobileApiPrefetchKey(allArticlesPath());
}

export function prefetchInitialAllArticles(): void {
  const path = allArticlesPath();
  prefetchMobileApi(path, { prefetchKey: mobileApiPrefetchKey(path) });
}
