export type ArticleListItem = {
  readonly id: string;
  readonly title: string;
  readonly link: string;
  readonly summary: string | null;
  readonly publishedAt: string;
  readonly feedId: string;
  readonly feedUrl: string | null;
  readonly feedSiteUrl: string | null;
  readonly feedTitle: string;
  readonly feedFaviconUrl: string | null;
  readonly isRead: boolean;
  readonly isSaved: boolean;
  readonly lastViewedAt: string | null;
  readonly articleType: "feed" | "clip";
  readonly categories: string[];
};

export type ArticleListPage = {
  readonly items: ArticleListItem[];
  readonly nextCursor: string | null;
  readonly hasMore: boolean;
};
