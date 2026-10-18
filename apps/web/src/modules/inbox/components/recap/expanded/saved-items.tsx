"use client";

import { Link } from "@tanstack/react-router";
import { BookmarkFill, ExternalLinkLine } from "@kyomi/ui/icons/mingcute";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTarget,
  ItemTitle,
} from "@kyomi/ui/components/item";
import { Button } from "@kyomi/ui/components/button";
import type { InboxSearch } from "@modules/inbox/lib/search";
import { buildInboxItemSlug } from "@modules/articles/lib/slug";
import { RailTooltip, SectionEmpty } from "../sections";
import type { RecapSavedItem } from "../../../lib/recap/types";
import { formatRelativeTime } from "@modules/inbox/lib/recap/index";

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
      <div className="flex h-full min-h-0">
        <SectionEmpty
          title="Nothing to revisit yet"
          description="Older saved posts and clips will surface here after they've been waiting a while."
          icon={<BookmarkFill />}
        />
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-2.5 pb-1">
      {items.map((item) => (
        <Item key={item.id}>
          <ItemContent>
            <ItemTarget
              aria-label={item.title}
              render={
                <Link
                  params={{ article: buildInboxItemSlug(item) }}
                  search={(prev: InboxSearch) => ({
                    ...prev,
                    itemId: undefined,
                  })}
                  to="/inbox/$article"
                />
              }
            >
              <ItemTitle>{item.title}</ItemTitle>
            </ItemTarget>
            <div className="mt-1 flex min-w-0 items-center gap-1">
              <ItemDescription className="min-w-0 flex-1">
                {item.feedTitle} · saved {formatRelativeTime(item.savedAt)}
              </ItemDescription>
              <ItemActions className="text-muted-foreground" reveal>
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
                    className="text-mizu"
                    loading={unsavingItemId === item.id}
                    size="icon-xs"
                    variant="ghost"
                    onClick={() => onUnsave(item.id)}
                  >
                    <BookmarkFill />
                  </Button>
                </RailTooltip>
              </ItemActions>
            </div>
          </ItemContent>
        </Item>
      ))}
    </div>
  );
}
