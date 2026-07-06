// @vitest-environment jsdom

import { render } from "@testing-library/react";
import type { ReactNode, Ref } from "react";
import { describe, expect, test, vi } from "vitest";
import { List } from "@modules/inbox/components/list";
import type { ArticleDetailDto } from "@lib/schemas";

vi.mock("@hooks/use-viewport", () => ({
  useViewport: () => ({
    containerWidth: 640,
    viewportHeight: 720,
    hasVerticalOverflow: true,
  }),
}));

vi.mock("@hooks/use-hydrated", () => ({
  useHydrated: () => true,
}));

vi.mock("@tanstack/react-router", () => ({
  useElementScrollRestoration: () => undefined,
}));

vi.mock("@modules/inbox/components/list/rows", () => ({
  SkeletonRows: () => <div data-slot="skeleton-rows" />,
  VirtualizedRows: () => <div data-slot="virtualized-rows" />,
}));

vi.mock("@modules/reader/components/toolbar", () => ({
  Toolbar: () => <div data-slot="reader-toolbar" />,
}));

vi.mock("@hooks/use-toolbar", () => ({
  useReaderToolbar: () => ({ toolbarProps: {} }),
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
  BrowserScrollBar: ({ orientation, ...props }: { orientation: string; className?: string }) => (
    <div data-orientation={orientation} data-slot="browser-scrollbar" {...props} />
  ),
}));

describe("List scrollbar surface", () => {
  test("renders the inbox list scrollbar on the browser viewport surface", () => {
    const { container } = render(
      <List
        inboxItems={[]}
        filter="my-feed"
        display={{ showFavicons: true }}
        density="comfortable"
        fontSizePx={16}
        timestampDisplay="relative"
        timestampHourCycle="12h"
        pagination={{
          isLoading: true,
          isRefreshing: false,
          hasNextPage: false,
          isFetchingNextPage: false,
          fetchNextPage: vi.fn(),
        }}
        onSelectItem={vi.fn()}
        onSortChange={vi.fn()}
      />,
    );
    const scrollbar = container.querySelector('[aria-label="Inbox list scrollbar"]');

    expect(scrollbar?.getAttribute("data-slot")).toBe("browser-scrollbar");
    expect(scrollbar?.className).toContain("!fixed");
    expect(scrollbar?.className).toContain("!right-0");
  });

  test("does not render the browser scrollbar while the list pane is hidden", () => {
    const { container } = render(
      <List
        inboxItems={[]}
        filter="my-feed"
        display={{ showFavicons: true }}
        density="comfortable"
        fontSizePx={16}
        timestampDisplay="relative"
        timestampHourCycle="12h"
        showScrollbar={false}
        pagination={{
          isLoading: true,
          isRefreshing: false,
          hasNextPage: false,
          isFetchingNextPage: false,
          fetchNextPage: vi.fn(),
        }}
        onSelectItem={vi.fn()}
        onSortChange={vi.fn()}
      />,
    );

    expect(container.querySelector('[aria-label="Inbox list scrollbar"]')).toBeNull();
  });
});

describe("List scoped article header", () => {
  test("does not render article action toolbar while the article surface is skeleton loading", () => {
    const selectedArticle = { id: "article-1", title: "Loading article" } as ArticleDetailDto;
    const { container } = render(
      <List
        inboxItems={[]}
        filter="my-feed"
        display={{ showFavicons: true }}
        density="comfortable"
        fontSizePx={16}
        timestampDisplay="relative"
        timestampHourCycle="12h"
        isArticleScoped
        selectedArticle={selectedArticle}
        pagination={{
          isLoading: true,
          isRefreshing: false,
          hasNextPage: false,
          isFetchingNextPage: false,
          fetchNextPage: vi.fn(),
        }}
        onBackToList={vi.fn()}
        onFilterChange={vi.fn()}
        onSelectItem={vi.fn()}
        onSortChange={vi.fn()}
      />,
    );

    expect(container.querySelector('[data-slot="reader-toolbar"]')).toBeNull();
  });
});
