import { describe, expect, test } from "bun:test";
import { registerArticleProgressRoutes } from "@modules/articles/progress/routes";
import {
  readingProgressResponseSchema,
  readingProgressUpdateBodySchema,
  SESSION_ACTIVE_MS_MAX,
} from "@modules/articles/progress/schemas";
import { AppError } from "@shared/errors/app";
import { atMs, createProgressDb, feedItemRow } from "./fakes";

const FEED_ITEM_ID = "00000000-0000-4000-8000-000000000001";

type RecordedRoute = { method: string; path: string; handler: unknown; options: unknown };

function recordRoutes() {
  const routes: RecordedRoute[] = [];
  const app = {
    put(path: string, handler: unknown, options?: unknown) {
      routes.push({ method: "put", path, handler, options });
      return app;
    },
  };
  registerArticleProgressRoutes(app as never);
  return routes;
}

function requestBody() {
  return {
    progress: 0.4,
    anchor: null,
    contentKey: "feed_html:v1",
    sessionId: "11111111-1111-4111-8111-111111111111",
    sessionActiveMs: 12_000,
    completed: false,
    clientUpdatedAt: new Date().toISOString(),
  };
}

function context(overrides: Record<string, unknown> = {}) {
  const rateLimits: Array<{ subject: string; rule: { name: string; max: number } }> = [];
  const logger = { info() {}, warn() {}, error() {}, debug() {} };
  return {
    rateLimits,
    context: {
      logger,
      userId: "user-1",
      db: createProgressDb({ feedItems: [feedItemRow()] }),
      set: {},
      params: { articleId: FEED_ITEM_ID },
      query: {},
      body: requestBody(),
      enforceRateLimit: async (subject: string, rule: { name: string; max: number }) => {
        rateLimits.push({ subject, rule });
      },
      ...overrides,
    },
  };
}

describe("PUT /articles/:articleId/progress", () => {
  test("registers one route with params, body and response schemas", () => {
    const routes = recordRoutes();

    expect(routes.map((route) => `${route.method} ${route.path}`)).toEqual([
      "put /articles/:articleId/progress",
    ]);
    const options = routes[0]!.options as Record<string, unknown>;
    expect(options.params).toBeDefined();
    expect(options.body).toBe(readingProgressUpdateBodySchema);
    expect((options.response as Record<number, unknown>)[200]).toBe(readingProgressResponseSchema);
  });

  test("the body schema bounds every client-controlled field", () => {
    const { properties } = readingProgressUpdateBodySchema;

    expect(properties.progress).toMatchObject({ minimum: 0, maximum: 1 });
    expect(properties.contentKey).toMatchObject({ minLength: 1, maxLength: 128 });
    expect(properties.sessionId).toMatchObject({ format: "uuid" });
    expect(properties.sessionActiveMs).toMatchObject({
      minimum: 0,
      maximum: SESSION_ACTIVE_MS_MAX,
    });
    expect(properties.clientUpdatedAt).toMatchObject({ format: "date-time" });
    const anchor = properties.anchor.anyOf.find((member) => member.type === "object") as {
      properties: Record<string, unknown>;
    };
    expect(anchor.properties.blockIndex).toMatchObject({ minimum: 0, maximum: 10_000 });
    expect(anchor.properties.offset).toMatchObject({ minimum: 0, maximum: 1 });
    expect(anchor.properties.fingerprint).toMatchObject({ maxLength: 32 });
  });

  test("writes the progress and wraps the state in readingProgress", async () => {
    const handler = recordRoutes()[0]!.handler as (ctx: unknown) => Promise<unknown>;
    const { context: ctx, rateLimits } = context();

    const result = (await handler(ctx)) as { readingProgress: Record<string, unknown> };

    expect(result.readingProgress).toMatchObject({ progress: 0.4, state: "reading" });
    expect((ctx.db as ReturnType<typeof createProgressDb>).inserts).toHaveLength(1);
    expect(rateLimits).toEqual([
      { subject: "user-1", rule: expect.objectContaining({ name: "articles.progress.write" }) },
    ]);
  });

  test("a rate-limited caller is rejected before anything is written", async () => {
    const handler = recordRoutes()[0]!.handler as (ctx: unknown) => Promise<unknown>;
    const { context: ctx } = context({
      enforceRateLimit: async () => {
        throw new AppError("Too many requests", { status: 429, code: "RATE_LIMITED" });
      },
    });

    await expect(handler(ctx)).rejects.toMatchObject({ status: 429 });
    expect((ctx.db as ReturnType<typeof createProgressDb>).inserts).toHaveLength(0);
  });

  test("writes only for the authenticated user", async () => {
    const handler = recordRoutes()[0]!.handler as (ctx: unknown) => Promise<unknown>;
    const { context: ctx } = context({
      userId: "user-9",
      body: { ...requestBody(), clientUpdatedAt: atMs(0).toISOString() },
    });

    await handler(ctx);

    expect((ctx.db as ReturnType<typeof createProgressDb>).inserts[0]).toMatchObject({
      userId: "user-9",
    });
  });
});
