import type { ArticleReaderContentDto, ArticleStoredContentDto } from "./articles.content.types";

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
  contentHtml: string | null;
  contentText: string | null;
  contentMarkdown: string | null;
  contentStatus: ArticleStoredContentDto["contentStatus"];
  contentSource: ArticleStoredContentDto["contentSource"];
  extractionErrorCode: string | null;
  extractionErrorMessage: string | null;
  reader: ArticleReaderContentDto;
};

export type ArticleUpdateBody = {
  isRead?: boolean | null;
  isSaved?: boolean;
  contentHtml?: string | null;
  contentText?: string | null;
  contentMarkdown?: string | null;
  contentStatus?: ArticleStoredContentDto["contentStatus"] | null;
  contentSource?: ArticleStoredContentDto["contentSource"] | null;
  extractionErrorCode?: string | null;
  extractionErrorMessage?: string | null;
};

export type ArticleCountsDto = {
  unread: number;
  saved: number;
};

export type SavedArticleMatchDto = {
  id: string;
  title: string;
  url: string;
  articleType: "feed" | "clip";
};

export type ArticleSavedCheckDto = {
  is_saved: boolean;
  article: SavedArticleMatchDto | null;
};
