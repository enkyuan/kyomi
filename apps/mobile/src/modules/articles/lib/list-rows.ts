import { buildFaviconUrlCandidates } from "@kyomi/worker/favicon/browser";
import type { ArticleListItemDto } from "@kyomi/reader/schemas/article";
import { resolveMobileApiUrl } from "@/lib/api";
import { continueReadingBadge } from "./continue-reading";
import { formatArticleTimestamp } from "./format-timestamp";
import { getFeedSourceLabel } from "./source-label";
import type { ArticleListRow } from "../../../../modules/article-list";

type FaviconSource = {
  readonly feedFaviconUrl: string | null;
  readonly feedSiteUrl: string | null;
  readonly feedUrl: string | null;
  readonly link: string;
};

export function faviconUrls(source: FaviconSource): string[] {
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

  const badge = continueReadingBadge(item);
  const row: ArticleListRow = {
    ...(badge.label ? { continueLabel: badge.label } : {}),
    faviconUrls: faviconUrls(item),
    feedTitle: item.feedTitle,
    id: item.id,
    isContinuing: badge.isContinuing,
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
