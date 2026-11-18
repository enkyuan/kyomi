import type { Elysia } from "elysia";
import { t } from "elysia";
import type { ManagedRuntime } from "effect";
import type { Db } from "@adapters/db/service";
import type { AppLogger } from "@adapters/logger/service";
import { runEffect } from "@shared/http/effect/bridge";
import { v1EffectContext } from "@shared/http/v1/context";
import {
  createFolder,
  deleteFolder,
  listFolders,
  markFolderReadStatus,
  reorderFolders,
  updateFolder,
} from "./operations";
import type { UpdateFolderInput } from "./types";
import {
  createFolderBody,
  folderIdParams,
  folderReadStatusResponse,
  folderResponse,
  reorderFoldersBody,
  updateFolderBody,
} from "./schemas";

type FolderRuntime = ManagedRuntime.ManagedRuntime<Db | AppLogger, unknown>;

export function registerFolderRoutes(app: Elysia, runtime: FolderRuntime) {
  return app
    .post(
      "/folders",
      async (context) => {
        const { body, request, requestId, set, userId } = v1EffectContext<{ name: string }>(
          context,
        );
        const created = await runEffect(
          { runtime, request, requestId, userId },
          createFolder(body.name),
        );
        set.status = 201;
        return created;
      },
      {
        body: createFolderBody,
        response: { 201: folderResponse },
      },
    )
    .get(
      "/folders",
      (context) => {
        const { request, requestId, userId } = v1EffectContext(context);
        return runEffect({ runtime, request, requestId, userId }, listFolders);
      },
      {
        response: { 200: t.Array(folderResponse) },
      },
    )
    .put(
      "/folders/order",
      (context) => {
        const { body, request, requestId, userId } = v1EffectContext<{ folderIds: string[] }>(
          context,
        );
        return runEffect({ runtime, request, requestId, userId }, reorderFolders(body.folderIds));
      },
      {
        body: reorderFoldersBody,
        response: { 200: t.Array(folderResponse) },
      },
    )
    .put(
      "/folders/:folderId",
      (context) => {
        const { body, params, request, requestId, userId } = v1EffectContext<
          UpdateFolderInput,
          Record<string, unknown>,
          { folderId: string }
        >(context);
        return runEffect(
          { runtime, request, requestId, userId },
          updateFolder(params.folderId, body),
        );
      },
      {
        params: folderIdParams,
        body: updateFolderBody,
        response: { 200: folderResponse },
      },
    )
    .delete(
      "/folders/:folderId",
      async (context) => {
        const { params, request, requestId, set, userId } = v1EffectContext<
          unknown,
          Record<string, unknown>,
          { folderId: string }
        >(context);
        await runEffect({ runtime, request, requestId, userId }, deleteFolder(params.folderId));
        set.status = 204;
      },
      {
        params: folderIdParams,
        response: { 204: t.Void() },
      },
    )
    .put(
      "/folders/:folderId/read-status",
      (context) => {
        const { params, request, requestId, userId } = v1EffectContext<
          unknown,
          Record<string, unknown>,
          { folderId: string }
        >(context);
        return runEffect(
          { runtime, request, requestId, userId },
          markFolderReadStatus(params.folderId),
        );
      },
      {
        params: folderIdParams,
        response: { 200: folderReadStatusResponse },
      },
    );
}
