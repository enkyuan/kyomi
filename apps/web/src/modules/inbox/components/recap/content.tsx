"use client";

import { AddFill, Folder2Fill } from "@kyomi/ui/icons/mingcute";
import { Button } from "@kyomi/ui/button";
import { Folders } from "@modules/folders/components/recap/summary";
import type { RecapFolder } from "@modules/folders/lib/types";
import type {
  InboxRecapRailFolderBackTarget,
  InboxRecapRailSection,
} from "@modules/inbox/lib/recap/index";
import { RecapExpandedView } from "./expanded";
import { RecapError, RecapSkeleton, SectionEmpty } from "./sections";
import { TopSources } from "./sections/top-sources";
import { WorthRevisiting } from "./sections/worth-revisiting";
import type { RecapSavedItem, RecapTopViewedFeed } from "./types";

type RemoveFeedsToastOptions = {
  anchor?: HTMLElement | null;
  feedName?: string;
};

export function getRecapScreenKey({
  expandedSection,
  isError,
  isLoading,
}: {
  expandedSection: InboxRecapRailSection | null;
  isError: boolean;
  isLoading: boolean;
}) {
  if (isLoading) {
    return "recap-loading";
  }
  if (isError) {
    return "recap-error";
  }
  return expandedSection ? `recap-expanded-${expandedSection}` : "recap-summary";
}

export function RecapContent({
  expandedSection,
  exportingOpml,
  folders,
  isFollowingFeed,
  isSummaryEmpty,
  movingFeedId,
  movingFeedIds,
  oldestSavedItems,
  recapError,
  recapLoading,
  refetchRecap,
  removeFeeds,
  removingFeedIds,
  selectedFolderBackTarget,
  selectedFolderId,
  topViewedFeeds,
  unsavingItemId,
  followFeed,
  moveFeed,
  moveFeeds,
  navigateRecap,
  onCreateFolder,
  onExportOpml,
  onImportOpml,
  onUnsave,
}: {
  expandedSection: InboxRecapRailSection | null;
  exportingOpml: boolean;
  folders: RecapFolder[];
  isFollowingFeed: (feedId: string) => boolean;
  isSummaryEmpty: boolean;
  movingFeedId: string | null;
  movingFeedIds: string[];
  oldestSavedItems: RecapSavedItem[];
  recapError: boolean;
  recapLoading: boolean;
  refetchRecap: () => void;
  removeFeeds: (feedIds: string[], options?: RemoveFeedsToastOptions) => void;
  removingFeedIds: string[];
  selectedFolderBackTarget: InboxRecapRailFolderBackTarget | null;
  selectedFolderId: string | null;
  topViewedFeeds: RecapTopViewedFeed[];
  unsavingItemId: string | null;
  followFeed: (feed: RecapTopViewedFeed, folderId?: string) => void;
  moveFeed: (feedId: string, folderId: string) => void;
  moveFeeds: (feedIds: string[], folderId: string) => void;
  navigateRecap: (input: {
    direction?: "forward" | "backward";
    rail: InboxRecapRailSection | null;
    railFolderBack?: InboxRecapRailFolderBackTarget;
    railFolderId?: string | null;
  }) => void;
  onCreateFolder: () => void;
  onExportOpml: () => void;
  onImportOpml: () => void;
  onUnsave: (itemId: string) => void;
}) {
  if (recapLoading) {
    return <RecapSkeleton />;
  }
  if (recapError) {
    return <RecapError onRetry={refetchRecap} />;
  }
  if (expandedSection) {
    return (
      <RecapExpandedView
        exportingOpml={exportingOpml}
        folders={folders}
        followFeed={followFeed}
        isFollowingFeed={isFollowingFeed}
        moveFeed={moveFeed}
        moveFeeds={moveFeeds}
        movingFeedIds={movingFeedIds}
        movingFeedId={movingFeedId}
        oldestSavedItems={oldestSavedItems}
        removeFeeds={removeFeeds}
        removingFeedIds={removingFeedIds}
        section={expandedSection}
        selectedFolderBackTarget={selectedFolderBackTarget}
        selectedFolderId={selectedFolderId}
        topViewedFeeds={topViewedFeeds}
        unsavingItemId={unsavingItemId}
        onBack={() => navigateRecap({ direction: "backward", rail: null })}
        onCreateFolder={onCreateFolder}
        onExportOpml={onExportOpml}
        onImportOpml={onImportOpml}
        onSelectFolder={(folderId, backTarget) =>
          navigateRecap({
            direction: folderId ? "forward" : "backward",
            rail: "folders",
            railFolderBack: backTarget,
            railFolderId: folderId,
          })
        }
        onUnsave={onUnsave}
      />
    );
  }
  if (isSummaryEmpty) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center px-4 py-4">
        <SectionEmpty
          title="Nothing here yet"
          description="Folders, top sources, and saved items will appear here as you read and organize feeds."
          icon={<Folder2Fill />}
          action={
            <Button size="sm" onClick={onCreateFolder}>
              <AddFill />
              Create folder
            </Button>
          }
        />
      </div>
    );
  }
  return (
    <div className="grid min-h-0 flex-1 grid-rows-3 gap-4 overflow-hidden py-4">
      <Folders
        folders={folders}
        onExpand={() => navigateRecap({ rail: "folders" })}
        onCreateFolder={onCreateFolder}
        onImportOpml={onImportOpml}
        onSelectFolder={(folder) =>
          navigateRecap({
            rail: "folders",
            railFolderBack: "recap",
            railFolderId: folder.id,
          })
        }
      />
      <TopSources
        feeds={topViewedFeeds}
        folders={folders}
        followFeed={followFeed}
        isFollowingFeed={isFollowingFeed}
        moveFeed={moveFeed}
        movingFeedId={movingFeedId}
        onExpand={() => navigateRecap({ rail: "topSources" })}
      />
      <WorthRevisiting
        items={oldestSavedItems}
        onExpand={() => navigateRecap({ rail: "worthRevisiting" })}
        onUnsave={onUnsave}
        unsavingItemId={unsavingItemId}
      />
    </div>
  );
}
