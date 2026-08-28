import { prefetchMobileApi } from "@lib/api";
import { mobileApiPrefetchKey } from "@lib/prefetch";

const PAGE_LIMIT = 100;

function articlesQuery(cursor?: string): string {
  const query = new URLSearchParams({
    limit: String(PAGE_LIMIT),
    sort: "latest",
  });
  if (cursor) query.set("cursor", cursor);
  return query.toString();
}

export function subscribedArticlesPath(cursor?: string): string {
  return `/api/v1/articles?${articlesQuery(cursor)}`;
}

export function exploreArticlesPath(cursor?: string): string {
  return `/api/v1/articles/views/all?${articlesQuery(cursor)}`;
}

export function exploreArticlesPrefetchKey(): string {
  return mobileApiPrefetchKey(exploreArticlesPath());
}

export function prefetchInitialExploreArticles(): void {
  const path = exploreArticlesPath();
  prefetchMobileApi(path, { prefetchKey: mobileApiPrefetchKey(path) });
}
