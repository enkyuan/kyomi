import { Effect } from "effect";
import { articleClips } from "@kyomi/db";
import { and, eq } from "drizzle-orm";
import { Db } from "@adapters/db/service";
import { AppLogger } from "@adapters/logger/service";
import { JobQueue } from "@adapters/queue/service";
import { enqueueEnrichmentForStoredDocument } from "@modules/articles/document/enrich";
import { compileBodyDocumentColumns } from "@modules/articles/document/stored";
import { buildStoredContentRecord } from "@modules/articles/reader/content";
import type { ArticleDetailDto } from "@modules/articles/types";
import { BadRequest, InternalError } from "@shared/effect/errors";
import { serializeError } from "@shared/errors/serialize";
import { checkContentFieldBudget } from "@shared/http/budget";
import { assertHttpOrHttpsUrl } from "@shared/net/http";
import { currentDate } from "@shared/effect/clock";
import { articleNotFound } from "../../errors";
import { hasAnyOwn, savedAtAfter } from "../fields";
import { compileClientHtml } from "../html";
import { clipReadColumns, type ClipReadRow } from "./columns";
import { CLIP_LIST_FEED_TITLE } from "./constants";
import { clipToDetail } from "./detail";

/** Listing lives with the other clip queries; re-exported for existing importers. */
export { listClipsForUser, type ListClipsOptions } from "./queries";

export type CreateArticleClipBody = {
  url: string;
  title?: string;
  content?: string;
  note?: string;
};

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

/** The keys an update body may carry; routes copy exactly these from the validated request. */
export const CLIP_UPDATE_KEYS = [
  "isRead",
  "isSaved",
  "title",
  "note",
  "content",
  "contentHtml",
  "contentText",
  "contentMarkdown",
  "contentStatus",
  "contentSource",
  "extractionErrorCode",
  "extractionErrorMessage",
] as const satisfies readonly (keyof ClipUpdateBody)[];

function ensureClipUrl(rawUrl: string): Effect.Effect<string, BadRequest> {
  const trimmedUrl = rawUrl.trim();
  if (!trimmedUrl) {
    return Effect.fail(new BadRequest({ message: "url is required", code: "CLIP_URL_REQUIRED" }));
  }
  return Effect.try({
    try: () => {
      assertHttpOrHttpsUrl(trimmedUrl);
      return trimmedUrl;
    },
    catch: () => new BadRequest({ message: "Invalid URL", code: "INVALID_CLIP_URL" }),
  });
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

/** Field-by-field merge of an update body over the stored clip; absent keys keep their value. */
const resolveClipUpdateValues = Effect.fn("articles.clip.resolve_update")(function* (
  body: ClipUpdateBody,
  prev: ClipReadRow,
  now: Date,
) {
  const pick = <K extends keyof ClipUpdateBody & keyof ClipReadRow>(key: K) =>
    (Object.hasOwn(body, key) ? body[key] : prev[key]) as ClipReadRow[K];

  const title =
    Object.hasOwn(body, "title") && typeof body.title === "string"
      ? body.title.trim() || prev.title
      : prev.title;
  const html = Object.hasOwn(body, "contentHtml")
    ? yield* compileClientHtml(body.contentHtml, { baseUrl: prev.url, title: prev.title })
    : null;
  const hasSaved = Object.hasOwn(body, "isSaved");

  return {
    title,
    note: pick("note"),
    content: pick("content"),
    contentHtml: html ? html.contentHtml : prev.contentHtml,
    html,
    contentText: pick("contentText"),
    contentMarkdown: pick("contentMarkdown"),
    contentStatus: pick("contentStatus"),
    contentSource: pick("contentSource"),
    extractionErrorCode: pick("extractionErrorCode"),
    extractionErrorMessage: pick("extractionErrorMessage"),
    isRead: Object.hasOwn(body, "isRead") ? body.isRead === true : prev.isRead,
    isSaved: hasSaved ? body.isSaved === true : prev.isSaved,
    savedAt: savedAtAfter(prev.savedAt, hasSaved ? body.isSaved === true : undefined, now),
  };
});

/**
 * Saves a link (and optional pasted content) as a clip. A clip without content gets a full-text
 * extraction job; when that job cannot be queued the clip stays and is marked as failed to extract.
 */
export const createArticleClip = Effect.fn("articles.clip.create")(function* (
  userId: string,
  body: CreateArticleClipBody,
) {
  const db = yield* Db;
  const queue = yield* JobQueue;
  const log = yield* AppLogger;

  yield* checkContentFieldBudget([{ name: "content", value: body.content }]);
  const url = yield* ensureClipUrl(body.url);
  const content = body.content?.trim() || null;
  const note = body.note?.trim() || null;
  const title = resolveClipTitle(body.title, content, url);
  const isAutogeneratedTitle = !body.title?.trim();
  const stored = buildStoredContentRecord({
    articleType: "clip",
    title,
    summary: note,
    contentBaseUrl: url,
    legacyContent: content,
    contentHtml: null,
    contentText: null,
    contentMarkdown: null,
    contentStatus: null,
    contentSource: null,
    extractionErrorCode: null,
    extractionErrorMessage: null,
  });
  const documentColumns = yield* compileBodyDocumentColumns({
    raw: content,
    contentSource: stored.contentSource,
    baseUrl: url,
    title,
  });

  const now = yield* currentDate;
  const [row] = yield* db.use("articles.clip.insert", (client) =>
    client
      .insert(articleClips)
      .values({
        id: crypto.randomUUID(),
        userId,
        url,
        title,
        content,
        contentHtml: stored.contentHtml,
        contentRaw: content,
        contentSanitizerVersion: stored.contentSanitizerVersion,
        ...documentColumns,
        contentText: stored.contentText,
        contentMarkdown: stored.contentMarkdown,
        contentStatus: stored.contentStatus,
        contentSource: stored.contentSource,
        extractionErrorCode: stored.extractionErrorCode,
        extractionErrorMessage: stored.extractionErrorMessage,
        note,
        isRead: false,
        isSaved: true,
        savedAt: now,
        createdAt: now,
        updatedAt: now,
      })
      .returning(clipReadColumns),
  );
  if (!row) {
    return yield* new InternalError({
      message: "Failed to create clip",
      code: "CLIP_CREATE_FAILED",
    });
  }

  if (content) {
    yield* enqueueEnrichmentForStoredDocument({
      table: "article_clips",
      id: row.id,
      body: "original",
    });
  } else {
    yield* queue
      .publish({
        type: "article.extract",
        payload: {
          articleId: row.id,
          userId,
          requestedAt: now.toISOString(),
          reason: "clip_created",
          replaceClipTitle: isAutogeneratedTitle,
          ...(isAutogeneratedTitle ? { autogeneratedTitleAtQueue: title } : {}),
        },
      })
      .pipe(
        Effect.catchTag("RedisError", (error) =>
          Effect.gen(function* () {
            yield* log.warn("articles.clip.extraction_enqueue_failed", {
              clipId: row.id,
              error: serializeError(error),
            });
            yield* db.use("articles.clip.mark_extraction_failed", (client) =>
              client
                .update(articleClips)
                .set({
                  extractedContentStatus: "failed",
                  extractedContentError: "Full text extraction could not be queued.",
                  extractedContentUpdatedAt: now,
                  updatedAt: now,
                })
                .where(eq(articleClips.id, row.id)),
            );
          }),
        ),
      );
  }

  yield* log.info("articles.clip.created", { userId, clipId: row.id });
  return clipToDetail(row);
});

/** Applies an update body to one of the user's clips; fails with not found when it is not theirs. */
export const updateArticleClipForUser = Effect.fn("articles.clip.update")(function* (
  userId: string,
  clipId: string,
  body: ClipUpdateBody,
) {
  const db = yield* Db;
  if (!hasAnyOwn(body, CLIP_UPDATE_KEYS)) {
    return yield* new BadRequest({
      message: "No updatable fields provided",
      code: "EMPTY_UPDATE",
    });
  }
  yield* checkContentFieldBudget([
    { name: "content", value: body.content },
    { name: "contentHtml", value: body.contentHtml },
    { name: "contentText", value: body.contentText },
    { name: "contentMarkdown", value: body.contentMarkdown },
  ]);

  const [prev] = yield* db.use("articles.clip.update_find", (client) =>
    client
      .select(clipReadColumns)
      .from(articleClips)
      .where(and(eq(articleClips.id, clipId), eq(articleClips.userId, userId)))
      .limit(1),
  );
  if (!prev) {
    return yield* articleNotFound();
  }

  const now = yield* currentDate;
  const next = yield* resolveClipUpdateValues(body, prev, now);

  yield* db.use("articles.clip.update", (client) =>
    client
      .update(articleClips)
      .set({
        title: next.title,
        note: next.note,
        content: next.content,
        contentHtml: next.contentHtml,
        ...(next.html && {
          contentRaw: next.html.contentRaw,
          contentSanitizerVersion: next.html.contentSanitizerVersion,
          ...next.html.documentColumns,
        }),
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
      .where(and(eq(articleClips.id, clipId), eq(articleClips.userId, userId))),
  );

  if (next.html) {
    yield* enqueueEnrichmentForStoredDocument({
      table: "article_clips",
      id: clipId,
      body: "original",
    });
  }
});
