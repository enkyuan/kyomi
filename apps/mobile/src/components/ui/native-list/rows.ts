import { buildFaviconUrlCandidates } from "@kyomi/worker/favicon/browser";
import type { ArticleListItemDto } from "@kyomi/reader/schemas/article";
import { resolveMobileApiUrl } from "@/lib/api";
import { formatArticleTimestamp } from "@modules/articles/lib/format-timestamp";
import { getFeedSourceLabel } from "@modules/articles/lib/source-label";
import type { RecentArticle } from "@modules/recents/lib/history";
import type { ArticleListRow } from "../../../../modules/article-list";

type FaviconSource = {
  readonly feedFaviconUrl: string | null;
  readonly feedSiteUrl: string | null;
  readonly feedUrl: string | null;
  readonly link: string;
};

function faviconUrls(source: FaviconSource): string[] {
  return buildFaviconUrlCandidates(
    source.feedFaviconUrl,
    source.feedSiteUrl,
    source.feedUrl ?? source.link,
  ).map((url) => (url.startsWith("/api/") ? resolveMobileApiUrl(url) : url));
}

// Rows are rebuilt on every page and every save toggle. Unchanged items keep their object identity
// through React Query's structural sharing, so their rows are reused instead of rebuilt.
const articleRows = new WeakMap<ArticleListItemDto, ArticleListRow>();

export function toArticleRow(item: ArticleListItemDto): ArticleListRow {
  const cached = articleRows.get(item);
  if (cached) return cached;

  const row: ArticleListRow = {
    faviconUrls: faviconUrls(item),
    feedTitle: item.feedTitle,
    id: item.id,
    isContinuing: Boolean(item.lastViewedAt),
    isSaved: item.isSaved,
    kind: "article",
    sourceLabel: getFeedSourceLabel(item.link, item.feedTitle),
    summary: item.summary ?? "",
    timeLabel: formatArticleTimestamp(item.publishedAt),
    title: item.title,
  };
  articleRows.set(item, row);
  return row;
}

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
