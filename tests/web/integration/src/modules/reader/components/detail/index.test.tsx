// @vitest-environment jsdom

import { render } from "@testing-library/react";
import type { ReactNode, Ref } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { Detail } from "@modules/reader/components/detail";
import type { ArticleDetailDto, ReaderContentDto } from "@kyomi/reader/schemas";

vi.mock("@modules/reader/hooks/use-preferences", () => ({
  useReaderPreferences: () => ({
    preferences: { contentWidth: "wide" },
  }),
}));

vi.mock("@kyomi/ui/scroll-area", () => ({
  ScrollAreaPrimitive: {
    Root: ({ children, ...props }: { children: ReactNode }) => (
      <div data-slot="scroll-area-root" {...props}>
        {children}
      </div>
    ),
    Viewport: ({ children, ref, ...props }: { children: ReactNode; ref?: Ref<HTMLDivElement> }) => (
      <div ref={ref} data-slot="scroll-area-viewport" {...props}>
        {children}
      </div>
    ),
  },
  ScrollBar: ({ orientation, ...props }: { orientation: string; className?: string }) => (
    <div data-orientation={orientation} data-slot="scroll-area-scrollbar" {...props} />
  ),
  BrowserScrollBar: ({ orientation, ...props }: { orientation: string; className?: string }) => (
    <div data-orientation={orientation} data-slot="browser-scrollbar" {...props} />
  ),
}));

vi.mock("@modules/reader/components/detail/content", () => ({
  ContentView: () => <div>Reader detail content</div>,
}));

const readerContent: ReaderContentDto = {
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
};

const article: ArticleDetailDto = {
  id: "article-1",
  title: "Reader detail",
  link: "https://example.com/article",
  summary: null,
  publishedAt: "2026-07-01T00:00:00.000Z",
  feedId: "feed-1",
  feedUrl: "https://example.com/feed.xml",
  feedSiteUrl: "https://example.com",
  feedTitle: "Example",
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
    selected: readerContent,
    original: {
      available: true,
      content: readerContent,
    },
    extracted: {
      available: false,
      content: null,
      status: "pending",
      error: null,
      updatedAt: null,
    },
  },
};

const originalScrollTo = HTMLElement.prototype.scrollTo;

function renderDetail(surface?: "browser" | "card") {
  return render(
    <Detail
      detailState={{ status: "selected", item: article }}
      density="comfortable"
      fontSizePx={16}
      showFavicons
      timestampDisplay="relative"
      timestampHourCycle="12h"
      surface={surface}
    />,
  );
}

describe("Detail scrollbar surface", () => {
  beforeEach(() => {
    Object.defineProperty(HTMLElement.prototype, "scrollTo", {
      configurable: true,
      value: vi.fn(),
    });
  });

  afterEach(() => {
    if (originalScrollTo) {
      Object.defineProperty(HTMLElement.prototype, "scrollTo", {
        configurable: true,
        value: originalScrollTo,
      });
      return;
    }

    delete (HTMLElement.prototype as { scrollTo?: unknown }).scrollTo;
  });

  test("defaults the reader scrollbar to the browser viewport surface", () => {
    const { container } = renderDetail();
    const scrollbar = container.querySelector('[aria-label="Reader scrollbar"]');

    expect(scrollbar?.className).toContain("!fixed");
    expect(scrollbar?.className).toContain("!right-0");
  });

  test("keeps the reader scrollbar local for the card surface", () => {
    const { container } = renderDetail("card");
    const scrollbar = container.querySelector('[aria-label="Reader scrollbar"]');

    expect(scrollbar?.className).not.toContain("!fixed");
    expect(scrollbar?.className).not.toContain("!right-0");
  });
});
