import { t, type Elysia } from "elysia";
import type { Effect, ManagedRuntime } from "effect";
import { enforceRateLimitForContext } from "@adapters/rate-limit/plugin";
import type { CurrentUser, RequestContext } from "@shared/effect/request";
import { runEffect } from "@shared/http/effect/bridge";
import { taskIdParam } from "@shared/http/v1/params";
import {
  cancelImport,
  exportOpml,
  getImportStatus,
  importOpmlFromJson,
  importOpmlFromRaw,
  importOpmlFromUrl,
  listActiveImports,
  listImportFailures,
  listImports,
  removeImport,
  type OpmlRouteServices,
} from "./operations";
import {
  cancelResponse,
  messageResponse,
  opmlActiveResponse,
  opmlExportResponse,
  opmlFailurePageResponse,
  opmlImportAccepted,
  opmlImportPageResponse,
  opmlTaskStatus,
} from "./schemas";

const opmlImportRateLimit = {
  name: "opml.import",
  max: 5,
  windowMs: 15 * 60_000,
} as const;

const pageQuery = t.Object({
  cursor: t.Optional(t.String()),
  limit: t.Optional(t.String()),
});

const taskParams = t.Object({ taskId: taskIdParam });

/** What `resolveSessionContext` adds to every authenticated v1 handler. */
type SessionContext = { request: Request; requestId: string; userId: string };

function sessionContext(context: unknown): SessionContext {
  const { request, requestId, userId } = context as Partial<SessionContext>;
  if (!request || !requestId || !userId) {
    throw new Error("OPML routes require an authenticated session context");
  }
  return { request, requestId, userId };
}

export function registerOpmlRoutes(
  app: Elysia,
  runtime: ManagedRuntime.ManagedRuntime<OpmlRouteServices, unknown>,
) {
  const run = <A, E>(
    context: unknown,
    effect: Effect.Effect<A, E, OpmlRouteServices | RequestContext | CurrentUser>,
  ) => runEffect({ runtime, ...sessionContext(context) }, effect);

  return app
    .post(
      "/opml/imports",
      async (context) => {
        await enforceRateLimitForContext(
          context,
          sessionContext(context).userId,
          opmlImportRateLimit,
        );
        const accepted = await run(context, importOpmlFromJson(context.body));
        context.set.status = 202;
        return accepted;
      },
      {
        body: t.Object({
          xml: t.String({ minLength: 1 }),
          filename: t.Optional(t.String()),
        }),
        response: {
          202: opmlImportAccepted,
        },
      },
    )
    .post(
      "/opml/imports/raw",
      async (context) => {
        await enforceRateLimitForContext(
          context,
          sessionContext(context).userId,
          opmlImportRateLimit,
        );
        const filename = context.request.headers.get("x-opml-filename") ?? undefined;
        const accepted = await run(context, importOpmlFromRaw(context.body as string, filename));
        context.set.status = 202;
        return accepted;
      },
      {
        parse: "text",
        type: "application/xml",
        response: {
          202: opmlImportAccepted,
        },
      },
    )
    .post(
      "/opml/imports/from-url",
      async (context) => {
        await enforceRateLimitForContext(
          context,
          sessionContext(context).userId,
          opmlImportRateLimit,
        );
        const accepted = await run(context, importOpmlFromUrl(context.body));
        context.set.status = 202;
        return accepted;
      },
      {
        body: t.Object({
          url: t.String({ minLength: 1 }),
          filename: t.Optional(t.String()),
        }),
        response: {
          202: opmlImportAccepted,
        },
      },
    )
    .get(
      "/opml/export",
      async (context) =>
        new Response(await run(context, exportOpml), {
          status: 200,
          headers: {
            "content-type": "application/xml; charset=utf-8",
            "content-disposition": 'attachment; filename="kyomi-subscriptions.opml"',
          },
        }),
      {
        response: {
          200: opmlExportResponse,
        },
      },
    )
    .get("/opml/imports", (context) => run(context, listImports(context.query)), {
      query: pageQuery,
      response: {
        200: opmlImportPageResponse,
      },
    })
    .get("/opml/imports/active", (context) => run(context, listActiveImports), {
      response: {
        200: opmlActiveResponse,
      },
    })
    .get(
      "/opml/imports/:taskId/status",
      (context) => run(context, getImportStatus(context.params.taskId)),
      {
        params: taskParams,
        response: {
          200: opmlTaskStatus,
        },
      },
    )
    .get(
      "/opml/imports/:taskId/failures",
      (context) => run(context, listImportFailures(context.params.taskId, context.query)),
      {
        params: taskParams,
        query: pageQuery,
        response: {
          200: opmlFailurePageResponse,
        },
      },
    )
    .delete(
      "/opml/imports/:taskId/cancel",
      (context) => run(context, cancelImport(context.params.taskId)),
      {
        params: taskParams,
        response: {
          200: cancelResponse,
        },
      },
    )
    .delete(
      "/opml/imports/:taskId",
      (context) => run(context, removeImport(context.params.taskId)),
      {
        params: taskParams,
        response: {
          200: messageResponse,
        },
      },
    );
}
