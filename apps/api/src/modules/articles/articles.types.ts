export type ArticleListItemDto = {
  id: string;
  title: string;
  link: string;
  summary: string | null;
  publishedAt: string;
  feedId: string;
  feedTitle: string;
  isRead: boolean;
  isSaved: boolean;
  articleType: "feed" | "clip";
};

export type ArticlesCursorListResponseDto = {
  items: ArticleListItemDto[];
  next_cursor: string | null;
  has_more: boolean;
  total_count: null;
};

export type ArticleDetailDto = ArticleListItemDto & {
  content: string | null;
};

export type ArticleUpdateBody = {
  isRead?: boolean | null;
  isSaved?: boolean;
};

export type ArticleCountsDto = {
  unread: number;
  saved: number;
};
