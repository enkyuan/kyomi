import { and, eq, ne } from "drizzle-orm";
import { feeds } from "@cronos/db";
import type { db } from "@adapters/db/client";
import { deleteFeedSearchDocument, upsertFeedSearchDocument } from "@adapters/search/meili";
import {
  assertHttpOrHttpsUrl,
  normalizeFeedUrl,
} from "@modules/discover/discover.normalize-feed-url";
import { AppError } from "@shared/errors/app-error";
import type { AdminGlobalFeedDetailDto, AdminUpdateGlobalFeedBody } from "./feeds.types";

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

export async function adminUpdateGlobalFeed(
  database: DB,
  feedId: string,
  patch: AdminUpdateGlobalFeedBody,
): Promise<AdminGlobalFeedDetailDto> {
  const hasField = "title" in patch || "description" in patch || "link" in patch || "url" in patch;
  if (!hasField) {
    throw new AppError("No updatable fields provided", { status: 400, code: "EMPTY_UPDATE" });
  }

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

  const now = new Date();
  const updates: {
    title?: string;
    description?: string | null;
    link?: string | null;
    url?: string;
    updatedAt: Date;
  } = { updatedAt: now };

  if ("title" in patch) {
    const next = (patch.title ?? "").trim();
    if (next.length === 0) {
      throw new AppError("title cannot be empty", { status: 400, code: "INVALID_FEED_TITLE" });
    }
    updates.title = next;
  }

  if ("description" in patch) {
    updates.description = patch.description ?? null;
  }

  if ("link" in patch) {
    if (patch.link === null || patch.link === undefined) {
      updates.link = null;
    } else {
      const trimmed = patch.link.trim();
      updates.link = trimmed.length > 0 ? trimmed : null;
    }
  }

  if ("url" in patch && patch.url !== undefined) {
    const trimmed = patch.url.trim();
    if (trimmed.length === 0) {
      throw new AppError("Invalid feed URL", { status: 400, code: "INVALID_FEED_URL" });
    }
    let normalized: string;
    try {
      normalized = normalizeFeedUrl(assertHttpOrHttpsUrl(trimmed).href);
    } catch {
      throw new AppError("Invalid feed URL", { status: 400, code: "INVALID_FEED_URL" });
    }
    if (normalized !== current.url) {
      const clash = await database
        .select({ id: feeds.id })
        .from(feeds)
        .where(and(eq(feeds.url, normalized), ne(feeds.id, feedId)))
        .limit(1);
      if (clash[0]) {
        throw new AppError("A feed with this URL already exists", {
          status: 409,
          code: "FEED_URL_CONFLICT",
        });
      }
      updates.url = normalized;
    }
  }

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
