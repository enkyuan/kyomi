"use client";

import { Link } from "@tanstack/react-router";
import { PlusIcon, RssIcon } from "@kyomi/ui/icons/blode";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTarget,
  ItemTitle,
} from "@kyomi/ui/components/item";
import { Button } from "@kyomi/ui/components/button";
import type { InboxSearch } from "@modules/inbox/lib/search";
import {
  FolderPickerButton,
  TOP_SOURCE_FOLDER_BUTTON_CLASS,
} from "@modules/folders/components/picker";
import { FeedFavicon } from "@modules/feeds/components/favicon";
import { SectionEmpty } from "../sections";
import type { RecapTopViewedFeed } from "../../../lib/recap/types";
import { formatRelativeTime, formatViewedCount } from "@modules/inbox/lib/recap/index";

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
  followFeed: (feed: RecapTopViewedFeed, folderId?: string) => void;
  isFollowingFeed: (feedId: string) => boolean;
  moveFeed: (feedId: string, folderId: string) => void;
  movingFeedId: string | null;
}) {
  if (feeds.length === 0) {
    return (
      <div className="flex h-full min-h-0">
        <SectionEmpty
          title="No viewed sources"
          description="Open a few posts to build this list."
          icon={<RssIcon />}
        />
      </div>
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
          <Item key={feed.feedId}>
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
                  className="size-10 shrink-0"
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
                {currentFolder ? (
                  <ItemDescription className="text-xs">{currentFolder.label}</ItemDescription>
                ) : null}
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
                  <PlusIcon />
                </Button>
              ) : null}
            </ItemActions>
          </Item>
        );
      })}
    </div>
  );
}
