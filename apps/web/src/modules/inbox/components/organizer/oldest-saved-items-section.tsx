"use client";

import { Link } from "@tanstack/react-router";
import { BookmarkFill, ExternalLinkLine } from "@mingcute/react";
import { Button } from "@kyomi/ui/button";
import { buildInboxItemSlug } from "../../lib/article-slug";
import type { OrganizerSavedItem } from "./types";
import { formatRelativeTime } from "./utils";
import { OrganizerSection, RailTooltip, SectionEmpty } from "./section";

export function OldestSavedItemsSection({
  items,
  onUnsave,
  unsavingItemId,
}: {
  items: OrganizerSavedItem[];
  onUnsave: (itemId: string) => void;
  unsavingItemId: string | null;
}) {
  return (
    <OrganizerSection title="Saved Longest" icon={<BookmarkFill className="size-4" />}>
      {items.length === 0 ? (
        <SectionEmpty title="No saved items" description="Saved posts and clips will appear here." />
      ) : (
        <div className="space-y-1">
          {items.map((item) => (
            <div
              key={item.id}
              className="group flex min-w-0 items-center gap-2 rounded-md p-2 hover:bg-accent/70"
            >
              <Link
                className="min-w-0 flex-1 outline-none"
                params={{ article: buildInboxItemSlug(item) }}
                search={(prev) => ({
                  ...prev,
                  itemId: undefined,
                })}
                to="/inbox/$article"
              >
                <span className="block truncate font-medium text-sm">{item.title}</span>
                <span className="block truncate text-muted-foreground text-xs">
                  {item.feedTitle} · saved {formatRelativeTime(item.savedAt)}
                </span>
              </Link>
              <RailTooltip label="Open original">
                <Button
                  aria-label={`Open original for ${item.title}`}
                  render={<a href={item.link} rel="noreferrer" target="_blank" />}
                  size="icon-xs"
                  variant="ghost"
                >
                  <ExternalLinkLine />
                </Button>
              </RailTooltip>
              <RailTooltip label="Unsave">
                <Button
                  aria-label={`Unsave ${item.title}`}
                  loading={unsavingItemId === item.id}
                  size="icon-xs"
                  variant="ghost"
                  onClick={() => onUnsave(item.id)}
                >
                  <BookmarkFill />
                </Button>
              </RailTooltip>
            </div>
          ))}
        </div>
      )}
    </OrganizerSection>
  );
}
