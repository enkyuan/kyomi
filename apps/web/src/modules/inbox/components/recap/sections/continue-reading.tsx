"use client";

import { Link } from "@tanstack/react-router";
import { useRef } from "react";
import { XIcon } from "@kyomi/ui/icons/blode";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTarget,
  ItemTitle,
} from "@kyomi/ui/components/item";
import { Button } from "@kyomi/ui/components/button";
import { formatRemainingMinutes } from "@kyomi/reader/core";
import { logClientError } from "@kyomi/reader/lib/errors";
import { buildInboxItemSlug } from "@modules/articles/lib/slug";
import { reportContinueReadingImpressions, type InboxItem } from "@modules/articles/lib/api";
import { useImpressions } from "@modules/inbox/hooks/use-impressions";
import type { InboxSearch } from "@modules/inbox/lib/search";
import { RailTooltip, RecapSection } from ".";

export const CONTINUE_READING_DISPLAY_LIMIT = 2;

function reportImpressions(articleIds: string[]) {
  reportContinueReadingImpressions({ data: { articleIds } }).catch((error: unknown) => {
    logClientError("inbox.recap.continue_reading.impressions", error);
  });
}

/** Unfinished articles worth coming back to. Renders nothing when there are none. */
export function ContinueReading({
  items,
  onDismiss,
  onReportImpressions = reportImpressions,
}: {
  items: InboxItem[];
  onDismiss: (itemId: string) => void;
  onReportImpressions?: (articleIds: string[]) => void;
}) {
  const listRef = useRef<HTMLDivElement | null>(null);
  const visibleItems = items.slice(0, CONTINUE_READING_DISPLAY_LIMIT);

  useImpressions({
    containerRef: listRef,
    watchKey: visibleItems.map((item) => item.id).join(","),
    onReport: onReportImpressions,
  });

  if (visibleItems.length === 0) {
    return null;
  }

  return (
    <RecapSection title="Continue reading">
      <div ref={listRef} className="space-y-3">
        {visibleItems.map((item) => {
          const remaining = formatRemainingMinutes(item.readingProgress?.remainingMinutes ?? null);

          return (
            <Item key={item.id} data-impression-id={item.id} size="sm">
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
                    {remaining ? `${item.feedTitle} · ${remaining}` : item.feedTitle}
                  </ItemDescription>
                  <ItemActions
                    className="text-muted-foreground"
                    reveal
                    onClick={(event) => event.stopPropagation()}
                  >
                    <RailTooltip label="Dismiss">
                      <Button
                        aria-label={`Dismiss ${item.title}`}
                        size="icon-xs"
                        variant="ghost"
                        onClick={() => onDismiss(item.id)}
                      >
                        <XIcon />
                      </Button>
                    </RailTooltip>
                  </ItemActions>
                </div>
              </ItemContent>
            </Item>
          );
        })}
      </div>
    </RecapSection>
  );
}
