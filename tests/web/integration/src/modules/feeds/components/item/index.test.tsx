import { fireEvent, render, screen } from "@testing-library/react";
import {
  QueryClient,
  QueryClientProvider,
} from "../../../../../../../../apps/web/node_modules/@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { Item } from "@modules/feeds/components/item";
import type { InboxItem } from "@modules/inbox/lib/articles/index";

vi.mock("@kyomi/ui/hooks/use-pretext", () => ({
  usePretextLayout: () => ({
    ref: { current: null },
    fittedWidth: undefined,
    maxWidth: 640,
  }),
}));

vi.mock("@modules/feeds/components/item/source", () => ({
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

function renderItem({ onSelect = vi.fn(), rowItem = item } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  return {
    onSelect,
    ...render(
      <QueryClientProvider client={queryClient}>
        <Item
          filter="all"
          item={rowItem}
          isSelected={false}
          isFirst
          showBottomSeparator={false}
          containerWidth={640}
          density="comfortable"
          fontSizePx={16}
          showFavicons={false}
          timestampDisplay="absolute"
          timestampHourCycle="12h"
          onSelect={onSelect}
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

  test("renders article action controls without selecting the row", async () => {
    const { onSelect } = renderItem();

    for (const label of ["Read later", "Copy link", "Share article", "More"]) {
      expect(screen.getByRole("button", { name: label })).toBeTruthy();
    }

    await click(screen.getByRole("button", { name: "Copy link" }));
    expect(onSelect).not.toHaveBeenCalled();
  });
});
