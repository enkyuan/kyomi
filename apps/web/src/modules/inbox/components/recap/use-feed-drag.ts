import { useRef, useState, type PointerEvent } from "react";
import type { FollowedFeed } from "@modules/feeds/lib/api";

export type FeedDrag = { dy: number; feedId: string; originId: string | null };

/**
 * Feeds move by pointer, in place: the row follows the pointer inside the list (never outside the
 * menu) and drops into whichever other folder it ends over.
 */
export function useFeedDrag({
  editMode,
  moveFeed,
  unsortedId,
}: {
  editMode: boolean;
  moveFeed: (feedId: string, folderId: string) => void;
  unsortedId: string | null;
}) {
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [drag, setDrag] = useState<FeedDrag | null>(null);
  const dragStartY = useRef(0);

  const dragHandlers = (feed: FollowedFeed) => ({
    onPointerDown: (event: PointerEvent<HTMLElement>) => {
      if (!editMode || event.button !== 0) {
        return;
      }
      event.currentTarget.setPointerCapture(event.pointerId);
      dragStartY.current = event.clientY;
      setDrag({ dy: 0, feedId: feed.feedId, originId: feed.folderId ?? unsortedId });
    },
    onPointerMove: (event: PointerEvent<HTMLElement>) => {
      if (drag?.feedId !== feed.feedId) {
        return;
      }
      const bounds = event.currentTarget.closest("[cmdk-list]")?.getBoundingClientRect();
      const y = bounds
        ? Math.min(Math.max(event.clientY, bounds.top), bounds.bottom)
        : event.clientY;
      setDrag({ ...drag, dy: y - dragStartY.current });
      const under = document
        .elementsFromPoint(event.clientX, y)
        .map((element) => element.closest<HTMLElement>("[data-folder-id]")?.dataset.folderId)
        .find((id) => id && id !== drag.originId);
      setDropTargetId(under ?? null);
    },
    onPointerUp: () => {
      if (drag?.feedId === feed.feedId && dropTargetId) {
        moveFeed(feed.feedId, dropTargetId);
      }
      setDrag(null);
      setDropTargetId(null);
    },
    onPointerCancel: () => {
      setDrag(null);
      setDropTargetId(null);
    },
  });

  return { drag, dragHandlers, dropTargetId };
}
