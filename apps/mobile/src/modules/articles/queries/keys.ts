export const subscribedArticlesQueryKey = ["inbox", "articles", "subscribed"] as const;
export const exploreArticlesQueryKey = ["inbox", "articles", "explore"] as const;

/** Every cached article list, for state changes that must reach each of them. */
export const articleListQueryKeys = [exploreArticlesQueryKey, subscribedArticlesQueryKey] as const;

export const articleQueryKey = (articleId: string) => ["reader", "article", articleId] as const;
