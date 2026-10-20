// @vitest-environment jsdom

import { render } from "@testing-library/react";
import type { ReactNode, Ref } from "react";
import { describe, expect, test, vi } from "vitest";
import { List } from "@modules/inbox/components/list";
import type { ArticleDetailDto } from "@kyomi/reader/schemas";

vi.mock("@modules/inbox/hooks/use-viewport", () => ({
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

vi.mock("@modules/reader/hooks/use-toolbar", () => ({
  useReaderToolbar: () => ({ toolbarProps: {} }),
}));

vi.mock("@kyomi/ui/components/scroll-area", () => ({
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
  ScrollBar: ({
    orientation,
    placement,
    ...props
  }: {
    orientation: string;
    placement?: string;
    className?: string;
  }) => (
    <div
      data-orientation={orientation}
      data-placement={placement}
      data-slot="scroll-area-scrollbar"
      {...props}
    />
  ),
}));

describe("List scrollbar surface", () => {
  // Value: protects=the inbox list scrollbar asks for placement="viewport" so it pins to the window edge beside the reader scrollbar;
  //   fails_when=the placement prop is dropped or reverted to the inline position: fixed style, so the track follows its pane;
  //   why_new=strengthens this test: the ScrollBar mock swallowed placement, so only class and slot were asserted;
  //   seam=none; no_claim=real portalling and fixed positioning (ScrollBar is mocked; ScrollBar's own test covers that).
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

    expect(scrollbar?.getAttribute("data-slot")).toBe("scroll-area-scrollbar");
    expect(scrollbar?.className).toContain("z-50");
    expect(scrollbar?.getAttribute("data-orientation")).toBe("vertical");
    expect(scrollbar?.getAttribute("data-placement")).toBe("viewport");
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
