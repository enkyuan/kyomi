// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { Article } from "@modules/reader/components/article";
import type { ArticleDetailDto, ReaderContentDto } from "@kyomi/reader/schemas";

vi.mock("@modules/feeds/components/item/source", () => ({
  Source: ({ feedTitle }: { feedTitle: string }) => <div>{feedTitle}</div>,
}));

vi.mock("@kyomi/reader/web", () => ({
  ReaderContent: () => <div>Reader body</div>,
}));

vi.mock("@hooks/use-timestamp", () => ({
  useTimestamp: () => {},
}));

vi.mock("@hooks/use-toolbar", () => ({
  useReaderToolbar: ({ item }: { item: ArticleDetailDto }) => ({
    articleClassName: "",
    articleStyle: {},
    canRequestExtraction: false,
    displayReader: item.reader.selected,
    extractPending: false,
    extractionError: null,
    floatingToolbarEdge: "bottom",
    inlineToolbarRef: { current: null },
    onRetryExtraction: () => {},
    openLinksInNewTab: false,
    showFailedBanner: false,
    showFloatingToolbar: false,
    showLinkPreviews: false,
    toolbarProps: {
      activeMode: "original",
      canDecreaseFont: true,
      canIncreaseFont: true,
      contentWidth: "wide",
      extractedAvailable: false,
      fontSizePx: 16,
      isSaved: false,
      onCycleContentWidth: () => {},
      onDecreaseFontSize: () => {},
      onIncreaseFontSize: () => {},
      onOpenAi: () => {},
      onOpenOriginal: () => {},
      onShareArticle: () => {},
      onToggleMode: () => {},
      onToggleSaved: () => {},
      onTranslateArticle: () => {},
    },
  }),
}));

function readerContent(overrides: Partial<ReaderContentDto> = {}): ReaderContentDto {
  return {
    contentStatus: "ready",
    contentSource: "feed_markdown",
    bodyKind: "markdown",
    contentBaseUrl: "https://example.com/article",
    title: "Reader title",
    byline: null,
    excerpt: null,
    siteName: null,
    language: null,
    publishedTime: null,
    notice: null,
    extractionErrorCode: null,
    extractionErrorMessage: null,
    shouldExtract: false,
    contentHtml: null,
    contentMarkdown: "Reader body",
    contentText: null,
    fallbackSummary: null,
    fallbackReason: null,
    ...overrides,
  } as ReaderContentDto;
}

function articleDetail(overrides: Partial<ArticleDetailDto> = {}): ArticleDetailDto {
  const selected = readerContent();
  return {
    id: "article-1",
    title: "Reader category chips",
    link: "https://example.com/article",
    summary: null,
    publishedAt: "2026-07-01T00:00:00.000Z",
    feedId: "feed-1",
    feedUrl: "https://example.com/feed.xml",
    feedSiteUrl: "https://example.com",
    feedTitle: "Example Feed",
    feedFaviconUrl: null,
    isRead: false,
    isSaved: false,
    articleType: "feed",
    categories: [],
    contentHtml: null,
    contentText: null,
    contentMarkdown: "Reader body",
    contentStatus: "ready",
    contentSource: "feed_markdown",
    extractionErrorCode: null,
    extractionErrorMessage: null,
    reader: {
      activeMode: "original",
      selected,
      original: {
        available: true,
        content: selected,
      },
      extracted: {
        available: false,
        content: null,
        status: "pending",
        error: null,
        updatedAt: null,
      },
    },
    ...overrides,
  };
}

function renderArticle(item: ArticleDetailDto) {
  return render(
    <Article
      item={item}
      density="comfortable"
      fontSizePx={16}
      showFavicons={false}
      timestampDisplay="relative"
      timestampHourCycle="12h"
      hideInlineToolbar
    />,
  );
}

describe("reader article category chips", () => {
  test("renders fallback reader content in browser surface mode", () => {
    const fallback = readerContent({
      contentStatus: "partial",
      contentSource: "feed_summary",
      bodyKind: "fallback",
      contentHtml: null,
      contentMarkdown: null,
      contentText: null,
      fallbackSummary: "Saved summary while extracted content is pending.",
      fallbackReason: "missing_content",
      shouldExtract: true,
    });

    renderArticle(
      articleDetail({
        summary: "Saved summary while extracted content is pending.",
        reader: {
          activeMode: "original",
          selected: fallback,
          original: {
            available: true,
            content: fallback,
          },
          extracted: {
            available: false,
            content: null,
            status: "pending",
            error: null,
            updatedAt: "2026-07-08T00:00:00.000Z",
          },
        },
      }),
    );

    expect(screen.getByText("Reader body")).toBeTruthy();
  });

  test("shows the same capped topic chips as list rows", () => {
    renderArticle(
      articleDetail({
        categories: ["Technology", "Software Engineering", "Security & Privacy"],
      }),
    );

    expect(screen.getByText("Technology")).toBeTruthy();
    expect(screen.getByText("Software Engineering")).toBeTruthy();
    expect(screen.queryByText("Security & Privacy")).toBeNull();

    const overflow = screen.getByText("+1");
    expect(overflow).toBeTruthy();
    expect(overflow.getAttribute("aria-label")).toContain("Security & Privacy");
  });

  test("omits topic chips when the article has no categories", () => {
    renderArticle(articleDetail({ categories: [] }));

    expect(screen.queryByText("+1")).toBeNull();
    expect(screen.queryByText("Technology")).toBeNull();
  });
});
