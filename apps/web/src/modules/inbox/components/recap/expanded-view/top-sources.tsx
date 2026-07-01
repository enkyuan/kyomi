"use client";

import { Link } from "@tanstack/react-router";
import { Rss2Fill } from "@mingcute/react";
import { Button } from "@kyomi/ui/button";
import { FeedFavicon } from "@modules/sidebar/components/feed-favicon";
import { SectionEmpty } from "../sections";
import { FolderPickerButton } from "../sections/top-sources";
import type { RecapTopViewedFeed } from "../types";
import { formatRelativeTime, formatViewedCount } from "../utils";

type FolderOption = { label: string; value: string };

export function ExpandedTopSources({
  feeds,
  folderOptions,
  followFeed,
  isFollowingFeed,
  moveFeed,
  movingFeedId,
}: {
  feeds: RecapTopViewedFeed[];
  folderOptions: FolderOption[];
  followFeed: (feed: RecapTopViewedFeed) => void;
  isFollowingFeed: (feedId: string) => boolean;
  moveFeed: (feedId: string, folderId: string) => void;
  movingFeedId: string | null;
}) {
  if (feeds.length === 0) {
    return (
      <SectionEmpty
        title="No viewed sources"
        description="Open a few posts to build this list."
        icon={<Rss2Fill />}
      />
    );
  }

  return (
    <div className="min-w-0 space-y-2.5 pb-1">
      {feeds.map((feed) => {
        const unsortedFolder = folderOptions.find((folder) => folder.label === "Unsorted");
        const currentFolderId =
          feed.folderId ?? unsortedFolder?.value ?? folderOptions[0]?.value ?? "";
        const currentFolder = folderOptions.find((folder) => folder.value === currentFolderId);

        return (
          <div key={feed.feedId} className="min-w-0 rounded-2xl px-2 py-2 hover:bg-accent/70">
            <div className="flex min-w-0 items-center gap-3">
              <Link
                className="min-w-0 flex flex-1 gap-3 outline-none"
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
                  className="size-10 shrink-0"
                  faviconUrl={feed.faviconUrl}
                  feedUrl={feed.url}
                  shape="squircle"
                  siteUrl={feed.siteUrl}
                  squircleCornerRadius={8}
                  title={feed.title}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-base leading-5">
                    {feed.title}
                  </span>
                  <span className="block truncate text-muted-foreground text-sm">
                    {formatViewedCount(feed.viewedItemCount)} · viewed{" "}
                    {formatRelativeTime(feed.lastViewedAt)}
                  </span>
                  {currentFolder ? (
                    <span className="block truncate text-muted-foreground text-xs">
                      {currentFolder.label}
                    </span>
                  ) : null}
                </span>
              </Link>
              {feed.isSubscribed && currentFolderId ? (
                <FolderPickerButton
                  currentFolderId={currentFolderId}
                  currentFolderName={currentFolder?.label ?? "Unsorted"}
                  feedTitle={feed.title}
                  folders={folderOptions}
                  isMoving={movingFeedId === feed.feedId}
                  onMove={(folderId) => moveFeed(feed.feedId, folderId)}
                />
              ) : !feed.isSubscribed ? (
                <Button
                  loading={isFollowingFeed(feed.feedId)}
                  size="xs"
                  variant="outline"
                  onClick={() => followFeed(feed)}
                >
                  Follow
                </Button>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
