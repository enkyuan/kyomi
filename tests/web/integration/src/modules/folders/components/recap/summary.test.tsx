// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { describe, expect, test, vi } from "vitest";
import { Folders } from "@modules/folders/components/recap/summary";

vi.mock("@modules/inbox/lib/recap", () => ({
  formatFeedCount: (count: number) => (count === 1 ? "1 feed" : `${count} feeds`),
}));

vi.mock("@modules/inbox/components/recap/sections", () => ({
  RailTooltip: ({ children }: { children: ReactElement }) => children,
  RecapSection: ({
    title,
    action,
    children,
  }: {
    title: string;
    action?: ReactNode;
    children: ReactNode;
  }) => (
    <section>
      <div>
        <h3>{title}</h3>
        {action}
      </div>
      {children}
    </section>
  ),
  SectionEmpty: ({
    title,
    action,
  }: {
    title: string;
    description: string;
    icon?: ReactNode;
    action?: ReactNode;
  }) => (
    <div>
      <p>{title}</p>
      {action}
    </div>
  ),
}));

type RecapFolder = {
  id: string;
  name: string;
  createdAt: string;
  isPinned: boolean;
  pinnedAt: string | null;
  feedCount: number;
};

const folders: RecapFolder[] = [
  {
    id: "folder-unsorted",
    name: "Unsorted",
    createdAt: "2026-07-03T00:00:00.000Z",
    isPinned: false,
    pinnedAt: null,
    feedCount: 6,
  },
  {
    id: "folder-tech",
    name: "Tech",
    createdAt: "2026-07-03T00:00:00.000Z",
    isPinned: false,
    pinnedAt: null,
    feedCount: 3,
  },
  {
    id: "folder-test",
    name: "Test",
    createdAt: "2026-07-03T00:00:00.000Z",
    isPinned: false,
    pinnedAt: null,
    feedCount: 0,
  },
];

function renderFolders() {
  const onCreateFolder = vi.fn();
  const onExpand = vi.fn();
  const onImportOpml = vi.fn();
  const onSelectFolder = vi.fn();

  render(
    <Folders
      folders={folders}
      onCreateFolder={onCreateFolder}
      onExpand={onExpand}
      onImportOpml={onImportOpml}
      onSelectFolder={onSelectFolder}
    />,
  );

  return { onCreateFolder, onExpand, onImportOpml, onSelectFolder };
}

describe("recap folders summary", () => {
  test("opens folder feeds from a compact folder row without opening the folder manager", () => {
    const { onExpand, onSelectFolder } = renderFolders();
    const techRow = screen.getByText("Tech").closest("button");

    expect(techRow).toBeTruthy();
    fireEvent.click(techRow as HTMLButtonElement);

    expect(onSelectFolder).toHaveBeenCalledWith(folders[1]);
    expect(onExpand).not.toHaveBeenCalled();
    expect(screen.queryByRole("link", { name: /Tech/ })).toBeNull();
  });

  test("keeps compact actions rail-scoped and fixed below the folder slots", () => {
    const { onCreateFolder, onExpand, onImportOpml } = renderFolders();

    const manageButton = screen.getByRole("button", { name: /Manage/ });
    const importButton = screen.getByRole("button", { name: "Import OPML" });
    const addButton = screen.getByRole("button", { name: "Create folder" });
    const actionRow = manageButton.closest(".grid");

    expect(actionRow?.className).toContain("mt-auto");
    expect(screen.queryByRole("button", { name: "Export OPML" })).toBeNull();

    fireEvent.click(manageButton);
    fireEvent.click(importButton);
    fireEvent.click(addButton);

    expect(onExpand).toHaveBeenCalledTimes(1);
    expect(onImportOpml).toHaveBeenCalledTimes(1);
    expect(onCreateFolder).toHaveBeenCalledTimes(1);
  });
});
