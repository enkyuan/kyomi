import { useSyncExternalStore } from "react";
import { createAppStorage } from "@lib/storage";
import type { ArticleListItemDto } from "@kyomi/reader/schemas/article";
import { parseRecentArticles, recordRecentArticle, type RecentArticle } from "./history";

const RECENT_ARTICLES_KEY = "recent-articles";
const storage = createAppStorage("recent-articles");
const listeners = new Set<() => void>();

let snapshot: RecentArticle[] | undefined;

function getSnapshot(): RecentArticle[] {
  snapshot ??= parseRecentArticles(storage.getString(RECENT_ARTICLES_KEY));
  return snapshot;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notifyListeners() {
  for (const listener of listeners) {
    listener();
  }
}

export function useRecentArticles() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function saveRecentArticle(
  article: ArticleListItemDto,
  viewedAt = new Date().toISOString(),
) {
  if (article.articleType !== "feed") {
    return;
  }

  const nextSnapshot = recordRecentArticle(getSnapshot(), article, viewedAt);
  snapshot = nextSnapshot;
  storage.set(RECENT_ARTICLES_KEY, JSON.stringify(nextSnapshot));
  notifyListeners();
}
