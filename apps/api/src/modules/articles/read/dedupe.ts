/**
 * List-time deduplication for feed items that share an equivalent canonical URL
 * within the same feed (historical ingest duplicates, tracking-param variants).
 *
 * TODO: Remove this one release after the canonical_url backfill and
 * unique(feed_id, canonical_url) migration are verified in production. This layer
 * is now only a defensive guard for the list API cursor pagination window.
 */
import { normalizeArticleUrl } from "@kyomi/worker";

export type ArticleListRawRow = {
  id: string;
  title: string;
  canonicalUrl: string;
  link: string;
  summary: string | null;
  publishedAt: Date;
  feedId: string;
  feedUrl: string | null;
  feedSiteUrl: string | null;
  feedTitle: string;
  feedFaviconUrl: string | null;
  isRead: boolean;
  isSaved: boolean;
};

export function normalizedArticleIdentity(rawUrl: string): string {
  return normalizeArticleUrl(rawUrl);
}

function rowRichnessScore(row: ArticleListRawRow): number {
  const summaryScore = row.summary?.trim() ? 2 : 0;
  const titleScore = row.title.trim().length >= 6 ? 1 : 0;
  return summaryScore + titleScore;
}

function shouldPreferRow(candidate: ArticleListRawRow, current: ArticleListRawRow): boolean {
  const candidateScore = rowRichnessScore(candidate);
  const currentScore = rowRichnessScore(current);
  if (candidateScore !== currentScore) {
    return candidateScore > currentScore;
  }
  if (candidate.publishedAt.getTime() !== current.publishedAt.getTime()) {
    return candidate.publishedAt.getTime() > current.publishedAt.getTime();
  }
  return candidate.id > current.id;
}

export function collapseObviousDuplicates(rows: ArticleListRawRow[]): ArticleListRawRow[] {
  const deduped = new Map<string, ArticleListRawRow>();
  for (const row of rows) {
    // Contract: persisted canonical_url is the primary feed-item identity.
    // Link-based normalization is only a defensive fallback for mixed historical rows.
    const persistedIdentity = row.canonicalUrl.trim();
    const identity =
      persistedIdentity.length > 0 ? persistedIdentity : normalizedArticleIdentity(row.link);
    const key = `${row.feedId}|${identity}`;
    const existing = deduped.get(key);
    if (!existing || shouldPreferRow(row, existing)) {
      deduped.set(key, row);
    }
  }
  return [...deduped.values()].sort((a, b) => {
    const publishedDiff = b.publishedAt.getTime() - a.publishedAt.getTime();
    if (publishedDiff !== 0) {
      return publishedDiff;
    }
    if (a.id === b.id) {
      return 0;
    }
    return a.id < b.id ? 1 : -1;
  });
}
