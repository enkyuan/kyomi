import type {
  ArticleReaderContentDto,
  ArticleStoredContentDto,
  ExtractedContentStatus,
} from "./reader/content-types";

export type ArticleListItemDto = {
  id: string;
  title: string;
  link: string;
  summary: string | null;
  publishedAt: string;
  feedId: string;
  feedTitle: string;
  feedFaviconUrl: string | null;
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

export type ReaderMode = "original" | "extracted";

/**
 * Canonical reader contract:
 * - server picks `activeMode` + `selected` (smart/default selection),
 * - client may switch mode explicitly via user preference/toggle only.
 */
export type ArticleReaderDto = {
  activeMode: ReaderMode;
  selected: ArticleReaderContentDto;
  original: {
    available: boolean;
    content: ArticleReaderContentDto;
  };
  extracted: {
    available: boolean;
    content: ArticleReaderContentDto | null;
    status: ExtractedContentStatus;
    error: string | null;
    updatedAt: string | null;
  };
};

export type ArticleDetailDto = ArticleListItemDto & {
  contentHtml: string | null;
  contentText: string | null;
  contentMarkdown: string | null;
  contentStatus: ArticleStoredContentDto["contentStatus"];
  contentSource: ArticleStoredContentDto["contentSource"];
  extractionErrorCode: string | null;
  extractionErrorMessage: string | null;
  reader: ArticleReaderDto;
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
  all?: number;
  unread: number;
  saved: number;
  /** Present when the client supplied `published_after` + `published_before` (local “today” window). */
  today?: number;
};

export type ArticleCountScope = {
  feedId?: string;
  folderId?: string;
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
