import { fireEvent, render, screen } from "@testing-library/react";
import {
  QueryClient,
  QueryClientProvider,
} from "../../../../../../../../apps/web/node_modules/@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { Item } from "@modules/inbox/components/item";
import type { InboxItem } from "@modules/articles/lib/api";

vi.mock("@kyomi/ui/hooks/use-pretext", () => ({
  usePretextLayout: () => ({
    ref: { current: null },
    fittedWidth: undefined,
    maxWidth: 640,
  }),
}));

vi.mock("@modules/articles/components/source", () => ({
  Source: ({ feedTitle }: { feedTitle: string }) => <span>{feedTitle}</span>,
}));

const item: InboxItem = {
  id: "item-1",
  title: "Toolbar click regression",
  summary: "A short summary for the inbox row.",
  link: "https://example.com/article",
  publishedAt: "2026-07-01T00:00:00.000Z",
  feedId: "feed-1",
  feedFaviconUrl: null,
  feedUrl: "https://example.com/feed.xml",
  feedSiteUrl: "https://example.com",
  feedTitle: "Example Feed",
  articleType: "feed",
  isRead: false,
  isSaved: false,
  categories: [],
};

function renderItem({
  onSelect = vi.fn(),
  onIntent = vi.fn(),
  rowItem = item,
  isFirst = true,
  showBottomSeparator = false,
} = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  return {
    onIntent,
    onSelect,
    ...render(
      <QueryClientProvider client={queryClient}>
        <Item
          filter="all"
          item={rowItem}
          isSelected={false}
          isFirst={isFirst}
          showBottomSeparator={showBottomSeparator}
          containerWidth={640}
          density="comfortable"
          fontSizePx={16}
          showFavicons={false}
          timestampDisplay="absolute"
          timestampHourCycle="12h"
          onSelect={onSelect}
          onIntent={onIntent}
        />
      </QueryClientProvider>,
    ),
  };
}

async function click(element: HTMLElement) {
  fireEvent.click(element);
  await Promise.resolve();
}

describe("inbox item row", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "ResizeObserver",
      class ResizeObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  test("selects the item when the row is clicked", async () => {
    const { onSelect } = renderItem();

    await click(screen.getByRole("button", { name: item.title }));

    expect(onSelect).toHaveBeenCalledWith(item);
  });

  test("signals item intent on pointer enter and focus without selecting", () => {
    const { onIntent, onSelect } = renderItem();
    const row = screen.getByRole("button", { name: item.title });

    fireEvent.pointerEnter(row);
    fireEvent.focus(row);

    expect(onIntent).toHaveBeenCalledWith(item);
    expect(onIntent).toHaveBeenCalledTimes(2);
    expect(onSelect).not.toHaveBeenCalled();
  });

  // Value: protects=a row draws the hover-fading top separator hook (data-slot=inbox-item-separator) unless it is the first row;
  //   fails_when=the isFirst guard is inverted or dropped, or the bottom separator is mistaken for the top one;
  //   why_new=no test renders a non-first row, so the separator branch in Item was never exercised;
  //   seam=none; no_claim=real separator paint or hover fade (jsdom has no CSS; only the DOM hook is asserted).
  test("renders the top separator on non-first rows only", () => {
    const first = renderItem({ isFirst: true, showBottomSeparator: true });
    expect(first.container.querySelector('[data-slot="inbox-item-separator"]')).toBeNull();
    first.unmount();

    const later = renderItem({ isFirst: false });
    expect(later.container.querySelectorAll('[data-slot="inbox-item-separator"]')).toHaveLength(1);
  });

  test("renders article action controls without selecting the row", async () => {
    const { onSelect } = renderItem();

    for (const label of ["Read later", "Copy link", "Share article", "More"]) {
      expect(screen.getByRole("button", { name: label })).toBeTruthy();
    }

    await click(screen.getByRole("button", { name: "Copy link" }));
    expect(onSelect).not.toHaveBeenCalled();
  });
});
