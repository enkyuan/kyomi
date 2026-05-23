import { and, eq, ne } from "drizzle-orm";
import { feeds } from "@vols.rss/db";
import type { db } from "@adapters/db/client";
import { deleteFeedSearchDocument, upsertFeedSearchDocument } from "@adapters/search/meili";
import { assertHttpOrHttpsUrl, normalizeFeedUrl } from "@modules/discover/feed/normalize-url";
import { AppError } from "@shared/errors/app";
import type { AdminGlobalFeedDetailDto, AdminUpdateGlobalFeedBody } from "../types";

type DB = typeof db;

function mapFeedRow(row: {
  id: string;
  url: string;
  title: string;
  description: string | null;
  link: string | null;
  createdAt: Date;
  updatedAt: Date;
}): AdminGlobalFeedDetailDto {
  return {
    id: row.id,
    url: row.url,
    title: row.title,
    description: row.description,
    link: row.link,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

type FeedRow = {
  id: string;
  url: string;
  title: string;
  description: string | null;
  link: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type FeedUpdates = {
  title?: string;
  description?: string | null;
  link?: string | null;
  url?: string;
  updatedAt: Date;
};

function assertPatchHasUpdatableField(patch: AdminUpdateGlobalFeedBody): void {
  const hasField = "title" in patch || "description" in patch || "link" in patch || "url" in patch;
  if (!hasField) {
    throw new AppError("No updatable fields provided", { status: 400, code: "EMPTY_UPDATE" });
  }
}

async function getExistingFeed(database: DB, feedId: string): Promise<FeedRow> {
  const existing = await database
    .select({
      id: feeds.id,
      url: feeds.url,
      title: feeds.title,
      description: feeds.description,
      link: feeds.link,
      createdAt: feeds.createdAt,
      updatedAt: feeds.updatedAt,
    })
    .from(feeds)
    .where(eq(feeds.id, feedId))
    .limit(1);
  const current = existing[0];
  if (!current) {
    throw new AppError("Feed not found", { status: 404, code: "FEED_NOT_FOUND" });
  }
  return current;
}

function applyTitlePatch(updates: FeedUpdates, patch: AdminUpdateGlobalFeedBody): void {
  if (!("title" in patch)) {
    return;
  }
  const next = (patch.title ?? "").trim();
  if (next.length === 0) {
    throw new AppError("title cannot be empty", { status: 400, code: "INVALID_FEED_TITLE" });
  }
  updates.title = next;
}

function applyDescriptionPatch(updates: FeedUpdates, patch: AdminUpdateGlobalFeedBody): void {
  if ("description" in patch) {
    updates.description = patch.description ?? null;
  }
}

function applyLinkPatch(updates: FeedUpdates, patch: AdminUpdateGlobalFeedBody): void {
  if (!("link" in patch)) {
    return;
  }
  if (patch.link === null || patch.link === undefined) {
    updates.link = null;
    return;
  }
  const trimmed = patch.link.trim();
  updates.link = trimmed.length > 0 ? trimmed : null;
}

function normalizePatchedUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (trimmed.length === 0) {
    throw new AppError("Invalid feed URL", { status: 400, code: "INVALID_FEED_URL" });
  }
  try {
    return normalizeFeedUrl(assertHttpOrHttpsUrl(trimmed).href);
  } catch {
    throw new AppError("Invalid feed URL", { status: 400, code: "INVALID_FEED_URL" });
  }
}

async function assertNoFeedUrlConflict(
  database: DB,
  feedId: string,
  normalizedUrl: string,
): Promise<void> {
  const clash = await database
    .select({ id: feeds.id })
    .from(feeds)
    .where(and(eq(feeds.url, normalizedUrl), ne(feeds.id, feedId)))
    .limit(1);
  if (!clash[0]) {
    return;
  }
  throw new AppError("A feed with this URL already exists", {
    status: 409,
    code: "FEED_URL_CONFLICT",
  });
}

async function applyUrlPatch(
  database: DB,
  updates: FeedUpdates,
  patch: AdminUpdateGlobalFeedBody,
  feedId: string,
  currentUrl: string,
): Promise<void> {
  if (!("url" in patch) || patch.url === undefined) {
    return;
  }
  const normalized = normalizePatchedUrl(patch.url);
  if (normalized === currentUrl) {
    return;
  }
  await assertNoFeedUrlConflict(database, feedId, normalized);
  updates.url = normalized;
}

async function applyAdminPatchToUpdates(
  database: DB,
  patch: AdminUpdateGlobalFeedBody,
  feedId: string,
  currentUrl: string,
): Promise<FeedUpdates> {
  const updates: FeedUpdates = { updatedAt: new Date() };
  applyTitlePatch(updates, patch);
  applyDescriptionPatch(updates, patch);
  applyLinkPatch(updates, patch);
  await applyUrlPatch(database, updates, patch, feedId, currentUrl);
  return updates;
}

async function saveFeedUpdates(
  database: DB,
  feedId: string,
  updates: FeedUpdates,
): Promise<FeedRow> {
  const rows = await database.update(feeds).set(updates).where(eq(feeds.id, feedId)).returning({
    id: feeds.id,
    url: feeds.url,
    title: feeds.title,
    description: feeds.description,
    link: feeds.link,
    createdAt: feeds.createdAt,
    updatedAt: feeds.updatedAt,
  });
  const row = rows[0];
  if (!row) {
    throw new AppError("Feed not found", { status: 404, code: "FEED_NOT_FOUND" });
  }
  return row;
}

export async function adminUpdateGlobalFeed(
  database: DB,
  feedId: string,
  patch: AdminUpdateGlobalFeedBody,
): Promise<AdminGlobalFeedDetailDto> {
  assertPatchHasUpdatableField(patch);
  const current = await getExistingFeed(database, feedId);
  const updates = await applyAdminPatchToUpdates(database, patch, feedId, current.url);
  const row = await saveFeedUpdates(database, feedId, updates);

  await upsertFeedSearchDocument({
    id: row.id,
    url: row.url,
    title: row.title,
    description: row.description,
    link: row.link,
  }).catch(() => undefined);

  return mapFeedRow(row);
}

export async function adminDeleteGlobalFeed(database: DB, feedId: string): Promise<void> {
  const removed = await database
    .delete(feeds)
    .where(eq(feeds.id, feedId))
    .returning({ id: feeds.id });
  if (removed.length === 0) {
    throw new AppError("Feed not found", { status: 404, code: "FEED_NOT_FOUND" });
  }
  await deleteFeedSearchDocument(feedId).catch(() => undefined);
}
