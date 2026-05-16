import { AppError } from "@shared/errors/app-error";
import type { ArticleListItemDto } from "../types";

const PREFIX = "m1.";

type MergedCursorPayloadV1 = {
  v: 1;
  /** ISO-8601 instant (same string as `ArticleListItemDto.publishedAt`). */
  pa: string;
  id: string;
};

function toBase64Url(json: string): string {
  return Buffer.from(json, "utf8").toString("base64url");
}

function fromBase64Url(b64: string): string {
  return Buffer.from(b64, "base64url").toString("utf8");
}

function invalidMergedCursor(): never {
  throw new AppError("Invalid merged view cursor.", {
    status: 400,
    code: "MERGED_VIEW_CURSOR_INVALID",
  });
}

function parseMergedCursorPayload(trimmed: string): MergedCursorPayloadV1 {
  let raw: unknown;
  try {
    raw = JSON.parse(fromBase64Url(trimmed.slice(PREFIX.length)));
  } catch {
    invalidMergedCursor();
  }
  if (!raw || typeof raw !== "object") {
    invalidMergedCursor();
  }
  const o = raw as Partial<MergedCursorPayloadV1>;
  if (o.v !== 1 || typeof o.pa !== "string" || typeof o.id !== "string" || !o.id.trim()) {
    invalidMergedCursor();
  }
  return { v: 1, pa: o.pa, id: o.id };
}

function toPublishedAtCursor(payload: MergedCursorPayloadV1): { publishedAt: Date; id: string } {
  const publishedAt = new Date(payload.pa);
  if (Number.isNaN(publishedAt.getTime())) {
    invalidMergedCursor();
  }
  return { publishedAt, id: payload.id };
}

/** Cursor for merged feed+clip lists: strictly older than this (publishedAt, id) in global sort order. */
export function encodeMergedListCursorFromItem(item: ArticleListItemDto): string {
  const payload: MergedCursorPayloadV1 = { v: 1, pa: item.publishedAt, id: item.id };
  return PREFIX + toBase64Url(JSON.stringify(payload));
}

export function decodeMergedListCursor(
  cursor: string | undefined,
): { publishedAt: Date; id: string } | undefined {
  if (cursor === undefined || cursor.trim() === "") {
    return undefined;
  }
  const trimmed = cursor.trim();
  if (!trimmed.startsWith(PREFIX)) {
    invalidMergedCursor();
  }
  return toPublishedAtCursor(parseMergedCursorPayload(trimmed));
}
