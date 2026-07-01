import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { Item } from "@modules/feeds/components/item";
import type { InboxItem } from "@modules/inbox/services/api";

const { mutateMock } = vi.hoisted(() => ({
  mutateMock: vi.fn(),
}));

vi.mock("@modules/inbox/hooks/use-inbox-data", () => ({
  useInboxItemStateMutation: () => ({ mutate: mutateMock }),
}));

vi.mock("@hooks/use-pretext", () => ({
  usePretextLayout: () => ({
    ref: { current: null },
    fittedWidth: undefined,
    maxWidth: 640,
  }),
}));

const item: InboxItem = {
  id: "item-1",
  title: "Toolbar click regression",
  summary: "A short summary for the inbox row.",
  link: "https://example.com/article",
  publishedAt: "2026-07-01T00:00:00.000Z",
  feedFaviconUrl: null,
  feedUrl: "https://example.com/feed.xml",
  feedSiteUrl: "https://example.com",
  feedTitle: "Example Feed",
  articleType: "feed",
  isRead: false,
  isSaved: false,
};

function renderItem({ onSelect = vi.fn(), rowItem = item } = {}) {
  return {
    onSelect,
    ...render(
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
      />,
    ),
  };
}

describe("inbox item toolbar", () => {
  beforeEach(() => {
    mutateMock.mockClear();
    vi.stubGlobal(
      "ResizeObserver",
      class ResizeObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    vi.spyOn(window, "open").mockImplementation(() => null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  test("does not select the item when toolbar controls are clicked", () => {
    const { onSelect } = renderItem();

    for (const label of ["Read later", "Copy link", "Open source article", "More"]) {
      fireEvent.click(screen.getByRole("button", { name: label }));
    }

    expect(onSelect).not.toHaveBeenCalled();
  });

  test("aligns the inline toolbar at the end of the row footer", () => {
    const { container } = renderItem();

    expect(container.querySelector('[data-slot="card-footer"]')?.className).toContain(
      "justify-end",
    );
  });
});
