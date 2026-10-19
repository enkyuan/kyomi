"use client";

import { Link } from "@tanstack/react-router";
import { Checkbox } from "@kyomi/ui/components/checkbox";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTarget,
  ItemTitle,
} from "@kyomi/ui/components/item";
import { cn } from "@kyomi/ui/lib/utils";
import { FeedFavicon } from "@modules/feeds/components/favicon";
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
    <Item
      className={cn("min-h-13", isSelecting && "cursor-pointer")}
      role={isSelecting ? "button" : undefined}
      selected={isSelected}
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
          <ItemActions>
            <Checkbox
              aria-label={`Select ${feedTitle}`}
              checked={isSelected}
              onCheckedChange={(checked) => setFeedSelected(feed.feedId, checked === true)}
              onClick={(event) => event.stopPropagation()}
            />
          </ItemActions>
        </>
      ) : (
        <>
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
            <FolderFeedIdentity feed={feed} title={feedTitle} />
          </ItemTarget>
          {currentFolderId ? (
            <ItemActions>
              <FolderPickerButton
                currentFolderId={currentFolderId}
                currentFolderName={currentFolder?.label ?? "Unsorted"}
                feedTitle={feedTitle}
                folders={folderOptions}
                isMoving={movingFeedId === feed.feedId}
                onMove={(folderId) => moveFeed(feed.feedId, folderId)}
              />
            </ItemActions>
          ) : null}
        </>
      )}
    </Item>
  );
}

function FolderFeedIdentity({ feed, title }: { feed: FollowedFeed; title: string }) {
  return (
    <>
      <ItemMedia>
        <FeedFavicon
          className="size-9 shrink-0"
          faviconUrl={feed.faviconUrl}
          feedUrl={feed.url}
          shape="squircle"
          siteUrl={feed.link}
          squircleCornerRadius={8}
          title={title}
        />
      </ItemMedia>
      <ItemContent>
        <ItemTitle>{title}</ItemTitle>
        <ItemDescription>{getFollowedFeedSource(feed)}</ItemDescription>
      </ItemContent>
    </>
  );
}
