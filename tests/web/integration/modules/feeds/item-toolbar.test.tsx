import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { Item } from "@modules/feeds/components/item";
import type { InboxItem } from "@modules/inbox/services/api";

const { mutateAsyncMock, mutateMock, reportBrokenArticleMock } = vi.hoisted(() => ({
  mutateAsyncMock: vi.fn(),
  mutateMock: vi.fn(),
  reportBrokenArticleMock: vi.fn(),
}));

vi.mock("@modules/inbox/hooks/use-inbox-data", () => ({
  useInboxItemStateMutation: () => ({ mutate: mutateMock, mutateAsync: mutateAsyncMock }),
}));

vi.mock("@modules/inbox/services/api", () => ({
  reportBrokenArticle: reportBrokenArticleMock,
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
    mutateAsyncMock.mockResolvedValue(undefined);
    mutateAsyncMock.mockClear();
    mutateMock.mockClear();
    reportBrokenArticleMock.mockReset();
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

    for (const label of ["Read later", "Copy link", "Share article", "More"]) {
      fireEvent.click(screen.getByRole("button", { name: label }));
    }
    fireEvent.click(screen.getByRole("menuitem", { name: "Open source" }));

    expect(onSelect).not.toHaveBeenCalled();
  });

  test("aligns the inline toolbar at the end of the row footer", () => {
    const { container } = renderItem();

    expect(container.querySelector('[data-slot="card-footer"]')?.className).toContain(
      "justify-end",
    );
  });

  test("marks an item hidden when Not interested is clicked", () => {
    renderItem();

    fireEvent.click(screen.getByRole("button", { name: "More" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Not interested" }));

    expect(mutateMock).toHaveBeenCalledWith({
      itemId: item.id,
      patch: { isHidden: true },
      removeFromList: true,
    });
  });

  test("opens a broken article report dialog from the more menu", () => {
    renderItem();

    fireEvent.click(screen.getByRole("button", { name: "More" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Report broken article" }));

    const dialog = screen.getByRole("dialog", { name: "Report broken article" });
    expect(within(dialog).getByText("Toolbar click regression")).toBeTruthy();
  });
});
