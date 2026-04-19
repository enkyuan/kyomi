/**
 * List-time deduplication for feed items that share an equivalent canonical URL
 * within the same feed (historical ingest duplicates, tracking-param variants).
 *
 * Ingest should still prefer unique (feed_id, normalized link) rows; this layer
 * is a defensive guard for the list API cursor pagination window.
 */

export type ArticleListRawRow = {
  id: string;
  title: string;
  link: string;
  summary: string | null;
  publishedAt: Date;
  feedId: string;
  feedTitle: string;
  isRead: boolean;
  isSaved: boolean;
};

// Keep this normalization aligned with ingestion identity rules:
// same-feed links that differ only by tracking params/hash/trailing slash are one article.
export function normalizedArticleIdentity(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    url.hash = "";
    url.hostname = url.hostname.toLowerCase();
    for (const key of [...url.searchParams.keys()]) {
      if (/^utm_/i.test(key) || key === "fbclid" || key === "gclid" || key === "mc_cid") {
        url.searchParams.delete(key);
      }
    }
    if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
      url.pathname = url.pathname.slice(0, -1);
    }
    return url.href;
  } catch {
    return rawUrl;
  }
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
    const key = `${row.feedId}|${normalizedArticleIdentity(row.link)}`;
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
