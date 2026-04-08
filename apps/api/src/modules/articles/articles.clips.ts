import type { db } from "@adapters/db/client";
import { articleClips } from "@cronos/db";
import { assertHttpOrHttpsUrl } from "@modules/discover/discover.normalize-feed-url";
import { and, desc, eq, gte, lt, or, type SQL } from "drizzle-orm";
import { AppError } from "@shared/errors/app-error";
import { CLIP_LIST_FEED_ID, CLIP_LIST_FEED_TITLE } from "./articles.clips.constants";
import type {
  ArticleDetailDto,
  ArticleListItemDto,
  ArticlesCursorListResponseDto,
} from "./articles.types";

type DB = typeof db;

export type CreateArticleClipBody = {
  url: string;
  title?: string;
  content?: string;
  note?: string;
};

export type ListClipsOptions = {
  isRead?: boolean;
  isSaved?: boolean;
  publishedAfter?: Date;
  publishedBefore?: Date;
  limit: number;
  cursor?: string;
};

function clipToListItem(row: typeof articleClips.$inferSelect): ArticleListItemDto {
  return {
    id: row.id,
    title: row.title,
    link: row.url,
    summary: row.note,
    publishedAt: row.createdAt.toISOString(),
    feedId: CLIP_LIST_FEED_ID,
    feedTitle: CLIP_LIST_FEED_TITLE,
    isRead: row.isRead,
    isSaved: row.isSaved,
    articleType: "clip",
  };
}

export async function createArticleClip(
  database: DB,
  userId: string,
  body: CreateArticleClipBody,
): Promise<ArticleDetailDto> {
  const trimmedUrl = body.url.trim();
  if (!trimmedUrl) {
    throw new AppError("url is required", { status: 400, code: "CLIP_URL_REQUIRED" });
  }
  try {
    assertHttpOrHttpsUrl(trimmedUrl);
  } catch {
    throw new AppError("Invalid URL", { status: 400, code: "INVALID_CLIP_URL" });
  }

  let title = body.title?.trim() ?? "";
  if (!title) {
    try {
      title = new URL(trimmedUrl).hostname || CLIP_LIST_FEED_TITLE;
    } catch {
      title = CLIP_LIST_FEED_TITLE;
    }
  }

  const id = crypto.randomUUID();
  const now = new Date();
  const inserted = await database
    .insert(articleClips)
    .values({
      id,
      userId,
      url: trimmedUrl,
      title,
      content: body.content?.trim() || null,
      note: body.note?.trim() || null,
      isRead: false,
      isSaved: true,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  const r = inserted[0];
  if (!r) {
    throw new AppError("Failed to create clip", { status: 500, code: "CLIP_CREATE_FAILED" });
  }

  return clipToDetail(r);
}

function clipToDetail(row: typeof articleClips.$inferSelect): ArticleDetailDto {
  const base = clipToListItem(row);
  return {
    ...base,
    content: row.content,
  };
}

export async function getClipDetailForUser(
  database: DB,
  userId: string,
  clipId: string,
): Promise<ArticleDetailDto | null> {
  const rows = await database
    .select()
    .from(articleClips)
    .where(and(eq(articleClips.id, clipId), eq(articleClips.userId, userId)))
    .limit(1);
  const r = rows[0];
  return r ? clipToDetail(r) : null;
}

export type ClipUpdateBody = {
  isRead?: boolean | null;
  isSaved?: boolean;
  title?: string;
  note?: string | null;
  content?: string | null;
};

export async function updateArticleClipForUser(
  database: DB,
  userId: string,
  clipId: string,
  body: ClipUpdateBody,
): Promise<boolean> {
  const hasAny =
    Object.hasOwn(body, "isRead") ||
    Object.hasOwn(body, "isSaved") ||
    Object.hasOwn(body, "title") ||
    Object.hasOwn(body, "note") ||
    Object.hasOwn(body, "content");
  if (!hasAny) {
    throw new AppError("No updatable fields provided", { status: 400, code: "EMPTY_UPDATE" });
  }

  const existing = await database
    .select()
    .from(articleClips)
    .where(and(eq(articleClips.id, clipId), eq(articleClips.userId, userId)))
    .limit(1);
  const prev = existing[0];
  if (!prev) {
    return false;
  }

  const now = new Date();
  const nextTitle =
    Object.hasOwn(body, "title") && typeof body.title === "string"
      ? body.title.trim() || prev.title
      : prev.title;
  const nextNote = Object.hasOwn(body, "note") ? body.note : prev.note;
  const nextContent = Object.hasOwn(body, "content") ? body.content : prev.content;
  const nextRead = Object.hasOwn(body, "isRead") ? body.isRead === true : prev.isRead;
  const nextSaved = Object.hasOwn(body, "isSaved") ? body.isSaved === true : prev.isSaved;

  await database
    .update(articleClips)
    .set({
      title: nextTitle,
      note: nextNote,
      content: nextContent,
      isRead: nextRead,
      isSaved: nextSaved,
      updatedAt: now,
    })
    .where(and(eq(articleClips.id, clipId), eq(articleClips.userId, userId)));

  return true;
}

export async function listClipsForUser(
  database: DB,
  userId: string,
  opts: ListClipsOptions,
): Promise<ArticlesCursorListResponseDto> {
  const limit = Math.min(Math.max(opts.limit, 1), 200);
  const rows = await listClipRows(database, userId, opts, limit + 1);
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore && page.length > 0 ? page[page.length - 1].id : null;

  return {
    items: page.map((r) => clipToListItem(r)),
    next_cursor: nextCursor,
    has_more: hasMore,
    total_count: null,
  };
}

async function listClipRows(
  database: DB,
  userId: string,
  opts: ListClipsOptions,
  take: number,
): Promise<(typeof articleClips.$inferSelect)[]> {
  const filters: SQL[] = [eq(articleClips.userId, userId)];
  if (opts.isRead === true) {
    filters.push(eq(articleClips.isRead, true));
  } else if (opts.isRead === false) {
    filters.push(eq(articleClips.isRead, false));
  }
  if (opts.isSaved === true) {
    filters.push(eq(articleClips.isSaved, true));
  } else if (opts.isSaved === false) {
    filters.push(eq(articleClips.isSaved, false));
  }
  if (opts.publishedAfter) {
    filters.push(gte(articleClips.createdAt, opts.publishedAfter));
  }
  if (opts.publishedBefore) {
    filters.push(lt(articleClips.createdAt, opts.publishedBefore));
  }

  if (opts.cursor) {
    const cur = await database
      .select({ createdAt: articleClips.createdAt, id: articleClips.id })
      .from(articleClips)
      .where(and(eq(articleClips.id, opts.cursor), eq(articleClips.userId, userId)))
      .limit(1);
    const c = cur[0];
    if (c) {
      filters.push(
        or(
          lt(articleClips.createdAt, c.createdAt),
          and(eq(articleClips.createdAt, c.createdAt), lt(articleClips.id, c.id)),
        )!,
      );
    }
  }

  return database
    .select()
    .from(articleClips)
    .where(and(...filters))
    .orderBy(desc(articleClips.createdAt), desc(articleClips.id))
    .limit(take);
}
