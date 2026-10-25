import { fireEvent, render, screen } from "@testing-library/react";
import {
  QueryClient,
  QueryClientProvider,
} from "../../../../../../../../apps/web/node_modules/@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { Item } from "@modules/inbox/components/item";
import type { InboxItem } from "@modules/articles/lib/api";
import type { ReadingProgressDto } from "@kyomi/reader/schemas/article";

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

function renderItem({ onSelect = vi.fn(), onIntent = vi.fn(), rowItem = item } = {}) {
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
          isFirst
          showBottomSeparator={false}
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

  test("renders article action controls without selecting the row", async () => {
    const { onSelect } = renderItem();

    for (const label of ["Read later", "Copy link", "Share article", "More"]) {
      expect(screen.getByRole("button", { name: label })).toBeTruthy();
    }

    await click(screen.getByRole("button", { name: "Copy link" }));
    expect(onSelect).not.toHaveBeenCalled();
  });

  describe("continue reading badge", () => {
    function progress(overrides: Partial<ReadingProgressDto> = {}): ReadingProgressDto {
      return {
        progress: 0.4,
        maxProgress: 0.4,
        state: "reading",
        engaged: true,
        remainingMinutes: 6,
        lastReadAt: "2026-07-02T00:00:00.000Z",
        completedAt: null,
        ...overrides,
      };
    }

    test("shows the badge with the time left for an engaged, unfinished article", () => {
      renderItem({ rowItem: { ...item, readingProgress: progress() } });

      expect(screen.getByText("Continue reading · 6 min left")).toBeTruthy();
    });

    test("shows the badge for a resurfacing article", () => {
      renderItem({ rowItem: { ...item, readingProgress: progress({ state: "resurfacing" }) } });

      expect(screen.getByText("Continue reading · 6 min left")).toBeTruthy();
    });

    test("omits the time left when the estimate is unknown", () => {
      renderItem({ rowItem: { ...item, readingProgress: progress({ remainingMinutes: null }) } });

      expect(screen.getByText("Continue reading")).toBeTruthy();
    });

    test("says under a minute when almost done", () => {
      renderItem({ rowItem: { ...item, readingProgress: progress({ remainingMinutes: 0 }) } });

      expect(screen.getByText("Continue reading · Under 1 min left")).toBeTruthy();
    });

    test.each([
      ["no reading state", null],
      ["an article that was not engaged", progress({ engaged: false })],
      ["a completed article", progress({ state: "completed" })],
      ["a dismissed article", progress({ state: "dismissed" })],
      ["an abandoned article", progress({ state: "abandoned" })],
    ])("hides the badge for %s", (_label, readingProgress) => {
      renderItem({ rowItem: { ...item, readingProgress } });

      expect(screen.queryByText(/Continue reading/)).toBeNull();
    });

    test("hides the badge when the field is absent", () => {
      renderItem();

      expect(screen.queryByText(/Continue reading/)).toBeNull();
    });
  });
});
