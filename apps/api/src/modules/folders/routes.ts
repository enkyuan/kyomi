import type { Elysia } from "elysia";
import { t } from "elysia";
import { v1HandlerContext } from "@shared/http/v1-handler-context";
import { uuidParam } from "@shared/http/v1-stub";
import {
  createFolder,
  deleteFolder,
  listFolders,
  markFolderReadStatus,
  updateFolder,
} from "./service";

const folderResponse = t.Object({
  id: t.String(),
  name: t.String(),
  createdAt: t.String(),
});

const folderReadStatusResponse = t.Object({
  message: t.String(),
  folderId: t.String(),
  updatedSubscriptions: t.Number(),
});

export function registerFolderRoutes(app: Elysia) {
  return app
    .post(
      "/folders",
      async (context) => {
        const { body, db, logger, set, userId } = v1HandlerContext<{ name: string }>(context);
        const created = await createFolder(db, userId, body.name);
        logger.info("folders.created", { userId, folderId: created.id });
        set.status = 201;
        return created;
      },
      {
        body: t.Object({ name: t.String({ minLength: 1 }) }),
        response: { 201: folderResponse },
      },
    )
    .get(
      "/folders",
      async (context) => {
        const { db, userId } = v1HandlerContext(context);
        return await listFolders(db, userId);
      },
      {
        response: { 200: t.Array(folderResponse) },
      },
    )
    .put(
      "/folders/:folderId",
      async (context) => {
        const { body, db, logger, params, userId } = v1HandlerContext<
          { name: string },
          Record<string, unknown>,
          { folderId: string }
        >(context);
        const updated = await updateFolder(db, userId, params.folderId, body.name);
        logger.info("folders.updated", { userId, folderId: params.folderId });
        return updated;
      },
      {
        params: t.Object({ folderId: uuidParam }),
        body: t.Object({ name: t.String({ minLength: 1 }) }),
        response: { 200: folderResponse },
      },
    )
    .delete(
      "/folders/:folderId",
      async (context) => {
        const { db, logger, params, userId, set } = v1HandlerContext(context);
        await deleteFolder(db, userId, params.folderId);
        logger.info("folders.deleted", { userId, folderId: params.folderId });
        set.status = 204;
        return;
      },
      {
        params: t.Object({ folderId: uuidParam }),
        response: { 204: t.Void() },
      },
    )
    .put(
      "/folders/:folderId/read-status",
      async (context) => {
        const { db, logger, params, userId } = v1HandlerContext(context);
        const result = await markFolderReadStatus(db, userId, params.folderId);
        logger.info("folders.read_status.mark_all", { userId, folderId: params.folderId });
        return result;
      },
      {
        params: t.Object({ folderId: uuidParam }),
        response: { 200: folderReadStatusResponse },
      },
    );
}
