import type { db } from "@adapters/db/client";
import { articleClips } from "@kyomi/db";
import { assertHttpOrHttpsUrl } from "@modules/discover/feed/normalize";
import { and, asc, desc, eq, gt, gte, ilike, lt, or, type SQL } from "drizzle-orm";
import { AppError } from "@shared/errors/app";
import { assertContentFieldBudget } from "@shared/http/content-budget";
import type { ArticleSort } from "@modules/articles/query";
import { buildStoredContentRecord } from "@modules/articles/reader/content";
import { extractFullTextFromUrl } from "@modules/articles/reader/enrichment";
import type {
  ArticleDetailDto,
  ArticleListItemDto,
  ArticlesCursorListResponseDto,
} from "@modules/articles/types";
import { clipToDetail } from "./detail";
import { CLIP_LIST_FEED_ID, CLIP_LIST_FEED_TITLE } from "./constants";

type DB = typeof db;

export type CreateArticleClipBody = {
  url: string;
  title?: string;
  content?: string;
  note?: string;
};

export type ListClipsOptions = {
  search?: string;
  isRead?: boolean;
  isSaved?: boolean;
  publishedAfter?: Date;
  publishedBefore?: Date;
  sort?: ArticleSort;
  limit: number;
  cursor?: string;
  /** Merged feed+clip pagination boundary in the active sort order. */
  exclusiveBefore?: { publishedAt: Date; id: string; isRead?: boolean };
};

type ClipCursor = { publishedAt: Date; id: string; isRead?: boolean };

function clipToListItem(row: typeof articleClips.$inferSelect): ArticleListItemDto {
  return {
    id: row.id,
    title: row.title,
    link: row.url,
    summary: row.note,
    publishedAt: row.createdAt.toISOString(),
    feedId: CLIP_LIST_FEED_ID,
    feedUrl: row.url,
    feedSiteUrl: null,
    feedTitle: CLIP_LIST_FEED_TITLE,
    feedFaviconUrl: null,
    isRead: row.isRead,
    isSaved: row.isSaved,
    articleType: "clip",
    categories: [],
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

function resolveClipUpdateValues(
  body: ClipUpdateBody,
  prev: typeof articleClips.$inferSelect,
  now: Date,
) {
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
  const isSaved = Object.hasOwn(body, "isSaved") ? body.isSaved === true : prev.isSaved;
  const savedAt = Object.hasOwn(body, "isSaved")
    ? isSaved
      ? (prev.savedAt ?? now)
      : null
    : prev.savedAt;
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
    isSaved,
    savedAt,
  };
}

export async function createArticleClip(
  database: DB,
  userId: string,
  body: CreateArticleClipBody,
): Promise<ArticleDetailDto> {
  assertContentFieldBudget([{ name: "content", value: body.content }]);
  const trimmedUrl = ensureClipUrl(body.url);
  const content = await resolveClipContent(body.content, trimmedUrl);
  const title = resolveClipTitle(body.title, content, trimmedUrl);
  const stored = buildStoredContentRecord({
    articleType: "clip",
    title,
    summary: body.note?.trim() || null,
    contentBaseUrl: trimmedUrl,
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
      savedAt: now,
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
  assertContentFieldBudget([
    { name: "content", value: body.content },
    { name: "contentHtml", value: body.contentHtml },
    { name: "contentText", value: body.contentText },
    { name: "contentMarkdown", value: body.contentMarkdown },
  ]);

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
  const next = resolveClipUpdateValues(body, prev, now);

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
      savedAt: next.savedAt,
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

function pushClipSortBoundaryFilter(filters: SQL[], sort: ArticleSort, cursor: ClipCursor): void {
  const olderThanCursor = or(
    lt(articleClips.createdAt, cursor.publishedAt),
    and(eq(articleClips.createdAt, cursor.publishedAt), lt(articleClips.id, cursor.id)),
  )!;
  if (sort === "oldest") {
    filters.push(
      or(
        gt(articleClips.createdAt, cursor.publishedAt),
        and(eq(articleClips.createdAt, cursor.publishedAt), gt(articleClips.id, cursor.id)),
      )!,
    );
    return;
  }
  if (sort === "unread-first" && cursor.isRead !== undefined) {
    filters.push(
      cursor.isRead
        ? and(eq(articleClips.isRead, true), olderThanCursor)!
        : or(eq(articleClips.isRead, true), and(eq(articleClips.isRead, false), olderThanCursor))!,
    );
    return;
  }
  filters.push(olderThanCursor);
}

function clipOrderByForSort(sort: ArticleSort) {
  if (sort === "oldest") {
    return [asc(articleClips.createdAt), asc(articleClips.id)] as const;
  }
  if (sort === "unread-first") {
    return [asc(articleClips.isRead), desc(articleClips.createdAt), desc(articleClips.id)] as const;
  }
  return [desc(articleClips.createdAt), desc(articleClips.id)] as const;
}

function escapeLikePattern(input: string): string {
  return input.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
}

async function listClipRows(
  database: DB,
  userId: string,
  opts: ListClipsOptions,
  take: number,
): Promise<(typeof articleClips.$inferSelect)[]> {
  const sort = opts.sort ?? "latest";
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
  const search = opts.search?.trim();
  if (search) {
    const pattern = `%${escapeLikePattern(search)}%`;
    filters.push(
      or(
        ilike(articleClips.title, pattern),
        ilike(articleClips.note, pattern),
        ilike(articleClips.url, pattern),
      )!,
    );
  }

  if (opts.exclusiveBefore) {
    pushClipSortBoundaryFilter(filters, sort, opts.exclusiveBefore);
  } else if (opts.cursor) {
    const cur = await database
      .select({
        createdAt: articleClips.createdAt,
        id: articleClips.id,
        isRead: articleClips.isRead,
      })
      .from(articleClips)
      .where(and(eq(articleClips.id, opts.cursor), eq(articleClips.userId, userId)))
      .limit(1);
    const c = cur[0];
    if (c) {
      pushClipSortBoundaryFilter(filters, sort, {
        publishedAt: c.createdAt,
        id: c.id,
        isRead: c.isRead,
      });
    }
  }

  return database
    .select()
    .from(articleClips)
    .where(and(...filters))
    .orderBy(...clipOrderByForSort(sort))
    .limit(take);
}
