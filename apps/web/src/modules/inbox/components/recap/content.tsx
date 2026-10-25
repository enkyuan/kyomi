"use client";

import { FolderIcon } from "@kyomi/ui/icons/blode";
import { Button } from "@kyomi/ui/components/button";
import { Folders } from "@modules/inbox/components/recap/folders/summary";
import type {
  InboxRecapRailFolderBackTarget,
  InboxRecapRailSection,
} from "@modules/inbox/lib/recap/index";
import { cn } from "@kyomi/ui/lib/utils";
import type { InboxItem } from "@modules/articles/lib/api";
import { RecapExpandedView } from "./expanded";
import {
  RECAP_SUMMARY_LAYOUT_CLASS,
  RECAP_SUMMARY_SECTION_CLASS,
  RecapError,
  RecapSkeleton,
  SectionEmpty,
} from "./sections";
import { ContinueReading } from "./sections/continue-reading";
import { TopSources } from "./sections/top-sources";
import { WorthRevisiting } from "./sections/worth-revisiting";
import type { RecapFolder, RecapSavedItem, RecapTopViewedFeed } from "../../lib/recap/types";

type RemoveFeedsToastOptions = {
  anchor?: HTMLElement | null;
  feedName?: string;
};

export function RecapContent({
  expandedSection,
  exportingOpml,
  continueReadingItems,
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
  onDismissContinueReading,
  onExportOpml,
  onImportOpml,
  onUnsave,
}: {
  expandedSection: InboxRecapRailSection | null;
  exportingOpml: boolean;
  continueReadingItems: InboxItem[];
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
  onDismissContinueReading: (itemId: string) => void;
  onExportOpml: () => void;
  onImportOpml: () => void;
  onUnsave: (itemId: string) => void;
}) {
  const hasContinueReading = continueReadingItems.length > 0;
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
  if (isSummaryEmpty && !hasContinueReading) {
    return (
      <div className="flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden px-4 py-4">
        <SectionEmpty
          title="Nothing here yet"
          description="Folders, top sources, and saved items will appear here as you read and organize feeds."
          icon={<FolderIcon />}
          action={
            <Button shape="pill" size="sm" onClick={onCreateFolder}>
              Create folder
            </Button>
          }
        />
      </div>
    );
  }
  return (
    <div className={cn(RECAP_SUMMARY_LAYOUT_CLASS, hasContinueReading && "grid-rows-4")}>
      <div className={RECAP_SUMMARY_SECTION_CLASS}>
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
      </div>
      <div className={RECAP_SUMMARY_SECTION_CLASS}>
        <TopSources
          feeds={topViewedFeeds}
          folders={folders}
          followFeed={followFeed}
          isFollowingFeed={isFollowingFeed}
          moveFeed={moveFeed}
          movingFeedId={movingFeedId}
          onExpand={() => navigateRecap({ rail: "topSources" })}
        />
      </div>
      {hasContinueReading ? (
        <div className={RECAP_SUMMARY_SECTION_CLASS}>
          <ContinueReading items={continueReadingItems} onDismiss={onDismissContinueReading} />
        </div>
      ) : null}
      <div className={RECAP_SUMMARY_SECTION_CLASS}>
        <WorthRevisiting
          items={oldestSavedItems}
          onExpand={() => navigateRecap({ rail: "worthRevisiting" })}
          onUnsave={onUnsave}
          unsavingItemId={unsavingItemId}
        />
      </div>
    </div>
  );
}
