import { AppError } from "@shared/errors/app";
import type { ArticleSort } from "../query";
import type { ArticleListItemDto } from "../types";
import { decodeCursorPayload, encodeCursorPayload } from "./cursor-codec";

const PREFIX = "m1.";

type MergedCursorPayloadV1 = {
  v: 1;
  /** ISO-8601 instant (same string as `ArticleListItemDto.publishedAt`). */
  pa: string;
  id: string;
  r?: boolean;
  s?: ArticleSort;
};

function invalidMergedCursor(): never {
  throw new AppError("Invalid merged view cursor.", {
    status: 400,
    code: "MERGED_VIEW_CURSOR_INVALID",
  });
}

function parseMergedCursorPayload(trimmed: string): MergedCursorPayloadV1 {
  const o = decodeCursorPayload<Partial<MergedCursorPayloadV1>>(
    PREFIX,
    trimmed,
    invalidMergedCursor,
  );
  if (o.v !== 1 || typeof o.pa !== "string" || typeof o.id !== "string" || !o.id.trim()) {
    invalidMergedCursor();
  }
  return {
    v: 1,
    pa: o.pa,
    id: o.id,
    r: typeof o.r === "boolean" ? o.r : undefined,
    s: o.s === "oldest" || o.s === "unread-first" || o.s === "newest" ? o.s : undefined,
  };
}

function toPublishedAtCursor(payload: MergedCursorPayloadV1): {
  publishedAt: Date;
  id: string;
  isRead?: boolean;
} {
  const publishedAt = new Date(payload.pa);
  if (Number.isNaN(publishedAt.getTime())) {
    invalidMergedCursor();
  }
  return { publishedAt, id: payload.id, isRead: payload.r };
}

/** Cursor for merged feed+clip lists at this item boundary in the active sort order. */
export function encodeMergedListCursorFromItem(
  item: ArticleListItemDto,
  sort: ArticleSort,
): string {
  const payload: MergedCursorPayloadV1 = {
    v: 1,
    pa: item.publishedAt,
    id: item.id,
    r: item.isRead,
    s: sort,
  };
  return encodeCursorPayload(PREFIX, payload);
}

export function decodeMergedListCursor(
  cursor: string | undefined,
): { publishedAt: Date; id: string; isRead?: boolean } | undefined {
  if (cursor === undefined || cursor.trim() === "") {
    return undefined;
  }
  const trimmed = cursor.trim();
  if (!trimmed.startsWith(PREFIX)) {
    invalidMergedCursor();
  }
  return toPublishedAtCursor(parseMergedCursorPayload(trimmed));
}
