import { afterEach, describe, expect, mock, test } from "bun:test";
import { Layer, ManagedRuntime } from "effect";
import { registerOpmlRoutes } from "@modules/opml/routes";
import { RateLimited } from "@shared/effect/errors";
import { Elysia, registerTestErrorHandlers } from "@api-tests/support/elysia";
import {
  fakeDb as dbLayer,
  fakeHttpClient,
  fakeQueue,
  recordingLogger,
} from "@api-tests/support/layers";

/**
 * Serves the real OPML routes through Elysia over fake Db, Redis and HttpClient layers. The
 * session fields (`userId`, `requestId`) are what `resolveSessionContext` derives in production.
 */
const runtimes: Array<{ dispose: () => Promise<void> }> = [];

type AppOptions = {
  db?: Record<string, unknown>;
  redis?: Record<string, unknown>;
  http?: Parameters<typeof fakeHttpClient>[0];
  enforceRateLimit?: () => Promise<void>;
};

function appWith(options: AppOptions = {}) {
  const logs = recordingLogger();
  const runtime = ManagedRuntime.make(
    Layer.mergeAll(
      dbLayer(options.db ?? {}),
      fakeQueue(options.redis ?? {}),
      fakeHttpClient(
        options.http ??
          (() => {
            throw new Error("unexpected outbound request");
          }),
      ),
      logs.layer,
    ),
  );
  runtimes.push(runtime);
  const session = new Elysia()
    .decorate("enforceRateLimit", options.enforceRateLimit ?? (async () => undefined))
    .derive(() => ({ userId: "user-1", requestId: "req-1" }));
  // Hooks only reach routes registered after them, as in the real app's plugin order.
  registerTestErrorHandlers(session);
  const app = registerOpmlRoutes(session as never, runtime as never);
  return app as unknown as { handle: (request: Request) => Promise<Response> };
}

afterEach(async () => {
  await Promise.all(runtimes.splice(0).map((runtime) => runtime.dispose()));
});

const url = (path: string) => `http://localhost${path}`;
const json = (path: string, method: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request(url(path), {
    method,
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });

const opml = '<opml><body><outline xmlUrl="https://example.com/feed.xml"/></body></opml>';

function importRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "import-1",
    userId: "user-1",
    filename: "feeds.opml",
    sourceUrl: null,
    opmlTitle: null,
    opmlAuthor: null,
    status: "running",
    totalItems: 10,
    completedItems: 4,
    subscribedItems: 3,
    alreadySubscribedItems: 1,
    failedItems: 0,
    cancelledItems: 0,
    lastErrorMessage: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:05:00.000Z"),
    completedAt: null,
    ...overrides,
  };
}

/** Models createOpmlImport's insert chain (recording the inserted values) and the wakeup update. */
function enqueueDb(inserted: Array<Record<string, unknown>> = []) {
  return {
    insert: () => ({
      values: (values: Record<string, unknown>) => {
        inserted.push(values);
        return { returning: () => Promise.resolve([importRow({ ...values, id: "import-1" })]) };
      },
    }),
    update: () => ({ set: () => ({ where: () => Promise.resolve() }) }),
  };
}

/** A db whose selects answer with `rows` behind `.where().limit()`. */
function selectLimit(rows: unknown[]) {
  return {
    select: () => ({ from: () => ({ where: () => ({ limit: () => Promise.resolve(rows) }) }) }),
  };
}

describe("POST /opml/imports", () => {
  test("accepts a JSON import, stores it and publishes the prepare wakeup", async () => {
    const inserted: Array<Record<string, unknown>> = [];
    const xadd = mock(async () => "1-0");
    const app = appWith({ db: enqueueDb(inserted), redis: { xadd } });

    const response = await app.handle(
      json("/opml/imports", "POST", { xml: opml, filename: "feeds.opml" }),
    );

    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ taskId: "import-1" });
    expect(inserted[0]).toMatchObject({
      userId: "user-1",
      filename: "feeds.opml",
      sourceXml: opml,
    });
    expect(xadd).toHaveBeenCalledTimes(1);
  });

  test("rejects JSON imports over the 2 MiB legacy compatibility ceiling", async () => {
    const app = appWith({ db: {} });

    const response = await app.handle(
      json("/opml/imports", "POST", { xml: "x".repeat(2 * 1024 * 1024 + 1) }),
    );

    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({
      error: {
        message: "OPML payload exceeds the JSON import size limit",
        code: "OPML_LEGACY_JSON_TOO_LARGE",
        requestId: expect.any(String),
        details: { maxBytes: 2 * 1024 * 1024 },
      },
    });
  });

  test("rejects a blank document", async () => {
    const response = await appWith().handle(json("/opml/imports", "POST", { xml: "   " }));

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: { code: "OPML_XML_REQUIRED", message: "xml is required" },
    });
  });

  test("applies the import rate limit before touching the import", async () => {
    const app = appWith({
      db: {},
      enforceRateLimit: async () => {
        throw new RateLimited({
          message: "Too many requests",
          code: "RATE_LIMITED",
          details: { bucket: "opml.import", retryAfterSeconds: 30 },
        });
      },
    });

    const response = await app.handle(json("/opml/imports", "POST", { xml: opml }));

    expect(response.status).toBe(429);
    expect(await response.json()).toMatchObject({
      error: { code: "RATE_LIMITED", details: { retryAfterSeconds: 30 } },
    });
  });

  test("renders a database failure as an opaque 500", async () => {
    const app = appWith({
      db: {
        insert: () => ({ values: () => ({ returning: () => Promise.reject(new Error("down")) }) }),
      },
    });

    const response = await app.handle(json("/opml/imports", "POST", { xml: opml }));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: { message: "Internal error", code: "INTERNAL_ERROR", requestId: expect.any(String) },
    });
  });
});

describe("POST /opml/imports/raw", () => {
  test("accepts a raw XML import using the x-opml-filename header", async () => {
    const inserted: Array<Record<string, unknown>> = [];
    const app = appWith({ db: enqueueDb(inserted), redis: { xadd: async () => "1-0" } });

    const response = await app.handle(
      new Request(url("/opml/imports/raw"), {
        method: "POST",
        headers: { "content-type": "application/xml", "x-opml-filename": "my-feeds.opml" },
        body: opml,
      }),
    );

    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ taskId: "import-1" });
    expect(inserted[0]).toMatchObject({ filename: "my-feeds.opml", sourceXml: opml });
  });

  test("falls back to inline.opml without a filename header", async () => {
    const inserted: Array<Record<string, unknown>> = [];
    const app = appWith({ db: enqueueDb(inserted), redis: { xadd: async () => "1-0" } });

    await app.handle(
      new Request(url("/opml/imports/raw"), {
        method: "POST",
        headers: { "content-type": "application/xml" },
        body: opml,
      }),
    );

    expect(inserted[0]).toMatchObject({ filename: "inline.opml" });
  });

  test("rejects an unsupported file type", async () => {
    const response = await appWith().handle(
      new Request(url("/opml/imports/raw"), {
        method: "POST",
        headers: { "content-type": "application/xml", "x-opml-filename": "feeds.txt" },
        body: opml,
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: "OPML_FILE_TYPE_INVALID" } });
  });
});

describe("POST /opml/imports/from-url", () => {
  test("stores the resolved remote URL as sourceUrl", async () => {
    const inserted: Array<Record<string, unknown>> = [];
    const app = appWith({
      db: enqueueDb(inserted),
      redis: { xadd: async () => "1-0" },
      http: ({ url: requested }) => {
        if (requested === "https://93.184.216.34/start.opml") {
          return new Response(null, {
            status: 302,
            headers: { location: "https://93.184.216.34/final.opml" },
          });
        }
        return new Response(opml, { status: 200 });
      },
    });

    const response = await app.handle(
      json("/opml/imports/from-url", "POST", { url: "https://93.184.216.34/start.opml" }),
    );

    expect(response.status).toBe(202);
    expect(inserted[0]).toMatchObject({
      sourceUrl: "https://93.184.216.34/final.opml",
      filename: "final.opml",
      sourceXml: opml,
    });
  });

  test("maps a blocked URL to a 400 and never touches the database", async () => {
    const response = await appWith({ db: {} }).handle(
      json("/opml/imports/from-url", "POST", { url: "http://127.0.0.1/feeds.opml" }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: "OPML_URL_BLOCKED" } });
  });

  test("maps an unreachable upstream to a 502", async () => {
    const response = await appWith({
      http: () => new Response("nope", { status: 500 }),
    }).handle(json("/opml/imports/from-url", "POST", { url: "https://93.184.216.34/f.opml" }));

    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({
      error: { code: "OPML_URL_HTTP_ERROR", details: { status: 500 } },
    });
  });
});

describe("GET /opml/export", () => {
  test("serves the user's subscriptions as an OPML attachment", async () => {
    const app = appWith({
      db: {
        select: () => ({
          from: () => ({
            innerJoin: () => ({
              leftJoin: () => ({
                where: () =>
                  Promise.resolve([
                    {
                      customTitle: null,
                      feedTitle: "Route Feed",
                      xmlUrl: "https://example.com/route.xml",
                      htmlUrl: null,
                      folderName: null,
                    },
                  ]),
              }),
            }),
          }),
        }),
      },
    });

    const response = await app.handle(new Request(url("/opml/export")));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/xml; charset=utf-8");
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="kyomi-subscriptions.opml"',
    );
    expect(await response.text()).toContain("https://example.com/route.xml");
  });
});

describe("GET /opml/imports", () => {
  test("maps internal state to the stage/status page contract", async () => {
    const limit = () => Promise.resolve([importRow()]);
    const app = appWith({
      db: { select: () => ({ from: () => ({ where: () => ({ orderBy: () => ({ limit }) }) }) }) },
    });

    const response = await app.handle(new Request(url("/opml/imports")));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      items: [
        {
          taskId: "import-1",
          filename: "feeds.opml",
          sourceUrl: null,
          stage: "processing",
          status: "in_progress",
          summary: { totalUrls: 10, completed: 4, subscribed: 3, alreadySubscribed: 1, failed: 0 },
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:05:00.000Z",
          completedAt: null,
          message: null,
        },
      ],
      nextCursor: null,
      hasMore: false,
    });
  });

  test("rejects a malformed cursor", async () => {
    const response = await appWith().handle(new Request(url("/opml/imports?cursor=garbage")));

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: { code: "OPML_IMPORT_CURSOR_INVALID" },
    });
  });
});

describe("GET /opml/imports/active", () => {
  test("lists the in-flight import with its counters", async () => {
    const app = appWith({ db: selectLimit([importRow()]) });

    const response = await app.handle(new Request(url("/opml/imports/active")));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      items: [
        {
          taskId: "import-1",
          status: "in_progress",
          summary: { totalUrls: 10, subscribed: 3, alreadySubscribed: 1 },
        },
      ],
    });
  });
});

describe("GET /opml/imports/:taskId/status", () => {
  test("reads counters from the durable store without a failures fan-out", async () => {
    const app = appWith({ db: selectLimit([importRow({ opmlTitle: "My Feeds" })]) });

    const response = await app.handle(new Request(url("/opml/imports/import-1/status")));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      taskId: "import-1",
      status: "in_progress",
      opmlTitle: "My Feeds",
      summary: {
        totalUrls: 10,
        completed: 4,
        subscribed: 3,
        alreadySubscribed: 1,
        failed: 0,
        cancelled: 0,
        failures: [],
      },
    });
  });

  test("includes the first failures when items failed", async () => {
    let selects = 0;
    const app = appWith({
      db: {
        select: () => ({
          from: () => ({
            where: () => {
              selects += 1;
              if (selects <= 2) {
                // the import itself, then the failure page's ownership check
                return { limit: () => Promise.resolve([importRow({ failedItems: 1 })]) };
              }
              return {
                orderBy: () => ({
                  limit: () =>
                    Promise.resolve([
                      {
                        id: "item-1",
                        url: "https://example.com/feed.xml",
                        code: "FEED_FETCH_FAILED",
                        message: "timeout",
                        position: 0,
                      },
                    ]),
                }),
              };
            },
          }),
        }),
      },
    });

    const response = await app.handle(new Request(url("/opml/imports/import-1/status")));

    expect(await response.json()).toMatchObject({
      summary: {
        failed: 1,
        failures: [
          { url: "https://example.com/feed.xml", code: "FEED_FETCH_FAILED", message: "timeout" },
        ],
      },
    });
  });

  test("answers 404 when the import does not belong to the requesting user", async () => {
    const app = appWith({ db: selectLimit([]) });

    const response = await app.handle(new Request(url("/opml/imports/import-1/status")));

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: {
        message: "Import task not found",
        code: "OPML_TASK_NOT_FOUND",
        requestId: expect.any(String),
      },
    });
  });
});

describe("GET /opml/imports/:taskId/failures", () => {
  test("returns the keyset page directly", async () => {
    let selects = 0;
    const app = appWith({
      db: {
        select: () => ({
          from: () => ({
            where: () => {
              selects += 1;
              if (selects === 1) {
                return { limit: () => Promise.resolve([{ id: "import-1" }]) };
              }
              return {
                orderBy: () => ({
                  limit: () =>
                    Promise.resolve([
                      {
                        id: "item-1",
                        url: "https://example.com/feed.xml",
                        code: "FEED_FETCH_FAILED",
                        message: "timeout",
                        position: 0,
                      },
                    ]),
                }),
              };
            },
          }),
        }),
      },
    });

    const response = await app.handle(new Request(url("/opml/imports/import-1/failures")));

    expect(await response.json()).toEqual({
      items: [
        {
          id: "item-1",
          url: "https://example.com/feed.xml",
          code: "FEED_FETCH_FAILED",
          message: "timeout",
          position: 0,
        },
      ],
      nextCursor: null,
      hasMore: false,
    });
  });
});

describe("DELETE /opml/imports/:taskId/cancel", () => {
  test("drains pending items in bounded batches after a successful cancellation", async () => {
    const row = importRow();
    let batches = 0;
    const batchCounts = [2, 0];
    const app = appWith({
      db: {
        ...selectLimit([row]),
        update: () => ({
          set: () => ({
            where: () => ({ returning: () => Promise.resolve([{ ...row, status: "cancelling" }]) }),
          }),
        }),
        transaction: async (callback: (tx: unknown) => unknown) => {
          const count = batchCounts[batches] ?? 0;
          batches += 1;
          return callback({
            execute: () =>
              Promise.resolve(Array.from({ length: count }, (_, i) => ({ id: `x${i}` }))),
            update: () => ({ set: () => ({ where: () => Promise.resolve() }) }),
            select: () => ({
              from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }),
            }),
          });
        },
      },
    });

    const response = await app.handle(
      new Request(url("/opml/imports/import-1/cancel"), { method: "DELETE" }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      taskId: "import-1",
      cancelled: true,
      message: "Import cancelled",
    });
    expect(batches).toBe(2);
  });

  test("answers 404 for an import owned by someone else", async () => {
    let selects = 0;
    const app = appWith({
      db: {
        select: () => ({
          from: () => ({
            where: () => ({
              limit: () => {
                selects += 1;
                // not found for this user, then the owner lookup finds another user
                return Promise.resolve(selects === 1 ? [] : [{ userId: "user-2" }]);
              },
            }),
          }),
        }),
      },
    });

    const response = await app.handle(
      new Request(url("/opml/imports/import-9/cancel"), { method: "DELETE" }),
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: { code: "OPML_TASK_NOT_FOUND" } });
  });
});

describe("DELETE /opml/imports/:taskId", () => {
  const deleting = (removed: unknown[]) => ({
    delete: () => ({ where: () => ({ returning: () => Promise.resolve(removed) }) }),
  });

  test("removes a finished import", async () => {
    const app = appWith({ db: deleting([{ id: "import-1" }]) });

    const response = await app.handle(
      new Request(url("/opml/imports/import-1"), { method: "DELETE" }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ message: "Import task removed" });
  });

  test("answers 409 while the import is still active", async () => {
    const app = appWith({ db: { ...deleting([]), ...selectLimit([importRow()]) } });

    const response = await app.handle(
      new Request(url("/opml/imports/import-1"), { method: "DELETE" }),
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: { code: "OPML_TASK_ACTIVE" } });
  });

  test("answers 404 when there is no such import", async () => {
    const app = appWith({ db: { ...deleting([]), ...selectLimit([]) } });

    const response = await app.handle(
      new Request(url("/opml/imports/import-1"), { method: "DELETE" }),
    );

    expect(response.status).toBe(404);
  });
});
