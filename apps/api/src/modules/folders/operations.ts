import type { db } from "@adapters/db/client";
import { feedSubscriptions, folders } from "@kyomi/db";
import { and, eq, inArray, sql } from "drizzle-orm";
import { AppError } from "@shared/errors/app";
import type { FolderDto, FolderReadStatusResponseDto, UpdateFolderInput } from "./types";

type DB = typeof db;
type FolderLookupDatabase = Pick<DB, "insert" | "select">;

export const DEFAULT_FOLDER_NAME = "Unsorted";
const FOLDER_BATCH_SIZE = 500;
const FOLDER_MAX_NAME_LENGTH = 512;

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

/**
 * Bulk get-or-create for folder names, bounded to at most FOLDER_BATCH_SIZE rows per
 * insert/select statement regardless of how many distinct names are requested.
 */
export async function ensureFoldersByName(
  database: FolderLookupDatabase,
  userId: string,
  names: string[],
): Promise<Map<string, string>> {
  const trimmed = [...new Set(names.map((name) => name.trim()).filter((name) => name.length > 0))];
  for (const name of trimmed) {
    if (name.length > FOLDER_MAX_NAME_LENGTH) {
      throw new AppError("Folder name exceeds maximum length", {
        status: 400,
        code: "FOLDER_NAME_TOO_LONG",
      });
    }
  }
  if (trimmed.length === 0) {
    return new Map();
  }

  const now = new Date();
  for (const batch of chunk(trimmed, FOLDER_BATCH_SIZE)) {
    await database
      .insert(folders)
      .values(
        batch.map((name) => ({
          id: crypto.randomUUID(),
          userId,
          name,
          createdAt: now,
          updatedAt: now,
        })),
      )
      .onConflictDoNothing();
  }

  const result = new Map<string, string>();
  for (const batch of chunk(trimmed, FOLDER_BATCH_SIZE)) {
    const rows = await database
      .select({ id: folders.id, name: folders.name })
      .from(folders)
      .where(and(eq(folders.userId, userId), inArray(folders.name, batch)));
    for (const row of rows) {
      result.set(row.name, row.id);
    }
  }

  const missing = trimmed.filter((name) => !result.has(name));
  if (missing.length > 0) {
    throw new AppError("Failed to create folder", { status: 500, code: "FOLDER_CREATE_FAILED" });
  }

  return result;
}

function mapFolder(row: typeof folders.$inferSelect): FolderDto {
  return {
    id: row.id,
    name: row.name,
    isPinned: row.isPinned,
    pinnedAt: row.pinnedAt ? row.pinnedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

async function findFolderByName(database: Pick<DB, "select">, userId: string, name: string) {
  const [folder] = await database
    .select()
    .from(folders)
    .where(and(eq(folders.userId, userId), eq(folders.name, name)))
    .limit(1);

  return folder ?? null;
}

export async function getOrCreateFolderByName(
  database: FolderLookupDatabase,
  userId: string,
  name: string,
): Promise<typeof folders.$inferSelect> {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new AppError("name is required", { status: 400, code: "FOLDER_NAME_REQUIRED" });
  }

  const now = new Date();
  // Attempt insert; if the (userId, name) unique index fires, silently skip.
  await database
    .insert(folders)
    .values({
      id: crypto.randomUUID(),
      userId,
      name: trimmed,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing();

  // Always select after the upsert — works whether we just inserted or raced with another request.
  const folder = await findFolderByName(database, userId, trimmed);
  if (!folder) {
    throw new AppError("Failed to create folder", { status: 500, code: "FOLDER_CREATE_FAILED" });
  }

  return folder;
}

export async function createFolder(database: DB, userId: string, name: string): Promise<FolderDto> {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new AppError("name is required", { status: 400, code: "FOLDER_NAME_REQUIRED" });
  }

  const now = new Date();
  const [folder] = await database
    .insert(folders)
    .values({
      id: crypto.randomUUID(),
      userId,
      name: trimmed,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing()
    .returning();

  if (!folder) {
    throw new AppError("Folder already exists", { status: 409, code: "FOLDER_DUPLICATE" });
  }

  return mapFolder(folder);
}

export async function listFolders(database: DB, userId: string): Promise<FolderDto[]> {
  const rows = await database
    .select()
    .from(folders)
    .where(eq(folders.userId, userId))
    .orderBy(
      sql`CASE WHEN ${folders.name} = ${DEFAULT_FOLDER_NAME} THEN 0 ELSE 1 END`,
      folders.name,
    );

  return rows.map(mapFolder);
}

export async function updateFolder(
  database: DB,
  userId: string,
  folderId: string,
  patch: UpdateFolderInput,
): Promise<FolderDto> {
  if (!("name" in patch) && !("isPinned" in patch)) {
    throw new AppError("No updatable fields provided", { status: 400, code: "EMPTY_UPDATE" });
  }

  const now = new Date();
  const updatePatch: Partial<{
    name: string;
    isPinned: boolean;
    pinnedAt: Date | null;
    updatedAt: Date;
  }> = { updatedAt: now };

  if ("name" in patch) {
    const trimmed = patch.name?.trim();
    if (!trimmed) {
      throw new AppError("name is required", { status: 400, code: "FOLDER_NAME_REQUIRED" });
    }
    updatePatch.name = trimmed;
  }

  if ("isPinned" in patch && typeof patch.isPinned === "boolean") {
    updatePatch.isPinned = patch.isPinned;
    updatePatch.pinnedAt = patch.isPinned ? now : null;
  }

  const updated = await database
    .update(folders)
    .set(updatePatch)
    .where(and(eq(folders.id, folderId), eq(folders.userId, userId)))
    .returning();

  const row = updated[0];
  if (!row) {
    throw new AppError("Folder not found", { status: 404, code: "FOLDER_NOT_FOUND" });
  }
  return mapFolder(row);
}

export async function deleteFolder(database: DB, userId: string, folderId: string): Promise<void> {
  const existing = await database
    .select({ id: folders.id, name: folders.name })
    .from(folders)
    .where(and(eq(folders.id, folderId), eq(folders.userId, userId)))
    .limit(1);
  const folder = existing[0];
  if (!folder) {
    throw new AppError("Folder not found", { status: 404, code: "FOLDER_NOT_FOUND" });
  }
  if (folder.name === DEFAULT_FOLDER_NAME) {
    throw new AppError("Default folder cannot be deleted", {
      status: 400,
      code: "DEFAULT_FOLDER_DELETE_FORBIDDEN",
    });
  }

  const fallbackFolder = await getOrCreateFolderByName(database, userId, DEFAULT_FOLDER_NAME);
  await database
    .update(feedSubscriptions)
    .set({ folderId: fallbackFolder.id, updatedAt: new Date() })
    .where(and(eq(feedSubscriptions.userId, userId), eq(feedSubscriptions.folderId, folderId)));
  await database.delete(folders).where(and(eq(folders.id, folderId), eq(folders.userId, userId)));
}

export async function markFolderReadStatus(
  database: DB,
  userId: string,
  folderId: string,
): Promise<FolderReadStatusResponseDto> {
  const existing = await database
    .select({ id: folders.id })
    .from(folders)
    .where(and(eq(folders.id, folderId), eq(folders.userId, userId)))
    .limit(1);
  if (!existing[0]) {
    throw new AppError("Folder not found", { status: 404, code: "FOLDER_NOT_FOUND" });
  }

  const now = new Date();
  const updated = await database
    .update(feedSubscriptions)
    .set({ lastReadCutoff: now })
    .where(and(eq(feedSubscriptions.userId, userId), eq(feedSubscriptions.folderId, folderId)))
    .returning({ id: feedSubscriptions.id });

  return {
    message: "All articles in folder marked as read",
    folderId,
    updatedSubscriptions: updated.length,
  };
}
