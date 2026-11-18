import type { QueryClient } from "@tanstack/react-query";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { ArticleListItemDto } from "@kyomi/reader/schemas/article";

/**
 * The stores one account fills on a device. The test passes the real modules, loaded after its
 * module mocks are registered, so this file never imports React Native code itself.
 */
export type AccountStores = {
  readonly queryClient: QueryClient;
  readonly readingProgressSync: {
    push(articleId: string, body: typeof progressUpdate): Promise<unknown>;
  };
  saveRecentArticle(article: ArticleListItemDto): void;
  useRecentArticles(): readonly { readonly id: string }[];
  writeReaderPosition(articleId: string, index: number): void;
};

export const article = (id: string): ArticleListItemDto => ({
  articleType: "feed",
  categories: [],
  feedFaviconUrl: null,
  feedId: "feed-id",
  feedSiteUrl: "https://example.com",
  feedTitle: "Example",
  feedUrl: "https://example.com/feed.xml",
  id,
  isRead: false,
  isSaved: false,
  lastViewedAt: null,
  link: `https://example.com/${id}`,
  publishedAt: "2026-08-05T12:00:00.000Z",
  summary: null,
  title: `Private article ${id}`,
});

export const progressUpdate = {
  anchor: null,
  clientUpdatedAt: "2026-10-24T12:00:00.000Z",
  completed: false,
  contentKey: "html:none",
  progress: 0.4,
  sessionActiveMs: 4_000,
  sessionId: "session-a",
};

/** The query cache key the persister writes, as `createSyncStoragePersister` names it by default. */
export const PERSISTED_QUERY_CACHE_KEY = "kyomi:query-cache:REACT_QUERY_OFFLINE_CACHE";

/** Ids of the reading history as a screen reads it. */
export function recentIds(stores: AccountStores): string[] {
  let ids: string[] = [];
  function Probe() {
    ids = stores.useRecentArticles().map((recent) => recent.id);
    return null;
  }
  renderToStaticMarkup(createElement(Probe));
  return ids;
}

/**
 * Fills every store one account would: cached articles (in memory and persisted), reading history,
 * a reading position, and a progress write the unreachable API left queued. The caller makes the
 * API fail first.
 */
export async function seedAccount(
  stores: AccountStores,
  localStorage: { setItem(key: string, value: string): void },
  id: string,
) {
  stores.queryClient.setQueryData(["articles", "views", "all"], {
    pages: [{ items: [article(id)] }],
  });
  localStorage.setItem(
    PERSISTED_QUERY_CACHE_KEY,
    JSON.stringify({
      buster: "",
      clientState: { mutations: [], queries: [] },
      timestamp: Date.now(),
    }),
  );
  stores.saveRecentArticle(article(id));
  stores.writeReaderPosition(id, 7);
  await stores.readingProgressSync.push(id, progressUpdate);
}
