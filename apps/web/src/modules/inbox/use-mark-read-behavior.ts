"use client";

import type { InboxFilter } from "@modules/inbox/api";
import type { InboxMarkReadBehaviorDto } from "@lib/api-schemas";
import { useEffect, useRef } from "react";

type InboxItemLike = { id: string; isRead: boolean } | null;

/**
 * Marks the open item read for non-recent views according to inbox preference, with a
 * cancellable delay for the "after-delay" mode.
 */
export function useMarkReadBehavior(input: {
  itemId: string | undefined;
  selectedItem: InboxItemLike;
  effectiveFilter: InboxFilter;
  markReadBehavior: InboxMarkReadBehaviorDto;
  onMarkRead: (itemId: string) => void;
}) {
  const timeoutRef = useRef<number | null>(null);
  const onMarkReadRef = useRef(input.onMarkRead);
  onMarkReadRef.current = input.onMarkRead;

  useEffect(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    const { itemId, selectedItem, effectiveFilter, markReadBehavior } = input;

    if (
      !itemId ||
      !selectedItem ||
      selectedItem.isRead ||
      effectiveFilter === "recent" ||
      markReadBehavior === "manual"
    ) {
      return;
    }

    if (markReadBehavior === "on-open") {
      onMarkReadRef.current(itemId);
      return;
    }

    if (markReadBehavior === "after-delay") {
      timeoutRef.current = window.setTimeout(() => {
        onMarkReadRef.current(itemId);
        timeoutRef.current = null;
      }, 1500);

      return () => {
        if (timeoutRef.current !== null) {
          window.clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
      };
    }
  }, [
    input.effectiveFilter,
    input.itemId,
    input.markReadBehavior,
    input.selectedItem,
    input.selectedItem?.isRead,
    input.selectedItem?.id,
  ]);
}
