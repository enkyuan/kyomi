"use client";

import { Link } from "@tanstack/react-router";
import { AddFill, Fullscreen2Fill, Rss2Fill } from "@kyomi/ui/icons/mingcute";
import { useMemo } from "react";
import { Button } from "@kyomi/ui/components/button";
import type { InboxSearch } from "@modules/inbox/lib/search";
import {
  FolderPickerButton,
  TOP_SOURCE_FOLDER_BUTTON_CLASS,
} from "@modules/folders/components/picker";
import { FeedFavicon } from "@modules/feeds/components/feed-favicon";
import type { RecapFolder, RecapTopViewedFeed } from "../../../lib/recap/types";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTarget,
  ItemTitle,
} from "@kyomi/ui/components/item";
import { formatRelativeTime, formatViewedCount } from "@modules/inbox/lib/recap/index";
import { RailTooltip, RecapSection, SectionEmpty } from ".";

const TOP_SOURCE_DISPLAY_LIMIT = 4;

function TopSourceRow({
  currentFolder,
  currentFolderId,
  feed,
  folderOptions,
  followFeed,
  isFollowingFeed,
  moveFeed,
  movingFeedId,
}: {
  currentFolder?: { label: string; value: string };
  currentFolderId: string;
  feed: RecapTopViewedFeed;
  folderOptions: { label: string; value: string }[];
  followFeed: (feed: RecapTopViewedFeed, folderId?: string) => void;
  isFollowingFeed: (feedId: string) => boolean;
  moveFeed: (feedId: string, folderId: string) => void;
  movingFeedId: string | null;
}) {
  return (
    <Item shape="squircle" size="sm">
      <ItemTarget
        render={
          <Link
            to="/inbox"
            search={(prev: InboxSearch) => ({
              ...prev,
              filter: "all" as const,
              feedId: feed.feedId,
              folderId: undefined,
              itemId: undefined,
              search: undefined,
            })}
          />
        }
      >
        <ItemMedia>
          <FeedFavicon
            className="size-9 shrink-0"
            faviconUrl={feed.faviconUrl}
            feedUrl={feed.url}
            shape="squircle"
            siteUrl={feed.siteUrl}
            squircleCornerRadius={8}
            title={feed.title}
          />
        </ItemMedia>
        <ItemContent>
          <ItemTitle>{feed.title}</ItemTitle>
          <ItemDescription>
            {formatViewedCount(feed.viewedItemCount)} · viewed{" "}
            {formatRelativeTime(feed.lastViewedAt)}
          </ItemDescription>
        </ItemContent>
      </ItemTarget>
      <ItemActions>
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
            shape="pill"
            size="icon-xs"
            variant="soft"
            onClick={() => followFeed(feed)}
          >
            <AddFill />
          </Button>
        ) : null}
      </ItemActions>
    </Item>
  );
}

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
              <TopSourceRow
                key={feed.feedId}
                currentFolder={currentFolder}
                currentFolderId={currentFolderId}
                feed={feed}
                folderOptions={folderOptions}
                followFeed={followFeed}
                isFollowingFeed={isFollowingFeed}
                moveFeed={moveFeed}
                movingFeedId={movingFeedId}
              />
            );
          })}
        </div>
      )}
    </RecapSection>
  );
}
