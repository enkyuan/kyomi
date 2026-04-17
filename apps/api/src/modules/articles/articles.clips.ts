import type { db } from "@adapters/db/client";
import { articleClips } from "@cronos/db";
import { assertHttpOrHttpsUrl } from "@modules/discover/discover.normalize-feed-url";
import { and, desc, eq, gte, lt, or, sql, type SQL } from "drizzle-orm";
import { AppError } from "@shared/errors/app-error";
import { extractFullTextFromUrl } from "./articles.enhancements";
import { buildStoredContentRecord, buildStoredReaderContent } from "./articles.normalize-content";
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

function ensureClipUrl(rawUrl: string): string {
  const trimmedUrl = rawUrl.trim();
  if (!trimmedUrl) {
    throw new AppError("url is required", { status: 400, code: "CLIP_URL_REQUIRED" });
  }
  try {
    assertHttpOrHttpsUrl(trimmedUrl);
  } catch {
    throw new AppError("Invalid URL", { status: 400, code: "INVALID_CLIP_URL" });
  }
  return trimmedUrl;
}

async function resolveClipContent(input: string | undefined, url: string): Promise<string | null> {
  const trimmed = input?.trim() || null;
  if (trimmed) {
    return trimmed;
  }
  try {
    return await extractFullTextFromUrl(url);
  } catch {
    return null;
  }
}

function deriveTitleFromContent(content: string | null): string {
  if (!content) {
    return "";
  }
  const firstLine = content
    .split(/\n+/)
    .map((part) => part.trim())
    .find((part) => part.length > 0);
  if (!firstLine) {
    return "";
  }
  return firstLine.length > 120 ? `${firstLine.slice(0, 117)}...` : firstLine;
}

function deriveFallbackTitle(url: string): string {
  try {
    return new URL(url).hostname || CLIP_LIST_FEED_TITLE;
  } catch {
    return CLIP_LIST_FEED_TITLE;
  }
}

function resolveClipTitle(
  rawTitle: string | undefined,
  content: string | null,
  url: string,
): string {
  const direct = rawTitle?.trim() ?? "";
  if (direct) {
    return direct;
  }
  const contentTitle = deriveTitleFromContent(content);
  if (contentTitle) {
    return contentTitle;
  }
  return deriveFallbackTitle(url);
}

function assertClipUpdateHasFields(body: ClipUpdateBody): void {
  const hasAny =
    Object.hasOwn(body, "isRead") ||
    Object.hasOwn(body, "isSaved") ||
    Object.hasOwn(body, "title") ||
    Object.hasOwn(body, "note") ||
    Object.hasOwn(body, "content") ||
    Object.hasOwn(body, "contentHtml") ||
    Object.hasOwn(body, "contentText") ||
    Object.hasOwn(body, "contentMarkdown") ||
    Object.hasOwn(body, "contentStatus") ||
    Object.hasOwn(body, "contentSource") ||
    Object.hasOwn(body, "extractionErrorCode") ||
    Object.hasOwn(body, "extractionErrorMessage");
  if (!hasAny) {
    throw new AppError("No updatable fields provided", { status: 400, code: "EMPTY_UPDATE" });
  }
}

function resolveClipUpdateValues(body: ClipUpdateBody, prev: typeof articleClips.$inferSelect) {
  const title =
    Object.hasOwn(body, "title") && typeof body.title === "string"
      ? body.title.trim() || prev.title
      : prev.title;
  const contentHtml = Object.hasOwn(body, "contentHtml") ? body.contentHtml : prev.contentHtml;
  const contentText = Object.hasOwn(body, "contentText") ? body.contentText : prev.contentText;
  const contentMarkdown = Object.hasOwn(body, "contentMarkdown")
    ? body.contentMarkdown
    : prev.contentMarkdown;
  const contentStatus = Object.hasOwn(body, "contentStatus")
    ? body.contentStatus
    : prev.contentStatus;
  const contentSource = Object.hasOwn(body, "contentSource")
    ? body.contentSource
    : prev.contentSource;
  const extractionErrorCode = Object.hasOwn(body, "extractionErrorCode")
    ? body.extractionErrorCode
    : prev.extractionErrorCode;
  const extractionErrorMessage = Object.hasOwn(body, "extractionErrorMessage")
    ? body.extractionErrorMessage
    : prev.extractionErrorMessage;
  return {
    title,
    note: Object.hasOwn(body, "note") ? body.note : prev.note,
    content: Object.hasOwn(body, "content") ? body.content : prev.content,
    contentHtml,
    contentText,
    contentMarkdown,
    contentStatus,
    contentSource,
    extractionErrorCode,
    extractionErrorMessage,
    isRead: Object.hasOwn(body, "isRead") ? body.isRead === true : prev.isRead,
    isSaved: Object.hasOwn(body, "isSaved") ? body.isSaved === true : prev.isSaved,
  };
}

export async function createArticleClip(
  database: DB,
  userId: string,
  body: CreateArticleClipBody,
): Promise<ArticleDetailDto> {
  const trimmedUrl = ensureClipUrl(body.url);
  const content = await resolveClipContent(body.content, trimmedUrl);
  const title = resolveClipTitle(body.title, content, trimmedUrl);
  const stored = buildStoredContentRecord({
    articleType: "clip",
    title,
    summary: body.note?.trim() || null,
    legacyContent: content,
    contentHtml: null,
    contentText: null,
    contentMarkdown: null,
    contentStatus: null,
    contentSource: null,
    extractionErrorCode: null,
    extractionErrorMessage: null,
  });

  const id = crypto.randomUUID();
  const now = new Date();
  const inserted = await database
    .insert(articleClips)
    .values({
      id,
      userId,
      url: trimmedUrl,
      title,
      content,
      contentHtml: stored.contentHtml,
      contentText: stored.contentText,
      contentMarkdown: stored.contentMarkdown,
      contentStatus: stored.contentStatus,
      contentSource: stored.contentSource,
      extractionErrorCode: stored.extractionErrorCode,
      extractionErrorMessage: stored.extractionErrorMessage,
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
    contentHtml: row.contentHtml,
    contentText: row.contentText,
    contentMarkdown: row.contentMarkdown,
    contentStatus: (row.contentStatus as ArticleDetailDto["contentStatus"]) ?? "pending",
    contentSource: (row.contentSource as ArticleDetailDto["contentSource"]) ?? "link_only",
    extractionErrorCode: row.extractionErrorCode,
    extractionErrorMessage: row.extractionErrorMessage,
    reader: buildStoredReaderContent({
      articleType: "clip",
      title: row.title,
      summary: row.note,
      legacyContent: row.content,
      contentHtml: row.contentHtml,
      contentText: row.contentText,
      contentMarkdown: row.contentMarkdown,
      contentStatus: row.contentStatus as ArticleDetailDto["contentStatus"] | null,
      contentSource: row.contentSource as ArticleDetailDto["contentSource"] | null,
      extractionErrorCode: row.extractionErrorCode,
      extractionErrorMessage: row.extractionErrorMessage,
    }),
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
  contentHtml?: string | null;
  contentText?: string | null;
  contentMarkdown?: string | null;
  contentStatus?: ArticleDetailDto["contentStatus"] | null;
  contentSource?: ArticleDetailDto["contentSource"] | null;
  extractionErrorCode?: string | null;
  extractionErrorMessage?: string | null;
};

export async function updateArticleClipForUser(
  database: DB,
  userId: string,
  clipId: string,
  body: ClipUpdateBody,
): Promise<boolean> {
  assertClipUpdateHasFields(body);

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
  const next = resolveClipUpdateValues(body, prev);

  await database
    .update(articleClips)
    .set({
      title: next.title,
      note: next.note,
      content: next.content,
      contentHtml: next.contentHtml,
      contentText: next.contentText,
      contentMarkdown: next.contentMarkdown,
      contentStatus: next.contentStatus,
      contentSource: next.contentSource,
      extractionErrorCode: next.extractionErrorCode,
      extractionErrorMessage: next.extractionErrorMessage,
      isRead: next.isRead,
      isSaved: next.isSaved,
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
  const filters = buildClipFilters(userId, opts);
  const limit = Math.min(Math.max(opts.limit, 1), 200);
  const listFilters = [...filters];
  const [rows, totalCount] = await Promise.all([
    listClipRows(database, listFilters, userId, opts, limit + 1),
    countClipsForUser(database, filters),
  ]);
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore && page.length > 0 ? page[page.length - 1].id : null;

  return {
    items: page.map((r) => clipToListItem(r)),
    next_cursor: nextCursor,
    has_more: hasMore,
    total_count: totalCount,
  };
}

function buildClipFilters(userId: string, opts: ListClipsOptions): SQL[] {
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
  return filters;
}

async function listClipRows(
  database: DB,
  filters: SQL[],
  userId: string,
  opts: ListClipsOptions,
  take: number,
): Promise<(typeof articleClips.$inferSelect)[]> {
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

async function countClipsForUser(database: DB, filters: SQL[]): Promise<number> {
  const [row] = await database
    .select({ c: sql<number>`count(*)::int` })
    .from(articleClips)
    .where(filters.length > 0 ? and(...filters) : sql`true`);

  return row?.c ?? 0;
}
