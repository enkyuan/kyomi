"use client";

import { DotGrid2x3VerticalIcon } from "@kyomi/ui/icons/blode";
import { CommandItem } from "@kyomi/ui/components/command";
import { FeedFavicon } from "@modules/feeds/components/favicon";
import type { FollowedFeed } from "@modules/feeds/lib/api";

/** A folder's feeds, indented to the folder glyph's centre line so they read as files inside it. */
export function FolderFeeds({
  feeds,
  drag,
  dragHandlers,
  editMode,
  onOpenFeed: run,
  open,
}: {
  drag: { dy: number; feedId: string } | null;
  dragHandlers: (feed: FollowedFeed) => Record<string, unknown>;
  editMode: boolean;
  feeds: FollowedFeed[];
  onOpenFeed: (action: () => void) => () => void;
  open: (feed: FollowedFeed) => void;
}) {
  if (feeds.length === 0) {
    return <div className="ms-8 px-2.5 py-2 text-muted-foreground text-sm">No feeds</div>;
  }
  return feeds.map((feed) => {
    const dragging = drag?.feedId === feed.feedId;
    return (
      <div
        key={feed.feedId}
        className={`ms-7 touch-none ${dragging ? "relative z-10 rounded-[14px] bg-popover shadow-[0_0_0_1px_var(--border)]" : ""} ${editMode && !dragging ? "cursor-grab" : ""} ${dragging ? "cursor-grabbing" : ""}`}
        style={dragging ? { transform: `translateY(${drag.dy}px)` } : undefined}
        {...(editMode ? dragHandlers(feed) : {})}
      >
        <CommandItem value={`folder-feed-${feed.feedId}`} onSelect={run(() => open(feed))}>
          <FeedFavicon
            className="size-5 shrink-0"
            faviconUrl={feed.faviconUrl}
            feedUrl={feed.url}
            shape="squircle"
            siteUrl={feed.link}
            squircleCornerRadius={5}
            title={feed.title || feed.url}
          />
          <span className="min-w-0 truncate">{feed.title || feed.url}</span>
          <DotGrid2x3VerticalIcon
            aria-hidden="true"
            className={`ms-auto size-4 shrink-0 text-muted-foreground transition-opacity duration-200 ease-out motion-reduce:transition-none ${editMode ? "" : "opacity-0"}`}
          />
        </CommandItem>
      </div>
    );
  });
}
