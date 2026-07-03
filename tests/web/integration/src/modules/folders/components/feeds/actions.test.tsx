// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, test, vi } from "vitest";
import { FolderFeedActions } from "@modules/folders/components/feeds/actions";

vi.mock("@modules/inbox/components/recap/sections", () => ({
  RailTooltip: ({ children }: { children: ReactElement }) => children,
}));

vi.mock("@modules/inbox/lib/recap/index", () => ({
  formatFeedCount: (count: number) => (count === 1 ? "1 feed" : `${count} feeds`),
}));

function renderActions({
  hasFeeds = true,
  isSelecting = false,
}: {
  hasFeeds?: boolean;
  isSelecting?: boolean;
} = {}) {
  const onAddSources = vi.fn();
  const onExportFeeds = vi.fn();
  const onExportSelected = vi.fn();
  const onMoveSelected = vi.fn();
  const onRemoveSelected = vi.fn();
  const onStartSelecting = vi.fn();

  render(
    <FolderFeedActions
      currentFolderId="folder-tech"
      folderOptions={[
        { label: "Unsorted", value: "folder-unsorted" },
        { label: "Tech", value: "folder-tech" },
      ]}
      hasFeeds={hasFeeds}
      isMovingSelected={false}
      isSelecting={isSelecting}
      selectedCount={0}
      onAddSources={onAddSources}
      onExportFeeds={onExportFeeds}
      onExportSelected={onExportSelected}
      onMoveSelected={onMoveSelected}
      onRemoveSelected={onRemoveSelected}
      onStartSelecting={onStartSelecting}
    />,
  );

  return {
    onAddSources,
    onExportFeeds,
    onStartSelecting,
  };
}

describe("FolderFeedActions", () => {
  test("uses export as the wide action and add as the icon action", () => {
    const { onAddSources, onExportFeeds, onStartSelecting } = renderActions();

    expect(screen.getByRole("button", { name: "Select" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Export" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add sources" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Import OPML" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Select" }));
    fireEvent.click(screen.getByRole("button", { name: "Export" }));
    fireEvent.click(screen.getByRole("button", { name: "Add sources" }));

    expect(onStartSelecting).toHaveBeenCalledTimes(1);
    expect(onExportFeeds).toHaveBeenCalledTimes(1);
    expect(onAddSources).toHaveBeenCalledTimes(1);
  });

  test("keeps add available when a folder has no feeds", () => {
    renderActions({ hasFeeds: false });

    expect((screen.getByRole("button", { name: "Select" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect((screen.getByRole("button", { name: "Export" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect(
      (screen.getByRole("button", { name: "Add sources" }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });
});
