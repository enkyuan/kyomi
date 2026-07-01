"use client";

import { Link } from "@tanstack/react-router";
import { Refresh2Fill, Rss2Fill } from "@mingcute/react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@kyomi/ui/button";
import { Checkbox } from "@kyomi/ui/checkbox";
import { ScrollArea } from "@kyomi/ui/scroll-area";
import { toastManager } from "@kyomi/ui/toast";
import { cn } from "@lib/utils";
import type { FollowedFeed } from "@modules/feeds/api";
import { FeedFavicon } from "@modules/sidebar/components/feed-favicon";
import { downloadSelectedOpml } from "./folder-feed-opml";
import { FolderFeedActions } from "./folder-feed-actions";
import { FolderPickerButton } from "../sections/top-sources";
import type { RecapFolder } from "../types";
import { SectionEmpty } from "../sections";

type FolderOption = { label: string; value: string };

function getFollowedFeedSource(feed: FollowedFeed) {
  const value = feed.link ?? feed.url;
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return value;
  }
}

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
  removeFeeds: (feedIds: string[]) => void;
  removingFeedIds: string[];
  onImportOpml: () => void;
  unsortedFolderId: string | null;
}) {
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedFeedIds, setSelectedFeedIds] = useState<Set<string>>(() => new Set());
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
    setIsSelecting(false);
    setSelectedFeedIds(new Set());
  }, [folder.id]);

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

  const exportSelectedFeeds = () => {
    if (selectedFeeds.length === 0) {
      return;
    }
    downloadSelectedOpml(folder, selectedFeeds);
    toastManager.add({
      title: "OPML exported",
      description:
        selectedFeeds.length === 1
          ? "1 selected source exported."
          : `${selectedFeeds.length} selected sources exported.`,
      type: "success",
    });
  };

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
        <div className="min-h-0 flex-1">
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
          onExportSelected={exportSelectedFeeds}
          onImportOpml={onImportOpml}
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
          {folderFeeds.map((feed) => {
            const currentFolderId =
              feed.folderId ?? unsortedFolderId ?? folderOptions[0]?.value ?? "";
            const currentFolder = folderOptions.find((option) => option.value === currentFolderId);
            const isSelected = selectedFeedIds.has(feed.feedId);

            return (
              <div
                key={feed.feedId}
                className={cn(
                  "group flex h-13 w-full min-w-0 items-center gap-2.5 rounded-2xl px-2 text-base transition-colors hover:bg-accent/70",
                  isSelecting && "cursor-pointer",
                  isSelected && "bg-accent/70",
                )}
                role={isSelecting ? "button" : undefined}
                tabIndex={isSelecting ? 0 : undefined}
                onClick={isSelecting ? () => toggleFeedSelected(feed.feedId) : undefined}
                onKeyDown={
                  isSelecting
                    ? (event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          toggleFeedSelected(feed.feedId);
                        }
                      }
                    : undefined
                }
              >
                {isSelecting ? (
                  <>
                    <FeedFavicon
                      className="size-9 shrink-0"
                      faviconUrl={feed.faviconUrl}
                      feedUrl={feed.url}
                      shape="squircle"
                      siteUrl={feed.link}
                      squircleCornerRadius={8}
                      title={feed.title || feed.url}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{feed.title || feed.url}</span>
                      <span className="block truncate text-muted-foreground text-sm">
                        {getFollowedFeedSource(feed)}
                      </span>
                    </span>
                    <Checkbox
                      aria-label={`Select ${feed.title || feed.url}`}
                      checked={isSelected}
                      onCheckedChange={(checked) => setFeedSelected(feed.feedId, checked === true)}
                      onClick={(event) => event.stopPropagation()}
                    />
                  </>
                ) : (
                  <>
                    <Link
                      className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
                      to="/inbox"
                      search={(prev) => ({
                        ...prev,
                        filter: "all" as const,
                        feedId: feed.feedId,
                        folderId: undefined,
                        itemId: undefined,
                        search: undefined,
                      })}
                    >
                      <FeedFavicon
                        className="size-9 shrink-0"
                        faviconUrl={feed.faviconUrl}
                        feedUrl={feed.url}
                        shape="squircle"
                        siteUrl={feed.link}
                        squircleCornerRadius={8}
                        title={feed.title || feed.url}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{feed.title || feed.url}</span>
                        <span className="block truncate text-muted-foreground text-sm">
                          {getFollowedFeedSource(feed)}
                        </span>
                      </span>
                    </Link>
                    {currentFolderId ? (
                      <FolderPickerButton
                        currentFolderId={currentFolderId}
                        currentFolderName={currentFolder?.label ?? "Unsorted"}
                        feedTitle={feed.title || feed.url}
                        folders={folderOptions}
                        isMoving={movingFeedId === feed.feedId}
                        onMove={(folderId) => moveFeed(feed.feedId, folderId)}
                      />
                    ) : null}
                  </>
                )}
              </div>
            );
          })}
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
          onExportSelected={exportSelectedFeeds}
          onImportOpml={onImportOpml}
          onMoveSelected={moveSelectedFeeds}
          onRemoveSelected={removeSelectedFeeds}
          onStartSelecting={() => setIsSelecting(true)}
        />
      </div>
    </div>
  );
}
