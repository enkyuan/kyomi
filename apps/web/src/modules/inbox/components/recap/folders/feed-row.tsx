"use client";

import { Link } from "@tanstack/react-router";
import { Checkbox } from "@kyomi/ui/checkbox";
import { cn } from "@kyomi/ui/lib/utils";
import { FeedFavicon } from "@modules/feeds/components/feed-favicon";
import type { FollowedFeed } from "@modules/feeds/lib/api";
import { FolderPickerButton } from "@modules/folders/components/picker";
import type { InboxSearch } from "@modules/inbox/lib/search";

type FolderOption = { label: string; value: string };

function getFollowedFeedSource(feed: FollowedFeed) {
  const value = feed.link ?? feed.url;
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return value;
  }
}

export function FolderFeedRow({
  feed,
  folderOptions,
  isSelecting,
  isSelected,
  moveFeed,
  movingFeedId,
  setFeedSelected,
  toggleFeedSelected,
  unsortedFolderId,
}: {
  feed: FollowedFeed;
  folderOptions: FolderOption[];
  isSelecting: boolean;
  isSelected: boolean;
  moveFeed: (feedId: string, folderId: string) => void;
  movingFeedId: string | null;
  setFeedSelected: (feedId: string, selected: boolean) => void;
  toggleFeedSelected: (feedId: string) => void;
  unsortedFolderId: string | null;
}) {
  const currentFolderId = feed.folderId ?? unsortedFolderId ?? folderOptions[0]?.value ?? "";
  const currentFolder = folderOptions.find((option) => option.value === currentFolderId);
  const feedTitle = feed.title || feed.url;

  return (
    // oxlint-disable-next-line react-doctor/no-static-element-interactions -- role/tabIndex/onKeyDown are set when interactive
    <div
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
          <FolderFeedIdentity feed={feed} title={feedTitle} />
          <Checkbox
            aria-label={`Select ${feedTitle}`}
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
            search={(prev: InboxSearch) => ({
              ...prev,
              filter: "all" as const,
              feedId: feed.feedId,
              folderId: undefined,
              itemId: undefined,
              search: undefined,
            })}
          >
            <FolderFeedIdentity feed={feed} title={feedTitle} />
          </Link>
          {currentFolderId ? (
            <FolderPickerButton
              currentFolderId={currentFolderId}
              currentFolderName={currentFolder?.label ?? "Unsorted"}
              feedTitle={feedTitle}
              folders={folderOptions}
              isMoving={movingFeedId === feed.feedId}
              onMove={(folderId) => moveFeed(feed.feedId, folderId)}
            />
          ) : null}
        </>
      )}
    </div>
  );
}

function FolderFeedIdentity({ feed, title }: { feed: FollowedFeed; title: string }) {
  return (
    <>
      <FeedFavicon
        className="size-9 shrink-0"
        faviconUrl={feed.faviconUrl}
        feedUrl={feed.url}
        shape="squircle"
        siteUrl={feed.link}
        squircleCornerRadius={8}
        title={title}
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{title}</span>
        <span className="block truncate text-muted-foreground text-sm">
          {getFollowedFeedSource(feed)}
        </span>
      </span>
    </>
  );
}
