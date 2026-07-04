import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { Item } from "@modules/feeds/components/item";
import type { InboxItem } from "@modules/inbox/lib/articles/index";

const {
  anchoredToastAddMock,
  mutateAsyncMock,
  mutateMock,
  reportBrokenArticleMock,
  toastAddMock,
  toastUpdateMock,
} = vi.hoisted(() => ({
  anchoredToastAddMock: vi.fn(),
  mutateAsyncMock: vi.fn(),
  mutateMock: vi.fn(),
  reportBrokenArticleMock: vi.fn(),
  toastAddMock: vi.fn(),
  toastUpdateMock: vi.fn(),
}));

vi.mock("@modules/inbox/hooks/use-inbox-data", () => ({
  useInboxItemStateMutation: () => ({ mutate: mutateMock, mutateAsync: mutateAsyncMock }),
}));

vi.mock("@modules/inbox/lib/articles/index", () => ({
  reportBrokenArticle: reportBrokenArticleMock,
}));

vi.mock("@kyomi/ui/toast", () => ({
  anchoredToastManager: {
    add: anchoredToastAddMock,
  },
  toastManager: {
    add: toastAddMock,
    update: toastUpdateMock,
  },
}));

vi.mock("@hooks/use-pretext", () => ({
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

async function click(element: HTMLElement) {
  await act(async () => {
    fireEvent.click(element);
    await Promise.resolve();
  });
}

describe("inbox item toolbar", () => {
  beforeEach(() => {
    mutateAsyncMock.mockResolvedValue(undefined);
    anchoredToastAddMock.mockClear();
    mutateAsyncMock.mockClear();
    mutateMock.mockClear();
    reportBrokenArticleMock.mockReset();
    toastAddMock.mockReturnValue("toast-1");
    toastAddMock.mockClear();
    toastUpdateMock.mockClear();
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

  test("does not select the item when toolbar controls are clicked", async () => {
    const { onSelect } = renderItem();

    for (const label of ["Read later", "Copy link", "Share article", "More"]) {
      await click(screen.getByRole("button", { name: label }));
    }
    await click(screen.getByRole("menuitem", { name: "Open source" }));

    expect(onSelect).not.toHaveBeenCalled();
  });

  test("aligns the inline toolbar at the end of the row footer", () => {
    const { container } = renderItem();

    expect(container.querySelector('[data-slot="card-footer"]')?.className).toContain(
      "justify-end",
    );
  });

  test("marks an item hidden when Not interested is clicked", async () => {
    renderItem();

    await click(screen.getByRole("button", { name: "More" }));
    await click(screen.getByRole("menuitem", { name: "Not interested" }));

    expect(mutateMock).toHaveBeenCalledWith({
      itemId: item.id,
      patch: { isHidden: true },
      removeFromList: true,
    });
  });

  test("uses an anchored toast when saving an item to read later", async () => {
    renderItem();

    const button = screen.getByRole("button", { name: "Read later" });
    await click(button);

    expect(mutateAsyncMock).toHaveBeenCalledWith({
      itemId: item.id,
      patch: { isSaved: true },
    });
    await waitFor(() => {
      expect(anchoredToastAddMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Article saved",
          type: "success",
          timeout: 1800,
          data: { groupKey: "article.saved-state", tooltipStyle: true },
          positionerProps: expect.objectContaining({
            anchor: button,
            side: "top",
            align: "center",
            sideOffset: 6,
            positionMethod: "fixed",
          }),
        }),
      );
    });
    expect(anchoredToastAddMock.mock.calls[0]?.[0]).not.toHaveProperty("description");
    expect(toastAddMock).not.toHaveBeenCalled();
    expect(toastUpdateMock).not.toHaveBeenCalled();
  });

  test("uses an anchored toast when removing an item from read later", async () => {
    renderItem({ rowItem: { ...item, isSaved: true } });

    const button = screen.getByRole("button", { name: "Remove from read later" });
    await click(button);

    expect(mutateAsyncMock).toHaveBeenCalledWith({
      itemId: item.id,
      patch: { isSaved: false },
    });
    await waitFor(() => {
      expect(anchoredToastAddMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Article unsaved",
          type: "info",
          timeout: 1800,
          data: { groupKey: "article.saved-state", tooltipStyle: true },
          positionerProps: expect.objectContaining({
            anchor: button,
            side: "top",
            align: "center",
            sideOffset: 6,
            positionMethod: "fixed",
          }),
        }),
      );
    });
    expect(anchoredToastAddMock.mock.calls[0]?.[0]).not.toHaveProperty("description");
    expect(toastAddMock).not.toHaveBeenCalled();
    expect(toastUpdateMock).not.toHaveBeenCalled();
  });

  test("opens a broken article report dialog from the more menu", async () => {
    renderItem();

    await click(screen.getByRole("button", { name: "More" }));
    await click(screen.getByRole("menuitem", { name: "Report broken article" }));

    const dialog = screen.getByRole("dialog", { name: "Report broken article" });
    expect(within(dialog).getByText("Toolbar click regression")).toBeTruthy();
  });

  test("does not select the item when the broken article dialog is canceled", async () => {
    const { onSelect } = renderItem();

    await click(screen.getByRole("button", { name: "More" }));
    await click(screen.getByRole("menuitem", { name: "Report broken article" }));
    await click(screen.getByRole("button", { name: "Cancel" }));

    expect(onSelect).not.toHaveBeenCalled();
    expect(reportBrokenArticleMock).not.toHaveBeenCalled();
  });
});
