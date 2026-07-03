"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ScrollArea } from "@kyomi/ui/scroll-area";
import { Transition, type TransitionDirection } from "@kyomi/ui/transition";
import { useTransition } from "@hooks/use-transition";
import { listFollowedFeeds } from "@modules/feeds/lib/api";
import { ExpandedFolders } from "@modules/folders/components/recap/expanded";
import type { RecapFolder } from "@modules/folders/lib/types";
import { followedFeedsQueryKey } from "@modules/inbox/queries/options";
import { ExpandedViewHeader } from "./header";
import { ExpandedSavedItems } from "./saved-items";
import { ExpandedTopSources } from "./top-sources";
import type { RecapSavedItem, RecapTopViewedFeed } from "../types";

export type RecapExpandedSection = "folders" | "topSources" | "worthRevisiting";
export type SelectedFolderBackTarget = "folders" | "recap";
type RemoveFeedsToastOptions = {
  anchor?: HTMLElement | null;
  feedName?: string;
};

const EXPANDED_SECTION_TITLES = {
  folders: "Folders",
  topSources: "Top Sources",
  worthRevisiting: "Worth revisiting",
} satisfies Record<RecapExpandedSection, string>;
const EXPANDED_SECTION_TRANSITION_OFFSET_PX = 28;

export function RecapExpandedView({
  section,
  folders,
  topViewedFeeds,
  oldestSavedItems,
  followFeed,
  isFollowingFeed,
  moveFeed,
  moveFeeds,
  movingFeedIds,
  movingFeedId,
  removeFeeds,
  removingFeedIds,
  exportingOpml,
  selectedFolderId,
  selectedFolderBackTarget,
  onCreateFolder,
  onExportOpml,
  onImportOpml,
  onBack,
  onSelectFolder,
  onUnsave,
  unsavingItemId,
}: {
  section: RecapExpandedSection;
  folders: RecapFolder[];
  topViewedFeeds: RecapTopViewedFeed[];
  oldestSavedItems: RecapSavedItem[];
  followFeed: (feed: RecapTopViewedFeed, folderId?: string) => void;
  isFollowingFeed: (feedId: string) => boolean;
  moveFeed: (feedId: string, folderId: string) => void;
  moveFeeds: (feedIds: string[], folderId: string) => void;
  movingFeedIds: string[];
  movingFeedId: string | null;
  removeFeeds: (feedIds: string[], options?: RemoveFeedsToastOptions) => void;
  removingFeedIds: string[];
  exportingOpml: boolean;
  selectedFolderId: string | null;
  selectedFolderBackTarget: SelectedFolderBackTarget | null;
  onCreateFolder: () => void;
  onExportOpml: () => void;
  onImportOpml: () => void;
  onBack: () => void;
  onSelectFolder: (folderId: string | null, backTarget?: SelectedFolderBackTarget) => void;
  onUnsave: (itemId: string) => void;
  unsavingItemId: string | null;
}) {
  const [folderScreenDirection, setFolderScreenDirection] =
    useState<TransitionDirection>("forward");
  const folderOptions = useMemo(
    () => folders.map((folder) => ({ label: folder.name, value: folder.id })),
    [folders],
  );
  const selectedFolder =
    section === "folders" && selectedFolderId
      ? (folders.find((folder) => folder.id === selectedFolderId) ?? null)
      : null;
  const { data: followedFeeds = [], isLoading: followedFeedsLoading } = useQuery({
    queryKey: followedFeedsQueryKey(),
    queryFn: () => listFollowedFeeds(),
    enabled: section === "folders",
  });
  const unsortedFolderId = useMemo(
    () => folders.find((folder) => folder.name === "Unsorted")?.id ?? null,
    [folders],
  );

  const handleBack = () => {
    if (selectedFolder) {
      setFolderScreenDirection("backward");
      if (selectedFolderBackTarget === "recap") {
        onBack();
        return;
      }
      onSelectFolder(null);
      return;
    }
    onBack();
  };
  const selectFolder = (folder: RecapFolder) => {
    setFolderScreenDirection("forward");
    onSelectFolder(folder.id, "folders");
  };
  const backLabel =
    selectedFolder && selectedFolderBackTarget !== "recap" ? "Back to folders" : "Back to recap";
  const screenKey = selectedFolder ? `folder-${selectedFolder.id}` : `section-${section}`;
  const folderTransition = useTransition({
    className: "relative min-h-0 min-w-0 flex-1 overflow-hidden",
    contentKey: screenKey,
    direction: folderScreenDirection,
    mode: "popLayout",
    offset: EXPANDED_SECTION_TRANSITION_OFFSET_PX,
  });

  return (
    <Transition {...folderTransition}>
      <div className="flex min-h-0 flex-1 flex-col py-4">
        <ExpandedViewHeader
          backLabel={backLabel}
          title={selectedFolder?.name ?? EXPANDED_SECTION_TITLES[section]}
          onBack={handleBack}
        />
        {section === "folders" ? (
          <div className="min-h-0 flex-1">
            <ExpandedFolders
              exportingOpml={exportingOpml}
              folders={folders}
              followedFeeds={followedFeeds}
              followedFeedsLoading={followedFeedsLoading}
              folderOptions={folderOptions}
              moveFeed={moveFeed}
              moveFeeds={moveFeeds}
              movingFeedIds={movingFeedIds}
              movingFeedId={movingFeedId}
              removeFeeds={removeFeeds}
              removingFeedIds={removingFeedIds}
              selectedFolder={selectedFolder}
              unsortedFolderId={unsortedFolderId}
              onCreateFolder={onCreateFolder}
              onExportOpml={onExportOpml}
              onImportOpml={onImportOpml}
              onSelectFolder={selectFolder}
            />
          </div>
        ) : (
          <ScrollArea className="min-h-0 flex-1 overflow-hidden px-4" scrollbarGutter>
            {section === "topSources" ? (
              <ExpandedTopSources
                feeds={topViewedFeeds}
                folderOptions={folderOptions}
                followFeed={followFeed}
                isFollowingFeed={isFollowingFeed}
                moveFeed={moveFeed}
                movingFeedId={movingFeedId}
              />
            ) : (
              <ExpandedSavedItems
                items={oldestSavedItems}
                onUnsave={onUnsave}
                unsavingItemId={unsavingItemId}
              />
            )}
          </ScrollArea>
        )}
      </div>
    </Transition>
  );
}
