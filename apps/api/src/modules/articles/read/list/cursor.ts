import { Effect } from "effect";
import { BadRequest } from "@shared/effect/errors";
import type { ArticleSort } from "@modules/articles/params";
import type { ArticleListItemDto } from "@modules/articles/types";

/**
 * Opaque list cursors: a prefix naming the format, then base64url JSON. Three formats share this
 * file because they share the codec: `a1.` (one source in a single feed or global list), `m1.`
 * (merged feed + clip views) and `rv1.` (recently-read view).
 */

const COMPOSITE_PREFIX = "a1.";
const MERGED_PREFIX = "m1.";
const RECENT_PREFIX = "rv1.";

function encodeCursor(prefix: string, payload: object): string {
  return prefix + Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

/** The JSON object after `prefix`, or null when it is not base64url JSON for an object. */
function decodeCursorPayload(trimmed: string, prefix: string): Record<string, unknown> | null {
  try {
    const raw: unknown = JSON.parse(
      Buffer.from(trimmed.slice(prefix.length), "base64url").toString("utf8"),
    );
    return raw && typeof raw === "object" ? (raw as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function parseInstant(value: unknown): Date | null {
  if (typeof value !== "string") {
    return null;
  }
  const instant = new Date(value);
  return Number.isNaN(instant.getTime()) ? null : instant;
}

function validId(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

const optionalBoolean = (value: unknown) => (typeof value === "boolean" ? value : undefined);

// --- a1: single-source lists ------------------------------------------------

export type CompositeCursor = { publishedAt: Date; id: string; isRead?: boolean };

export function encodeCompositeCursor(
  row: { publishedAt: Date; id: string; isRead: boolean },
  sort: ArticleSort,
): string {
  return encodeCursor(COMPOSITE_PREFIX, {
    v: 1,
    s: sort,
    pa: row.publishedAt.toISOString(),
    id: row.id,
    r: row.isRead,
  });
}

/**
 * Decodes an `a1.` cursor, or the older `<iso>::<id>` form. Null means "not a composite cursor":
 * the caller then treats the string as an article id (the oldest cursor format).
 */
export function decodeCompositeCursor(cursor: string): CompositeCursor | null {
  const trimmed = cursor.trim();
  if (trimmed.startsWith(COMPOSITE_PREFIX)) {
    const payload = decodeCursorPayload(trimmed, COMPOSITE_PREFIX);
    const publishedAt = parseInstant(payload?.pa);
    if (!payload || !publishedAt || !validId(payload.id)) {
      return null;
    }
    return { publishedAt, id: payload.id, isRead: optionalBoolean(payload.r) };
  }

  const parts = cursor.split("::");
  const publishedAt = parts.length === 2 ? parseInstant(parts[0]) : null;
  const id = parts[1];
  return publishedAt && id ? { publishedAt, id } : null;
}

// --- m1: merged feed + clip views --------------------------------------------

type MergedBoundary = { publishedAt: Date; id: string; isRead?: boolean };

const invalidMergedCursor = () =>
  new BadRequest({ message: "Invalid merged view cursor.", code: "MERGED_VIEW_CURSOR_INVALID" });

/** Cursor for merged feed+clip lists at this item boundary in the active sort order. */
export function encodeMergedListCursorFromItem(
  item: ArticleListItemDto,
  sort: ArticleSort,
): string {
  return encodeCursor(MERGED_PREFIX, {
    v: 1,
    pa: item.publishedAt,
    id: item.id,
    r: item.isRead,
    s: sort,
  });
}

/** Undefined for no cursor; fails with `MERGED_VIEW_CURSOR_INVALID` for a malformed one. */
export function decodeMergedListCursor(
  cursor: string | undefined,
): Effect.Effect<MergedBoundary | undefined, BadRequest> {
  const trimmed = cursor?.trim();
  if (!trimmed) {
    return Effect.succeed(undefined);
  }
  const payload = trimmed.startsWith(MERGED_PREFIX)
    ? decodeCursorPayload(trimmed, MERGED_PREFIX)
    : null;
  const publishedAt = parseInstant(payload?.pa);
  if (!payload || payload.v !== 1 || !publishedAt || !validId(payload.id)) {
    return Effect.fail(invalidMergedCursor());
  }
  return Effect.succeed({ publishedAt, id: payload.id, isRead: optionalBoolean(payload.r) });
}

// --- rv1: recently-read view --------------------------------------------------

export type RecentBoundary = { lastViewedAt: Date; id: string; isRead?: boolean };

const invalidRecentCursor = () =>
  new BadRequest({ message: "Invalid recent view cursor.", code: "RECENT_VIEW_CURSOR_INVALID" });

export function encodeRecentViewCursor(
  item: { lastViewedAt: Date; id: string; isRead: boolean },
  sort: ArticleSort,
): string {
  return encodeCursor(RECENT_PREFIX, {
    v: 1,
    va: item.lastViewedAt.toISOString(),
    id: item.id,
    r: item.isRead,
    s: sort,
  });
}

/** Undefined for no cursor; fails with `RECENT_VIEW_CURSOR_INVALID` for a malformed one. */
export function decodeRecentViewCursor(
  cursor: string | undefined,
): Effect.Effect<RecentBoundary | undefined, BadRequest> {
  const trimmed = cursor?.trim();
  if (!trimmed) {
    return Effect.succeed(undefined);
  }
  const payload = trimmed.startsWith(RECENT_PREFIX)
    ? decodeCursorPayload(trimmed, RECENT_PREFIX)
    : null;
  const lastViewedAt = parseInstant(payload?.va);
  if (!payload || payload.v !== 1 || !lastViewedAt || !validId(payload.id)) {
    return Effect.fail(invalidRecentCursor());
  }
  return Effect.succeed({ lastViewedAt, id: payload.id, isRead: optionalBoolean(payload.r) });
}
