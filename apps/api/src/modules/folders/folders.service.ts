import type { db } from "@adapters/db/client";
import { feedSubscriptions, folders } from "@cronos/db";
import { and, eq } from "drizzle-orm";
import { AppError } from "@shared/errors/app-error";
import type { FolderDto, FolderReadStatusResponseDto } from "./folders.types";

type DB = typeof db;
type FolderLookupDatabase = Pick<DB, "insert" | "select">;

export const DEFAULT_FOLDER_NAME = "Unsorted";

function mapFolder(row: typeof folders.$inferSelect): FolderDto {
  return {
    id: row.id,
    name: row.name,
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

  const existing = await findFolderByName(database, userId, trimmed);
  if (existing) {
    throw new AppError("Folder already exists", { status: 409, code: "FOLDER_DUPLICATE" });
  }

  const folder = await getOrCreateFolderByName(database, userId, trimmed);
  return mapFolder(folder);
}

export async function listFolders(database: DB, userId: string): Promise<FolderDto[]> {
  const rows = await database
    .select()
    .from(folders)
    .where(eq(folders.userId, userId))
    .orderBy(folders.name);

  return rows
    .sort((left, right) => {
      if (left.name === DEFAULT_FOLDER_NAME) {
        return -1;
      }
      if (right.name === DEFAULT_FOLDER_NAME) {
        return 1;
      }
      return left.name.localeCompare(right.name);
    })
    .map(mapFolder);
}

export async function updateFolder(
  database: DB,
  userId: string,
  folderId: string,
  name: string,
): Promise<FolderDto> {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new AppError("name is required", { status: 400, code: "FOLDER_NAME_REQUIRED" });
  }
  const now = new Date();
  const updated = await database
    .update(folders)
    .set({ name: trimmed, updatedAt: now })
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
    .select({ id: folders.id })
    .from(folders)
    .where(and(eq(folders.id, folderId), eq(folders.userId, userId)))
    .limit(1);
  if (!existing[0]) {
    throw new AppError("Folder not found", { status: 404, code: "FOLDER_NOT_FOUND" });
  }

  // Keep parity with Python behavior where deleting a folder deletes attached subscriptions.
  await database
    .delete(feedSubscriptions)
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
