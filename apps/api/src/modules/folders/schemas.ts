import { t } from "elysia";
import { uuidParam } from "@shared/http/v1/stub";

export const folderResponse = t.Object({
  id: t.String(),
  name: t.String(),
  isPinned: t.Boolean(),
  pinnedAt: t.Union([t.String(), t.Null()]),
  createdAt: t.String(),
});

export const folderReadStatusResponse = t.Object({
  message: t.String(),
  folderId: t.String(),
  updatedSubscriptions: t.Number(),
});

export const folderIdParams = t.Object({ folderId: uuidParam });

export const createFolderBody = t.Object({ name: t.String({ minLength: 1 }) });

export const updateFolderBody = t.Object({
  name: t.Optional(t.String({ minLength: 1 })),
  isPinned: t.Optional(t.Boolean()),
});
