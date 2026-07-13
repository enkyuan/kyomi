import { render, screen } from "@testing-library/react";
import {
  QueryClient,
  QueryClientProvider,
} from "../../../../../../../../apps/web/node_modules/@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { Item } from "@modules/feeds/components/item";
import type { InboxItem } from "@modules/inbox/lib/articles/index";

vi.mock("@hooks/use-pretext", () => ({
  usePretextLayout: () => ({ ref: { current: null }, fittedWidth: undefined, maxWidth: 640 }),
}));

vi.mock("@modules/feeds/components/item/source", () => ({
  Source: ({ feedTitle }: { feedTitle: string }) => <span>{feedTitle}</span>,
}));

const baseItem: InboxItem = {
  id: "item-1",
  title: "Category chip row",
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

function renderItem(rowItem: InboxItem) {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  return render(
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
        onSelect={vi.fn()}
      />
    </QueryClientProvider>,
  );
}

describe("feed item category chips", () => {
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

  test("renders no chips when there are no categories", () => {
    renderItem(baseItem);
    expect(screen.queryByText("Engineering")).toBeNull();
    expect(screen.queryByText("Saved")).toBeNull();
  });

  test("renders a single category chip", () => {
    renderItem({ ...baseItem, categories: ["Engineering"] });
    expect(screen.getByText("Engineering")).toBeTruthy();
  });

  test("renders at most two chips and summarizes overflow with +N", () => {
    renderItem({ ...baseItem, categories: ["Engineering", "AI", "Design", "Science"] });
    expect(screen.getByText("Engineering")).toBeTruthy();
    expect(screen.getByText("AI")).toBeTruthy();
    expect(screen.queryByText("Design")).toBeNull();
    const overflow = screen.getByText("+2");
    expect(overflow).toBeTruthy();
    expect(overflow.getAttribute("aria-label")).toContain("Design");
    expect(overflow.getAttribute("aria-label")).toContain("Science");
  });

  test("shows the saved chip alongside category chips", () => {
    renderItem({ ...baseItem, isSaved: true, categories: ["Engineering"] });
    const savedChip = screen.getByText("Saved");
    expect(savedChip).toBeTruthy();
    expect(savedChip.className).toContain("bg-mizu/8");
    expect(savedChip.className).toContain("text-mizu-foreground");
    expect(savedChip.className).toContain("dark:bg-mizu/16");
    expect(screen.getByText("Engineering")).toBeTruthy();
  });

  test("renders inline action controls with chips rendered", () => {
    renderItem({ ...baseItem, categories: ["Engineering"] });
    expect(screen.getByRole("button", { name: "More" })).toBeTruthy();
  });
});
