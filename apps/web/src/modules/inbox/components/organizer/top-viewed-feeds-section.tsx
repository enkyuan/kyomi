"use client";

import { Link } from "@tanstack/react-router";
import { TimeDurationFill } from "@mingcute/react";
import { useMemo } from "react";
import { Button } from "@kyomi/ui/button";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "@kyomi/ui/select";
import { cn } from "@lib/utils";
import { FeedFavicon } from "@modules/sidebar/components/feed-favicon";
import type { OrganizerFolder, OrganizerTopViewedFeed } from "./types";
import { formatRelativeTime, formatViewedCount } from "./utils";
import { OrganizerSection, SectionEmpty } from "./section";

export function TopViewedFeedsSection({
  feeds,
  folders,
  followFeed,
  isFollowingFeed,
  moveFeed,
  movingFeedId,
}: {
  feeds: OrganizerTopViewedFeed[];
  folders: OrganizerFolder[];
  followFeed: (feed: OrganizerTopViewedFeed) => void;
  isFollowingFeed: (feedId: string) => boolean;
  moveFeed: (feedId: string, folderId: string) => void;
  movingFeedId: string | null;
}) {
  const folderOptions = useMemo(
    () => folders.map((folder) => ({ label: folder.name, value: folder.id })),
    [folders],
  );

  return (
    <OrganizerSection title="Top Sources" icon={<TimeDurationFill className="size-4" />}>
      {feeds.length === 0 ? (
        <SectionEmpty title="No viewed sources" description="Open a few posts to build this list." />
      ) : (
        <div className="space-y-2">
          {feeds.map((feed) => {
            const currentFolderId = feed.folderId ?? folderOptions[0]?.value ?? "";
            return (
              <div key={feed.feedId} className="min-w-0 rounded-md hover:bg-accent/70">
                <div className="flex min-w-0 items-start gap-3 p-2">
                  <Link
                    className="min-w-0 flex flex-1 gap-3 outline-none"
                    to="/inbox"
                    search={(prev) => ({
                      ...prev,
                      filter: feed.isSubscribed ? ("my-feed" as const) : ("all" as const),
                      feedId: feed.feedId,
                      folderId: undefined,
                      itemId: undefined,
                      search: undefined,
                    })}
                  >
                    <FeedFavicon
                      className="size-8 shrink-0"
                      faviconUrl={feed.faviconUrl}
                      feedUrl={feed.url}
                      siteUrl={feed.siteUrl}
                      title={feed.title}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-sm">{feed.title}</span>
                      <span className="block truncate text-muted-foreground text-xs">
                        {formatViewedCount(feed.viewedItemCount)} · viewed{" "}
                        {formatRelativeTime(feed.lastViewedAt)}
                      </span>
                    </span>
                  </Link>
                  {!feed.isSubscribed ? (
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
                {feed.isSubscribed && currentFolderId ? (
                  <div className="pb-2 ps-13 pe-2">
                    <Select
                      aria-label={`Move ${feed.title} to folder`}
                      items={folderOptions}
                      value={currentFolderId}
                      onValueChange={(nextFolderId) => {
                        if (!nextFolderId || nextFolderId === currentFolderId) {
                          return;
                        }
                        moveFeed(feed.feedId, nextFolderId);
                      }}
                    >
                      <SelectTrigger
                        className={cn(
                          "h-7 min-h-7 w-full min-w-0 text-xs",
                          movingFeedId === feed.feedId && "opacity-60",
                        )}
                        size="sm"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectPopup>
                        {folderOptions.map((folder) => (
                          <SelectItem key={folder.value} value={folder.value}>
                            {folder.label}
                          </SelectItem>
                        ))}
                      </SelectPopup>
                    </Select>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </OrganizerSection>
  );
}
