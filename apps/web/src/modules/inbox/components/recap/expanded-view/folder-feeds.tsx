"use client";

import { Link } from "@tanstack/react-router";
import { Refresh2Fill, Rss2Fill } from "@mingcute/react";
import { useMemo } from "react";
import { ScrollArea } from "@kyomi/ui/scroll-area";
import type { FollowedFeed } from "@modules/feeds/api";
import { FeedFavicon } from "@modules/sidebar/components/feed-favicon";
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
  movingFeedId,
  unsortedFolderId,
}: {
  folder: RecapFolder;
  folderOptions: FolderOption[];
  feeds: FollowedFeed[];
  isLoading: boolean;
  moveFeed: (feedId: string, folderId: string) => void;
  movingFeedId: string | null;
  unsortedFolderId: string | null;
}) {
  const folderFeeds = useMemo(
    () =>
      feeds.filter((feed) => {
        const feedFolderId = feed.folderId ?? unsortedFolderId;
        return feedFolderId === folder.id;
      }),
    [feeds, folder.id, unsortedFolderId],
  );

  if (isLoading) {
    return (
      <div className="px-4">
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
      <div className="px-4">
        <SectionEmpty
          title="No feeds here"
          description="Move sources here from Top Sources."
          icon={<Rss2Fill />}
        />
      </div>
    );
  }

  return (
    <ScrollArea className="h-full min-h-0" scrollbarGutter>
      <div className="min-w-0 space-y-2.5 px-4 pb-1">
        {folderFeeds.map((feed) => {
          const currentFolderId =
            feed.folderId ?? unsortedFolderId ?? folderOptions[0]?.value ?? "";
          const currentFolder = folderOptions.find((option) => option.value === currentFolderId);

          return (
            <div
              key={feed.feedId}
              className="group flex h-13 w-full min-w-0 items-center gap-2.5 rounded-2xl px-2 text-base transition-colors hover:bg-accent/70"
            >
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
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
