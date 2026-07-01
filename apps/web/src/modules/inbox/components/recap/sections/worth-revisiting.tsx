"use client";

import { Link } from "@tanstack/react-router";
import { BookmarkFill, ExternalLinkLine, RightFill } from "@mingcute/react";
import { Button } from "@kyomi/ui/button";
import { SAVED_ACTION_ACTIVE_CLASS } from "@lib/theme/action-colors";
import { buildInboxItemSlug } from "@modules/inbox/lib/article-slug";
import type { RecapSavedItem } from "../types";
import { formatRelativeTime } from "../utils";
import { RailTooltip, RecapSection, SectionEmpty } from ".";

const WORTH_REVISITING_DISPLAY_LIMIT = 3;

export function WorthRevisiting({
  items,
  onExpand,
  onUnsave,
  unsavingItemId,
}: {
  items: RecapSavedItem[];
  onExpand: () => void;
  onUnsave: (itemId: string) => void;
  unsavingItemId: string | null;
}) {
  const visibleItems = items.slice(0, WORTH_REVISITING_DISPLAY_LIMIT);

  return (
    <RecapSection
      action={
        items.length > WORTH_REVISITING_DISPLAY_LIMIT ? (
          <RailTooltip label="View saved items">
            <Button
              aria-label="View saved items"
              size="icon-xs"
              variant="ghost"
              onClick={onExpand}
            >
              <RightFill />
            </Button>
          </RailTooltip>
        ) : null
      }
      title="Worth revisiting"
    >
      {items.length === 0 ? (
        <SectionEmpty
          title="No saved items"
          description="Saved posts and clips will appear here."
          icon={<BookmarkFill />}
        />
      ) : (
        <div className="space-y-3">
          {visibleItems.map((item) => (
            <div
              key={item.id}
              className="-mx-1 group relative min-w-0 rounded-xl px-2 py-2 hover:bg-accent/70"
            >
              <Link
                aria-label={item.title}
                className="absolute inset-0 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
                params={{ article: buildInboxItemSlug(item) }}
                search={(prev) => ({
                  ...prev,
                  itemId: undefined,
                })}
                to="/inbox/$article"
              />
              <span className="pointer-events-none relative block min-w-0">
                <span className="block truncate font-semibold text-base leading-5">
                  {item.title}
                </span>
              </span>
              <div className="mt-1 flex min-w-0 items-center gap-1">
                <span className="pointer-events-none min-w-0 flex-1 truncate text-muted-foreground text-sm">
                  {item.feedTitle} · saved {formatRelativeTime(item.savedAt)}
                </span>
                <div
                  className="relative z-10 flex shrink-0 items-center gap-0.5 text-muted-foreground opacity-70 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
                  onClick={(event) => event.stopPropagation()}
                >
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
      )}
    </RecapSection>
  );
}
