import { afterEach, describe, expect, test } from "bun:test";
import { Layer, ManagedRuntime } from "effect";
import { registerArticleProgressRoutes } from "@modules/articles/progress/routes";
import {
  readingProgressResponseSchema,
  readingProgressUpdateBodySchema,
  SESSION_ACTIVE_MS_MAX,
} from "@modules/articles/progress/schemas";
import { RateLimited } from "@shared/effect/errors";
import { Elysia, registerTestErrorHandlers } from "@api-tests/support/elysia";
import { fakeDb, silentLogger, testConfig } from "@api-tests/support/layers";
import { atMs, createProgressDb, FEED_ITEM_ID, feedItemRow } from "./fakes";

const runtimes: Array<{ dispose: () => Promise<void> }> = [];

afterEach(async () => {
  await Promise.all(runtimes.splice(0).map((runtime) => runtime.dispose()));
});

type RateLimitCall = { subject: string; rule: { name: string; max: number } };

/**
 * The progress route on a real Elysia app. The session context (`userId`, `requestId`) and the
 * rate limiter are what `resolveSessionContext` and `rateLimitPlugin` put on the context.
 */
function appWith(
  options: {
    userId?: string;
    db?: ReturnType<typeof createProgressDb>;
    enforceRateLimit?: (subject: string, rule: RateLimitCall["rule"]) => Promise<void>;
  } = {},
) {
  const db = options.db ?? createProgressDb({ feedItems: [feedItemRow()] });
  const rateLimits: RateLimitCall[] = [];
  const runtime = ManagedRuntime.make(
    Layer.mergeAll(fakeDb(db as never), silentLogger, testConfig()),
  );
  runtimes.push(runtime);
  const app = new Elysia()
    .decorate("enforceRateLimit", async (subject: string, rule: RateLimitCall["rule"]) => {
      rateLimits.push({ subject, rule });
      await options.enforceRateLimit?.(subject, rule);
    })
    .derive(() => ({ userId: options.userId ?? "user-1", requestId: "req-1" }));
  registerTestErrorHandlers(app);
  registerArticleProgressRoutes(app as never, runtime);
  return { app, db, rateLimits };
}

function requestBody(overrides: Record<string, unknown> = {}) {
  return {
    progress: 0.4,
    anchor: null,
    contentKey: "feed_html:v1",
    sessionId: "11111111-1111-4111-8111-111111111111",
    sessionActiveMs: 12_000,
    completed: false,
    clientUpdatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function put(app: ReturnType<typeof appWith>["app"], body: unknown, articleId = FEED_ITEM_ID) {
  return app.handle(
    new Request(`http://localhost/articles/${articleId}/progress`, {
      method: "PUT",
      headers: { "content-type": "application/json", "x-request-id": "req-1" },
      body: JSON.stringify(body),
    }),
  );
}

describe("PUT /articles/:articleId/progress", () => {
  test("registers one route with params, body and response schemas", () => {
    const { app } = appWith();

    expect(app.routes.map((route) => `${route.method} ${route.path}`)).toEqual([
      "PUT /articles/:articleId/progress",
    ]);
    const hook = app.routes[0]!.hooks as Record<string, unknown>;
    expect(hook.params).toBeDefined();
    expect(readingProgressUpdateBodySchema).toBeDefined();
    expect(readingProgressResponseSchema).toBeDefined();
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
    const { app, db, rateLimits } = appWith();

    const response = await put(app, requestBody());

    expect(response.status).toBe(200);
    const json = (await response.json()) as { readingProgress: Record<string, unknown> };
    expect(json.readingProgress).toMatchObject({ progress: 0.4, state: "reading" });
    expect(db.inserts).toHaveLength(1);
    expect(rateLimits).toEqual([
      { subject: "user-1", rule: expect.objectContaining({ name: "articles.progress.write" }) },
    ]);
  });

  test("a rate-limited caller is rejected before anything is written", async () => {
    const { app, db } = appWith({
      enforceRateLimit: async () => {
        throw new RateLimited({ message: "Too many requests", code: "RATE_LIMITED" });
      },
    });

    const response = await put(app, requestBody());

    expect(response.status).toBe(429);
    expect(await response.json()).toMatchObject({ error: { code: "RATE_LIMITED" } });
    expect(db.inserts).toHaveLength(0);
  });

  test("writes only for the authenticated user", async () => {
    const { app, db } = appWith({
      userId: "user-9",
      db: createProgressDb({ feedItems: [feedItemRow()] }),
    });

    await put(app, requestBody({ clientUpdatedAt: atMs(0).toISOString() }));

    expect(db.inserts[0]).toMatchObject({ userId: "user-9" });
  });

  test("an invalid body is rejected as a validation error before any work", async () => {
    const { app, db, rateLimits } = appWith();

    const response = await put(app, requestBody({ progress: 2 }));

    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ error: { code: "VALIDATION_ERROR" } });
    expect(db.inserts).toHaveLength(0);
    expect(rateLimits).toHaveLength(0);
  });

  test("an article the user cannot see renders the standard 404 envelope", async () => {
    const { app } = appWith({ db: createProgressDb() });

    const response = await put(app, requestBody());

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: {
        message: "Article not found",
        code: "ARTICLE_NOT_FOUND",
        requestId: "req-1",
      },
    });
  });
});
