"use client";

import { Refresh2Fill, Rss2Fill } from "@mingcute/react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@kyomi/ui/button";
import { ScrollArea } from "@kyomi/ui/scroll-area";
import { toastManager } from "@kyomi/ui/toast";
import type { FollowedFeed } from "@modules/feeds/lib/api";
import type { RecapFolder } from "@modules/folders/lib/types";
import { SectionEmpty } from "@modules/inbox/components/recap/sections";
import { FolderFeedActions } from "./actions";
import { FolderFeedRow } from "./row";
import { downloadSelectedOpml } from "../../lib/opml";

type FolderOption = { label: string; value: string };
type RemoveFeedsToastOptions = {
  anchor?: HTMLElement | null;
  feedName?: string;
};

export function ExpandedFolderFeeds({
  folder,
  folderOptions,
  feeds,
  isLoading,
  moveFeed,
  moveFeeds,
  movingFeedIds,
  movingFeedId,
  removeFeeds,
  removingFeedIds,
  onImportOpml,
  unsortedFolderId,
}: {
  folder: RecapFolder;
  folderOptions: FolderOption[];
  feeds: FollowedFeed[];
  isLoading: boolean;
  moveFeed: (feedId: string, folderId: string) => void;
  moveFeeds: (feedIds: string[], folderId: string) => void;
  movingFeedIds: string[];
  movingFeedId: string | null;
  removeFeeds: (feedIds: string[], options?: RemoveFeedsToastOptions) => void;
  removingFeedIds: string[];
  onImportOpml: () => void;
  unsortedFolderId: string | null;
}) {
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedFeedIds, setSelectedFeedIds] = useState<Set<string>>(() => new Set());
  const [previousFolderId, setPreviousFolderId] = useState(folder.id);
  if (previousFolderId !== folder.id) {
    setPreviousFolderId(folder.id);
    setIsSelecting(false);
    setSelectedFeedIds(new Set());
  }
  const folderFeeds = useMemo(
    () =>
      feeds.filter((feed) => {
        const feedFolderId = feed.folderId ?? unsortedFolderId;
        return feedFolderId === folder.id;
      }),
    [feeds, folder.id, unsortedFolderId],
  );
  const folderFeedIdSet = useMemo(
    () => new Set(folderFeeds.map((feed) => feed.feedId)),
    [folderFeeds],
  );
  const selectedFeeds = useMemo(
    () => folderFeeds.filter((feed) => selectedFeedIds.has(feed.feedId)),
    [folderFeeds, selectedFeedIds],
  );
  const selectedFeedIdList = useMemo(
    () => selectedFeeds.map((feed) => feed.feedId),
    [selectedFeeds],
  );
  const isBulkMutatingSelected = selectedFeedIdList.some(
    (feedId) => movingFeedIds.includes(feedId) || removingFeedIds.includes(feedId),
  );
  const isUnsortedFolder = Boolean(unsortedFolderId && folder.id === unsortedFolderId);

  useEffect(() => {
    setSelectedFeedIds((current) => {
      const next = new Set([...current].filter((feedId) => folderFeedIdSet.has(feedId)));
      return next.size === current.size ? current : next;
    });
  }, [folderFeedIdSet]);

  const setFeedSelected = (feedId: string, selected: boolean) => {
    setSelectedFeedIds((current) => {
      const next = new Set(current);
      if (selected) {
        next.add(feedId);
      } else {
        next.delete(feedId);
      }
      return next;
    });
  };

  const toggleFeedSelected = (feedId: string) => {
    setSelectedFeedIds((current) => {
      const next = new Set(current);
      if (next.has(feedId)) {
        next.delete(feedId);
      } else {
        next.add(feedId);
      }
      return next;
    });
  };

  const cancelSelecting = () => {
    setIsSelecting(false);
    setSelectedFeedIds(new Set());
  };

  const moveSelectedFeeds = (folderId: string) => {
    if (selectedFeedIdList.length === 0) {
      return;
    }
    moveFeeds(selectedFeedIdList, folderId);
    cancelSelecting();
  };

  const removeSelectedFeeds = () => {
    if (selectedFeedIdList.length === 0) {
      return;
    }
    if (isUnsortedFolder) {
      removeFeeds(selectedFeedIdList);
      cancelSelecting();
      return;
    }
    if (!unsortedFolderId) {
      return;
    }
    moveFeeds(selectedFeedIdList, unsortedFolderId);
    cancelSelecting();
  };

  const exportFeeds = (
    feedsToExport: FollowedFeed[],
    description: string | ((count: number) => string),
  ) => {
    if (feedsToExport.length === 0) {
      return;
    }
    downloadSelectedOpml(folder, feedsToExport);
    toastManager.add({
      title: "OPML exported",
      description:
        typeof description === "function" ? description(feedsToExport.length) : description,
      type: "success",
    });
  };
  const exportFolderFeeds = () =>
    exportFeeds(folderFeeds, (count) =>
      count === 1 ? "1 source exported." : `${count} sources exported.`,
    );
  const exportSelectedFeeds = () =>
    exportFeeds(selectedFeeds, (count) =>
      count === 1 ? "1 selected source exported." : `${count} selected sources exported.`,
    );

  if (isLoading) {
    return (
      <div className="flex h-full min-h-0 px-4">
        <SectionEmpty
          title="Loading feeds"
          description="Collecting sources in this folder."
          icon={<Refresh2Fill className="animate-spin" />}
        />
      </div>
    );
  }

  if (folderFeeds.length === 0) {
    return (
      <div className="flex h-full min-h-0 flex-col px-4">
        <div className="flex min-h-0 flex-1">
          <SectionEmpty
            title="No feeds here"
            description="Add some sources to get started."
            icon={<Rss2Fill />}
          />
        </div>
        <FolderFeedActions
          currentFolderId={folder.id}
          folderOptions={folderOptions}
          hasFeeds={false}
          isMovingSelected={false}
          isSelecting={false}
          selectedCount={0}
          onAddSources={onImportOpml}
          onExportFeeds={exportFolderFeeds}
          onExportSelected={exportSelectedFeeds}
          onMoveSelected={moveSelectedFeeds}
          onRemoveSelected={removeSelectedFeeds}
          onStartSelecting={() => setIsSelecting(true)}
        />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {isSelecting ? (
        <div className="mb-2 flex h-7 shrink-0 items-center justify-between gap-2 px-5">
          <span className="min-w-0 truncate text-muted-foreground text-sm">
            {selectedFeeds.length === 1 ? "1 selected" : `${selectedFeeds.length} selected`}
          </span>
          <Button
            className="h-7 rounded-full px-2.5 before:rounded-full"
            size="xs"
            variant="ghost"
            onClick={cancelSelecting}
          >
            Cancel
          </Button>
        </div>
      ) : null}
      <ScrollArea className="min-h-0 flex-1" scrollbarGutter>
        <div className="min-w-0 space-y-2.5 px-4 pb-1">
          {folderFeeds.map((feed) => (
            <FolderFeedRow
              key={feed.feedId}
              feed={feed}
              folderOptions={folderOptions}
              isSelected={selectedFeedIds.has(feed.feedId)}
              isSelecting={isSelecting}
              moveFeed={moveFeed}
              movingFeedId={movingFeedId}
              setFeedSelected={setFeedSelected}
              toggleFeedSelected={toggleFeedSelected}
              unsortedFolderId={unsortedFolderId}
            />
          ))}
        </div>
      </ScrollArea>
      <div className="px-4">
        <FolderFeedActions
          currentFolderId={folder.id}
          folderOptions={folderOptions}
          hasFeeds={folderFeeds.length > 0}
          isMovingSelected={isBulkMutatingSelected}
          isSelecting={isSelecting}
          selectedCount={selectedFeeds.length}
          onAddSources={onImportOpml}
          onExportFeeds={exportFolderFeeds}
          onExportSelected={exportSelectedFeeds}
          onMoveSelected={moveSelectedFeeds}
          onRemoveSelected={removeSelectedFeeds}
          onStartSelecting={() => setIsSelecting(true)}
        />
      </div>
    </div>
  );
}
