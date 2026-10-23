import { formatArticleTimestamp } from "@modules/articles/lib/format-timestamp";
import { faviconUrls } from "@modules/articles/lib/list-rows";
import { getFeedSourceLabel } from "@modules/articles/lib/source-label";
import type { ArticleListRow } from "../../../../modules/article-list";
import type { RecentArticle } from "./history";

const recentRows = new WeakMap<RecentArticle, ArticleListRow>();

export function toRecentRow(article: RecentArticle): ArticleListRow {
  const cached = recentRows.get(article);
  if (cached) return cached;

  const row: ArticleListRow = {
    faviconUrls: faviconUrls(article),
    feedTitle: article.feedTitle,
    id: article.id,
    kind: "recent",
    sourceLabel: getFeedSourceLabel(article.link, article.feedTitle),
    timeLabel: `Viewed ${formatArticleTimestamp(article.viewedAt)}`,
    title: article.title,
  };
  recentRows.set(article, row);
  return row;
}
