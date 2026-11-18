import { toFeedArticleDetailDto } from "@modules/articles/read/detail";

type DetailRow = Parameters<typeof toFeedArticleDetailDto>[0];

export function feedDetailRow(overrides: Partial<DetailRow> = {}): DetailRow {
  return {
    id: "article-1",
    title: "Title",
    link: "https://example.com/post",
    summary: null,
    imageUrl: null,
    content: null,
    contentHtml: null,
    contentSanitizerVersion: null,
    contentText: null,
    contentMarkdown: null,
    contentStatus: "ready",
    contentSource: "feed_html",
    extractionErrorCode: null,
    extractionErrorMessage: null,
    extractedContentHtml: null,
    extractedContentText: null,
    extractedContentStatus: "pending",
    extractedContentError: null,
    extractedContentUpdatedAt: null,
    extractedContentSanitizerVersion: null,
    publishedAt: new Date("2026-01-01T00:00:00Z"),
    feedId: "feed-1",
    feedUrl: null,
    feedSiteUrl: null,
    feedTitle: "Feed",
    feedFaviconUrl: null,
    isRead: false,
    isSaved: false,
    lastViewedAt: null,
    categories: [],
    readingPosition: null,
    readingPositionUpdatedAt: null,
    readingProgress: null,
    readingProgressUpdatedAt: null,
    readingState: null,
    ...overrides,
  } as DetailRow;
}

export function feedDetail(overrides: Partial<DetailRow> = {}) {
  return toFeedArticleDetailDto(feedDetailRow(overrides));
}
