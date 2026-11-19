import { Effect } from "effect";
import { and, eq, inArray, sql } from "drizzle-orm";
import { feedSubscriptions, folders } from "@kyomi/db";
import { Db, type Database } from "@adapters/db/service";
import { AppLogger } from "@adapters/logger/service";
import {
  BadRequest,
  Conflict,
  DatabaseError,
  InternalError,
  NotFound,
} from "@shared/effect/errors";
import { currentDate } from "@shared/effect/clock";
import { CurrentUser } from "@shared/effect/request";
import type { FolderDto, FolderReadStatusResponseDto, UpdateFolderInput } from "./types";

export const DEFAULT_FOLDER_NAME = "Unsorted";
const FOLDER_BATCH_SIZE = 500;
const FOLDER_MAX_NAME_LENGTH = 512;

const folderNotFound = () =>
  new NotFound({ message: "Folder not found", code: "FOLDER_NOT_FOUND" });
const folderNameRequired = () =>
  new BadRequest({ message: "name is required", code: "FOLDER_NAME_REQUIRED" });
const folderCreateFailed = () =>
  new InternalError({ message: "Failed to create folder", code: "FOLDER_CREATE_FAILED" });

/** The slice of a Drizzle client (or an open transaction) the lookup helpers write and read with. */
type FolderHandle = Pick<Database, "insert" | "select">;
type FolderRow = typeof folders.$inferSelect;

/** Run one Promise-based statement against `handle`, mapping a driver failure to `DatabaseError`. */
const statement = <A>(operation: string, run: () => Promise<A>) =>
  Effect.tryPromise({ try: run, catch: (cause) => new DatabaseError({ operation, cause }) });

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function newFolderRow(userId: string, name: string, now: Date) {
  return { id: crypto.randomUUID(), userId, name, createdAt: now, updatedAt: now };
}

/**
 * Bulk get-or-create for folder names, bounded to at most FOLDER_BATCH_SIZE rows per
 * insert/select statement regardless of how many distinct names are requested. Takes the handle
 * explicitly so callers can run it inside their own transaction.
 */
export const ensureFolders = Effect.fn("folders.ensureByName")(function* (
  handle: FolderHandle,
  userId: string,
  names: string[],
) {
  const trimmed = [...new Set(names.map((name) => name.trim()).filter((name) => name.length > 0))];
  if (trimmed.some((name) => name.length > FOLDER_MAX_NAME_LENGTH)) {
    return yield* new BadRequest({
      message: "Folder name exceeds maximum length",
      code: "FOLDER_NAME_TOO_LONG",
    });
  }
  if (trimmed.length === 0) {
    return new Map<string, string>();
  }

  const batches = chunk(trimmed, FOLDER_BATCH_SIZE);
  const now = yield* currentDate;
  yield* Effect.forEach(batches, (batch) =>
    statement("folders.ensure.insert", () =>
      handle
        .insert(folders)
        .values(batch.map((name) => newFolderRow(userId, name, now)))
        .onConflictDoNothing(),
    ),
  );

  const result = new Map<string, string>();
  yield* Effect.forEach(batches, (batch) =>
    statement("folders.ensure.select", () =>
      handle
        .select({ id: folders.id, name: folders.name })
        .from(folders)
        .where(and(eq(folders.userId, userId), inArray(folders.name, batch))),
    ).pipe(
      Effect.map((rows) => {
        for (const row of rows) {
          result.set(row.name, row.id);
        }
      }),
    ),
  );

  if (trimmed.some((name) => !result.has(name))) {
    return yield* folderCreateFailed();
  }
  return result;
});

/** Get-or-create one folder by (trimmed) name; safe against a concurrent create of the same name. */
export const getOrCreateFolder = Effect.fn("folders.getOrCreateByName")(function* (
  handle: FolderHandle,
  userId: string,
  name: string,
) {
  const trimmed = name.trim();
  if (!trimmed) {
    return yield* folderNameRequired();
  }

  const now = yield* currentDate;
  // Attempt insert; if the (userId, name) unique index fires, silently skip.
  yield* statement("folders.getOrCreate.insert", () =>
    handle
      .insert(folders)
      .values(newFolderRow(userId, trimmed, now))
      .onConflictDoNothing(),
  );

  // Always select after the upsert: works whether we just inserted or raced with another request.
  const [folder] = yield* statement("folders.getOrCreate.select", () =>
    handle
      .select()
      .from(folders)
      .where(and(eq(folders.userId, userId), eq(folders.name, trimmed)))
      .limit(1),
  );
  if (!folder) {
    return yield* folderCreateFailed();
  }
  return folder;
});

/**
 * Promise entry points for code that runs inside a Drizzle transaction callback (feed
 * subscription, OPML import), where a Promise handle is the only seam. They reject with the typed
 * errors above. Remove them when those callers move to Effect and call the Effects directly.
 */
export const ensureFoldersByName = (handle: FolderHandle, userId: string, names: string[]) =>
  Effect.runPromise(ensureFolders(handle, userId, names));

export const getOrCreateFolderByName = (handle: FolderHandle, userId: string, name: string) =>
  Effect.runPromise(getOrCreateFolder(handle, userId, name));

function mapFolder(row: FolderRow): FolderDto {
  return {
    id: row.id,
    name: row.name,
    isPinned: row.isPinned,
    pinnedAt: row.pinnedAt ? row.pinnedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

export const createFolder = Effect.fn("folders.create")(function* (name: string) {
  const { userId } = yield* CurrentUser;
  const db = yield* Db;
  const log = yield* AppLogger;
  const trimmed = name.trim();
  if (!trimmed) {
    return yield* folderNameRequired();
  }

  const now = yield* currentDate;
  const [folder] = yield* db.use("folders.create", (client) =>
    client
      .insert(folders)
      .values(newFolderRow(userId, trimmed, now))
      .onConflictDoNothing()
      .returning(),
  );
  if (!folder) {
    return yield* new Conflict({ message: "Folder already exists", code: "FOLDER_DUPLICATE" });
  }

  yield* log.info("folders.created", { userId, folderId: folder.id });
  return mapFolder(folder);
});

const listOwnFolders = Effect.fn("folders.list")(function* (userId: string) {
  const db = yield* Db;
  const rows = yield* db.use("folders.list", (client) =>
    client
      .select()
      .from(folders)
      .where(eq(folders.userId, userId))
      .orderBy(
        sql`CASE WHEN ${folders.name} = ${DEFAULT_FOLDER_NAME} THEN 0 ELSE 1 END`,
        sql`${folders.position} ASC NULLS LAST`,
        folders.name,
      ),
  );
  return rows.map(mapFolder);
});

export const listFolders = Effect.gen(function* () {
  const { userId } = yield* CurrentUser;
  return yield* listOwnFolders(userId);
});

/**
 * Saves the order a user arranged their folders in: each id takes its index as its position. The
 * ids must be distinct folders of the user's own; the default folder stays first whatever it holds.
 */
export const reorderFolders = Effect.fn("folders.reorder")(function* (folderIds: string[]) {
  const { userId } = yield* CurrentUser;
  const db = yield* Db;
  const log = yield* AppLogger;
  if (new Set(folderIds).size !== folderIds.length) {
    return yield* new BadRequest({
      message: "Folder ids must be distinct",
      code: "FOLDER_ORDER_INVALID",
    });
  }

  const now = yield* currentDate;
  const outcome = yield* db.use("folders.reorder", (client) =>
    client.transaction(async (tx) => {
      const owned = await tx
        .select({ id: folders.id })
        .from(folders)
        .where(and(eq(folders.userId, userId), inArray(folders.id, folderIds)));
      if (owned.length !== folderIds.length) {
        return "unknown-folder" as const;
      }

      // One typed update per folder (a user has few): a CASE over bound parameters would leave
      // their types for Postgres to guess, and it guesses text for an integer column.
      for (const [index, id] of folderIds.entries()) {
        await tx
          .update(folders)
          .set({ position: index, updatedAt: now })
          .where(and(eq(folders.id, id), eq(folders.userId, userId)));
      }
      return "reordered" as const;
    }),
  );
  if (outcome === "unknown-folder") {
    return yield* folderNotFound();
  }

  yield* log.info("folders.reordered", { userId, count: folderIds.length });
  return yield* listOwnFolders(userId);
});

export const updateFolder = Effect.fn("folders.update")(function* (
  folderId: string,
  patch: UpdateFolderInput,
) {
  const { userId } = yield* CurrentUser;
  const db = yield* Db;
  const log = yield* AppLogger;
  if (!("name" in patch) && !("isPinned" in patch)) {
    return yield* new BadRequest({
      message: "No updatable fields provided",
      code: "EMPTY_UPDATE",
    });
  }

  const now = yield* currentDate;
  const updatePatch: Partial<{
    name: string;
    isPinned: boolean;
    pinnedAt: Date | null;
    updatedAt: Date;
  }> = { updatedAt: now };

  if ("name" in patch) {
    const trimmed = patch.name?.trim();
    if (!trimmed) {
      return yield* folderNameRequired();
    }
    updatePatch.name = trimmed;
  }

  if ("isPinned" in patch && typeof patch.isPinned === "boolean") {
    updatePatch.isPinned = patch.isPinned;
    updatePatch.pinnedAt = patch.isPinned ? now : null;
  }

  const [row] = yield* db.use("folders.update", (client) =>
    client
      .update(folders)
      .set(updatePatch)
      .where(and(eq(folders.id, folderId), eq(folders.userId, userId)))
      .returning(),
  );
  if (!row) {
    return yield* folderNotFound();
  }

  yield* log.info("folders.updated", { userId, folderId });
  return mapFolder(row);
});

export const deleteFolder = Effect.fn("folders.delete")(function* (folderId: string) {
  const { userId } = yield* CurrentUser;
  const db = yield* Db;
  const log = yield* AppLogger;

  const [folder] = yield* db.use("folders.delete.find", (client) =>
    client
      .select({ id: folders.id, name: folders.name })
      .from(folders)
      .where(and(eq(folders.id, folderId), eq(folders.userId, userId)))
      .limit(1),
  );
  if (!folder) {
    return yield* folderNotFound();
  }
  if (folder.name === DEFAULT_FOLDER_NAME) {
    return yield* new BadRequest({
      message: "Default folder cannot be deleted",
      code: "DEFAULT_FOLDER_DELETE_FORBIDDEN",
    });
  }

  const fallbackFolder = yield* getOrCreateFolder(db.client, userId, DEFAULT_FOLDER_NAME);
  const now = yield* currentDate;
  yield* db.use("folders.delete.move", (client) =>
    client
      .update(feedSubscriptions)
      .set({ folderId: fallbackFolder.id, updatedAt: now })
      .where(and(eq(feedSubscriptions.userId, userId), eq(feedSubscriptions.folderId, folderId))),
  );
  yield* db.use("folders.delete", (client) =>
    client.delete(folders).where(and(eq(folders.id, folderId), eq(folders.userId, userId))),
  );

  yield* log.info("folders.deleted", { userId, folderId });
});

export const markFolderReadStatus = Effect.fn("folders.markRead")(function* (folderId: string) {
  const { userId } = yield* CurrentUser;
  const db = yield* Db;
  const log = yield* AppLogger;

  const [existing] = yield* db.use("folders.markRead.find", (client) =>
    client
      .select({ id: folders.id })
      .from(folders)
      .where(and(eq(folders.id, folderId), eq(folders.userId, userId)))
      .limit(1),
  );
  if (!existing) {
    return yield* folderNotFound();
  }

  const now = yield* currentDate;
  const updated = yield* db.use("folders.markRead", (client) =>
    client
      .update(feedSubscriptions)
      .set({ lastReadCutoff: now })
      .where(and(eq(feedSubscriptions.userId, userId), eq(feedSubscriptions.folderId, folderId)))
      .returning({ id: feedSubscriptions.id }),
  );

  yield* log.info("folders.read_status.mark_all", { userId, folderId });
  return {
    message: "All articles in folder marked as read",
    folderId,
    updatedSubscriptions: updated.length,
  } satisfies FolderReadStatusResponseDto;
});
