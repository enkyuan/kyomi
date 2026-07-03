"use client";

import { Link } from "@tanstack/react-router";
import { BookmarkFill, ExternalLinkLine } from "@mingcute/react";
import { Button } from "@kyomi/ui/button";
import { SAVED_ACTION_ACTIVE_CLASS } from "@lib/theme/action-colors";
import { buildInboxItemSlug } from "@modules/inbox/lib/article-slug";
import { RailTooltip, SectionEmpty } from "../sections";
import type { RecapSavedItem } from "../types";
import { formatRelativeTime } from "../utils";

export function ExpandedSavedItems({
  items,
  onUnsave,
  unsavingItemId,
}: {
  items: RecapSavedItem[];
  onUnsave: (itemId: string) => void;
  unsavingItemId: string | null;
}) {
  if (items.length === 0) {
    return (
      <SectionEmpty
        title="No saved items"
        description="Saved posts and clips will appear here."
        icon={<BookmarkFill />}
      />
    );
  }

  return (
    <div className="min-w-0 space-y-2.5 pb-1">
      {items.map((item) => (
        <div key={item.id} className="group min-w-0 rounded-xl px-2 py-2 hover:bg-accent/70">
          <Link
            aria-label={item.title}
            className="block min-w-0 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
            params={{ article: buildInboxItemSlug(item) }}
            search={(prev) => ({
              ...prev,
              itemId: undefined,
            })}
            to="/inbox/$article"
          >
            <span className="block truncate font-semibold text-base leading-5">{item.title}</span>
          </Link>
          <div className="mt-1 flex min-w-0 items-center gap-1">
            <span className="min-w-0 flex-1 truncate text-muted-foreground text-sm">
              {item.feedTitle} · saved {formatRelativeTime(item.savedAt)}
            </span>
            <div className="flex shrink-0 items-center gap-0.5 text-muted-foreground opacity-70 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
              <RailTooltip label="Open original">
                <Button
                  aria-label={`Open original for ${item.title}`}
                  render={
                    <a
                      aria-label={`Open original for ${item.title}`}
                      href={item.link}
                      rel="noreferrer"
                      target="_blank"
                    />
                  }
                  size="icon-xs"
                  variant="ghost"
                >
                  <ExternalLinkLine />
                </Button>
              </RailTooltip>
              <RailTooltip label="Unsave">
                <Button
                  aria-label={`Unsave ${item.title}`}
                  className={SAVED_ACTION_ACTIVE_CLASS}
                  loading={unsavingItemId === item.id}
                  size="icon-xs"
                  variant="ghost"
                  onClick={() => onUnsave(item.id)}
                >
                  <BookmarkFill />
                </Button>
              </RailTooltip>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
