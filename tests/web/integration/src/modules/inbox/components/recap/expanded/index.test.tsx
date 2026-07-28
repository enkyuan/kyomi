// @vitest-environment jsdom

import {
  QueryClient,
  QueryClientProvider,
} from "../../../../../../../../../apps/web/node_modules/@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { describe, expect, test, vi } from "vitest";
import {
  RecapExpandedView,
  type SelectedFolderBackTarget,
} from "@modules/inbox/components/recap/expanded";
import type { RecapFolder } from "@modules/folders/lib/types";

vi.mock("@kyomi/ui/atoms/transition", () => ({
  Transition: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@hooks/use-transition", () => ({
  useTransition: () => ({}),
}));

vi.mock("@modules/feeds/lib/api", () => ({
  listFollowedFeeds: vi.fn().mockResolvedValue([]),
}));

vi.mock("@modules/inbox/queries/options", () => ({
  followedFeedsQueryKey: () => ["feeds", "followed"],
}));

vi.mock("@modules/folders/components/recap/expanded", () => ({
  ExpandedFolders: ({ selectedFolder }: { selectedFolder: RecapFolder | null }) => (
    <div>{selectedFolder?.name ?? "Folders"}</div>
  ),
}));

vi.mock("@modules/inbox/components/recap/expanded/saved-items", () => ({
  ExpandedSavedItems: () => <div>Saved items</div>,
}));

vi.mock("@modules/inbox/components/recap/expanded/top-sources", () => ({
  ExpandedTopSources: () => <div>Top sources</div>,
}));

vi.mock("@modules/inbox/components/recap/sections", () => ({
  RailTooltip: ({ children }: { children: ReactElement }) => children,
}));

const folders: RecapFolder[] = [
  {
    id: "folder-unsorted",
    name: "Unsorted",
    createdAt: "2026-07-03T00:00:00.000Z",
    isPinned: false,
    pinnedAt: null,
    feedCount: 7,
  },
  {
    id: "folder-tech",
    name: "Tech",
    createdAt: "2026-07-03T00:00:00.000Z",
    isPinned: false,
    pinnedAt: null,
    feedCount: 3,
  },
];

function renderExpandedView(backTarget: SelectedFolderBackTarget) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  const onBack = vi.fn();
  const onSelectFolder = vi.fn();

  render(
    <QueryClientProvider client={queryClient}>
      <RecapExpandedView
        exportingOpml={false}
        folders={folders}
        followFeed={vi.fn()}
        isFollowingFeed={() => false}
        moveFeed={vi.fn()}
        moveFeeds={vi.fn()}
        movingFeedIds={[]}
        movingFeedId={null}
        oldestSavedItems={[]}
        removeFeeds={vi.fn()}
        removingFeedIds={[]}
        section="folders"
        selectedFolderBackTarget={backTarget}
        selectedFolderId="folder-tech"
        topViewedFeeds={[]}
        unsavingItemId={null}
        onBack={onBack}
        onCreateFolder={vi.fn()}
        onExportOpml={vi.fn()}
        onImportOpml={vi.fn()}
        onSelectFolder={onSelectFolder}
        onUnsave={vi.fn()}
      />
    </QueryClientProvider>,
  );

  return { onBack, onSelectFolder };
}

describe("RecapExpandedView folder back behavior", () => {
  test("backs to the recap start when a compact recap folder opened the feed list", () => {
    const { onBack, onSelectFolder } = renderExpandedView("recap");

    fireEvent.click(screen.getByRole("button", { name: "Back to recap" }));

    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onSelectFolder).not.toHaveBeenCalled();
  });

  test("backs to the folder manager when the manager opened the feed list", () => {
    const { onBack, onSelectFolder } = renderExpandedView("folders");

    fireEvent.click(screen.getByRole("button", { name: "Back to folders" }));

    expect(onBack).not.toHaveBeenCalled();
    expect(onSelectFolder).toHaveBeenCalledWith(null);
  });
});
