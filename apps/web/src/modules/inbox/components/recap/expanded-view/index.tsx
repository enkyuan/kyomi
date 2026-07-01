"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ScrollArea } from "@kyomi/ui/scroll-area";
import { listFollowedFeeds } from "@modules/feeds/api";
import { followedFeedsQueryKey } from "@modules/inbox/queries/options";
import { ExpandedFolders } from "./folders";
import { ExpandedViewHeader } from "./header";
import { ExpandedSavedItems } from "./saved-items";
import { ExpandedTopSources } from "./top-sources";
import type { RecapFolder, RecapSavedItem, RecapTopViewedFeed } from "../types";

export type RecapExpandedSection = "folders" | "topSources" | "worthRevisiting";

const EXPANDED_SECTION_TITLES = {
  folders: "Folders",
  topSources: "Top Sources",
  worthRevisiting: "Worth revisiting",
} satisfies Record<RecapExpandedSection, string>;

export function RecapExpandedView({
  section,
  folders,
  topViewedFeeds,
  oldestSavedItems,
  followFeed,
  isFollowingFeed,
  moveFeed,
  movingFeedId,
  exportingOpml,
  onCreateFolder,
  onExportOpml,
  onImportOpml,
  onBack,
  onUnsave,
  unsavingItemId,
}: {
  section: RecapExpandedSection;
  folders: RecapFolder[];
  topViewedFeeds: RecapTopViewedFeed[];
  oldestSavedItems: RecapSavedItem[];
  followFeed: (feed: RecapTopViewedFeed) => void;
  isFollowingFeed: (feedId: string) => boolean;
  moveFeed: (feedId: string, folderId: string) => void;
  movingFeedId: string | null;
  exportingOpml: boolean;
  onCreateFolder: () => void;
  onExportOpml: () => void;
  onImportOpml: () => void;
  onBack: () => void;
  onUnsave: (itemId: string) => void;
  unsavingItemId: string | null;
}) {
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
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
      setSelectedFolderId(null);
      return;
    }
    onBack();
  };
  const backLabel = selectedFolder ? "Back to folders" : "Back to recap";

  return (
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
            movingFeedId={movingFeedId}
            selectedFolder={selectedFolder}
            unsortedFolderId={unsortedFolderId}
            onCreateFolder={onCreateFolder}
            onExportOpml={onExportOpml}
            onImportOpml={onImportOpml}
            onSelectFolder={(folder) => setSelectedFolderId(folder.id)}
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
  );
}
