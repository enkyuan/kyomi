"use client";

import { Link } from "@tanstack/react-router";
import { AddFill, Fullscreen2Fill, Rss2Fill } from "@kyomi/ui/icons/mingcute";
import { useMemo } from "react";
import { Button } from "@kyomi/ui/button";
import type { InboxSearch } from "@modules/inbox/lib/search";
import {
  FolderPickerButton,
  TOP_SOURCE_FOLDER_BUTTON_CLASS,
} from "@modules/folders/components/picker";
import type { RecapFolder } from "@modules/folders/lib/types";
import { FeedFavicon } from "@modules/feeds/components/feed-favicon";
import type { RecapTopViewedFeed } from "../types";
import { formatRelativeTime, formatViewedCount } from "@modules/inbox/lib/recap/index";
import { RailTooltip, RecapSection, SectionEmpty } from ".";

const TOP_SOURCE_DISPLAY_LIMIT = 4;

export function TopSources({
  feeds,
  folders,
  followFeed,
  isFollowingFeed,
  moveFeed,
  movingFeedId,
  onExpand,
}: {
  feeds: RecapTopViewedFeed[];
  folders: RecapFolder[];
  followFeed: (feed: RecapTopViewedFeed, folderId?: string) => void;
  isFollowingFeed: (feedId: string) => boolean;
  moveFeed: (feedId: string, folderId: string) => void;
  movingFeedId: string | null;
  onExpand: () => void;
}) {
  const folderOptions = useMemo(
    () => folders.map((folder) => ({ label: folder.name, value: folder.id })),
    [folders],
  );
  const visibleFeeds = feeds.slice(0, TOP_SOURCE_DISPLAY_LIMIT);

  return (
    <RecapSection
      action={
        feeds.length > TOP_SOURCE_DISPLAY_LIMIT ? (
          <RailTooltip label="View more sources">
            <Button
              aria-label="View more sources"
              size="icon-xs"
              variant="ghost"
              onClick={onExpand}
            >
              <Fullscreen2Fill />
            </Button>
          </RailTooltip>
        ) : null
      }
      title="Top Sources"
    >
      {feeds.length === 0 ? (
        <SectionEmpty
          title="No viewed sources"
          description="Open a few posts to build this list."
          icon={<Rss2Fill />}
        />
      ) : (
        <div className="space-y-2">
          {visibleFeeds.map((feed) => {
            const unsortedFolder = folderOptions.find((folder) => folder.label === "Unsorted");
            const currentFolderId =
              feed.folderId ?? unsortedFolder?.value ?? folderOptions[0]?.value ?? "";
            const currentFolder = folderOptions.find((folder) => folder.value === currentFolderId);
            return (
              <div key={feed.feedId} className="min-w-0 rounded-[15px] p-2 hover:bg-accent/70">
                <div className="flex min-w-0 items-center gap-2.5">
                  <Link
                    className="min-w-0 flex flex-1 gap-2.5 outline-none"
                    to="/inbox"
                    search={(prev: InboxSearch) => ({
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
                      siteUrl={feed.siteUrl}
                      squircleCornerRadius={7}
                      title={feed.title}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-sm leading-5">
                        {feed.title}
                      </span>
                      <span className="block truncate text-muted-foreground text-xs leading-4">
                        {formatViewedCount(feed.viewedItemCount)} · viewed{" "}
                        {formatRelativeTime(feed.lastViewedAt)}
                      </span>
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
                  ) : !feed.isSubscribed && folderOptions.length > 0 ? (
                    <FolderPickerButton
                      currentFolderId=""
                      currentFolderName="Unsorted"
                      feedTitle={feed.title}
                      folders={folderOptions}
                      isMoving={isFollowingFeed(feed.feedId)}
                      mode="follow"
                      onMove={(folderId) => followFeed(feed, folderId)}
                    />
                  ) : !feed.isSubscribed ? (
                    <Button
                      aria-label={`Follow ${feed.title}`}
                      className={TOP_SOURCE_FOLDER_BUTTON_CLASS}
                      loading={isFollowingFeed(feed.feedId)}
                      size="icon-xs"
                      variant="ghost"
                      onClick={() => followFeed(feed)}
                    >
                      <AddFill />
                    </Button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </RecapSection>
  );
}
