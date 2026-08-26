import type { ArticleListItemDto } from "@kyomi/reader/schemas/article";

export const MAX_RECENT_ARTICLES = 100;

export type RecentArticle = Pick<
  ArticleListItemDto,
  "feedFaviconUrl" | "feedSiteUrl" | "feedTitle" | "feedUrl" | "id" | "link" | "title"
> & {
  readonly viewedAt: string;
};

function toRecentArticle(article: ArticleListItemDto, viewedAt: string): RecentArticle {
  return {
    feedFaviconUrl: article.feedFaviconUrl,
    feedSiteUrl: article.feedSiteUrl,
    feedTitle: article.feedTitle,
    feedUrl: article.feedUrl,
    id: article.id,
    link: article.link,
    title: article.title,
    viewedAt,
  };
}

export function recordRecentArticle(
  articles: readonly RecentArticle[],
  article: ArticleListItemDto,
  viewedAt: string,
): RecentArticle[] {
  if (article.articleType !== "feed") {
    return [...articles];
  }

  return [
    toRecentArticle(article, viewedAt),
    ...articles.filter((recentArticle) => recentArticle.id !== article.id),
  ].slice(0, MAX_RECENT_ARTICLES);
}

function isNullableString(value: unknown): value is string | null {
  return typeof value === "string" || value === null;
}

function isRecentArticle(value: unknown): value is RecentArticle {
  if (!value || typeof value !== "object") {
    return false;
  }

  const article = value as Record<string, unknown>;
  return (
    typeof article.id === "string" &&
    typeof article.title === "string" &&
    typeof article.link === "string" &&
    typeof article.feedTitle === "string" &&
    typeof article.viewedAt === "string" &&
    isNullableString(article.feedFaviconUrl) &&
    isNullableString(article.feedSiteUrl) &&
    isNullableString(article.feedUrl)
  );
}

export function parseRecentArticles(serialized: string | undefined): RecentArticle[] {
  if (!serialized) {
    return [];
  }

  try {
    const parsed = JSON.parse(serialized);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isRecentArticle).slice(0, MAX_RECENT_ARTICLES);
  } catch {
    return [];
  }
}
