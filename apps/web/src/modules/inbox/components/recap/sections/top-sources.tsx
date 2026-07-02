"use client";

import { Link } from "@tanstack/react-router";
import { AddFill, CheckFill, RightFill, Rss2Fill } from "@mingcute/react";
import { useMemo } from "react";
import { Button } from "@kyomi/ui/button";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "@kyomi/ui/menu";
import { ScrollArea } from "@kyomi/ui/scroll-area";
import { cn } from "@lib/utils";
import { FeedFavicon } from "@modules/sidebar/components/feed-favicon";
import type { RecapFolder, RecapTopViewedFeed } from "../types";
import { formatRelativeTime, formatViewedCount } from "../utils";
import { RailTooltip, RecapSection, SectionEmpty } from ".";

const TOP_SOURCE_DISPLAY_LIMIT = 4;
const FOLDER_PICKER_SCROLL_THRESHOLD = 6;

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
  followFeed: (feed: RecapTopViewedFeed) => void;
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
              <RightFill />
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
              <div
                key={feed.feedId}
                className="-mx-1 min-w-0 rounded-xl px-2 py-1.5 hover:bg-accent/70"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <Link
                    className="min-w-0 flex flex-1 gap-2.5 outline-none"
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
                      siteUrl={feed.siteUrl}
                      squircleCornerRadius={7}
                      title={feed.title}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-base leading-5">
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
                  ) : !feed.isSubscribed ? (
                    <Button
                      loading={isFollowingFeed(feed.feedId)}
                      size="xs"
                      variant="outline"
                      onClick={() => followFeed(feed)}
                    >
                      <AddFill />
                      Follow
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

export function FolderPickerButton({
  currentFolderId,
  currentFolderName,
  feedTitle,
  folders,
  isMoving,
  onMove,
}: {
  currentFolderId: string;
  currentFolderName: string;
  feedTitle: string;
  folders: Array<{ label: string; value: string }>;
  isMoving: boolean;
  onMove: (folderId: string) => void;
}) {
  const isFiled = currentFolderName !== "Unsorted";
  const Icon = isFiled ? CheckFill : AddFill;
  const orderedFolders = useMemo(() => {
    const unsortedFolder = folders.find((folder) => folder.label === "Unsorted");
    if (!unsortedFolder) {
      return folders;
    }
    return [unsortedFolder, ...folders.filter((folder) => folder.value !== unsortedFolder.value)];
  }, [folders]);
  const shouldScrollFolders = orderedFolders.length > FOLDER_PICKER_SCROLL_THRESHOLD;
  const folderMenuItems = orderedFolders.map((folder) => {
    const isCurrent = folder.value === currentFolderId;
    const isUnsorted = folder.label === "Unsorted";
    return (
      <MenuItem
        key={folder.value}
        aria-label={
          isUnsorted && isFiled
            ? `Move ${feedTitle} to Unsorted`
            : `Move ${feedTitle} to ${folder.label}`
        }
        aria-checked={isCurrent}
        className={cn(
          "h-8 cursor-pointer gap-2 rounded-full px-2 text-sm",
          isCurrent && "bg-accent/70 text-accent-foreground",
        )}
        role="menuitemradio"
        onClick={() => {
          if (!isCurrent) {
            onMove(folder.value);
          }
        }}
      >
        <span className="flex size-4 shrink-0 items-center justify-center">
          {isCurrent ? <CheckFill className="size-3.5" /> : null}
        </span>
        <span className="min-w-0 flex-1 truncate">{folder.label}</span>
      </MenuItem>
    );
  });

  return (
    <Menu>
      <MenuTrigger
        render={
          <Button
            aria-label={
              isFiled
                ? `${feedTitle} is in ${currentFolderName}. Change folder.`
                : `Add ${feedTitle} to a folder`
            }
            className={cn(
              "size-7 rounded-full bg-primary/14 text-primary before:rounded-full transition-[background-color,color,transform] hover:bg-primary/20 active:scale-[0.96] sm:size-7",
            )}
            loading={isMoving}
            size="icon-xs"
            variant="ghost"
          >
            <Icon />
          </Button>
        }
      />
      <MenuPopup
        align="end"
        className={cn(
          "w-40 rounded-[20px] before:rounded-[19px]",
          shouldScrollFolders && "overflow-hidden",
        )}
        contentClassName={shouldScrollFolders ? "!max-h-none !overflow-hidden !p-0" : undefined}
        side="bottom"
        sideOffset={6}
      >
        {shouldScrollFolders ? (
          <ScrollArea className="relative h-[min(--spacing(64),var(--available-height))] overflow-hidden rounded-[inherit] **:data-[slot=scroll-area-scrollbar]:!end-px **:data-[slot=scroll-area-scrollbar]:!m-0 **:data-[slot=scroll-area-scrollbar]:!my-1">
            <div className="min-w-0 p-1">{folderMenuItems}</div>
          </ScrollArea>
        ) : (
          folderMenuItems
        )}
      </MenuPopup>
    </Menu>
  );
}
