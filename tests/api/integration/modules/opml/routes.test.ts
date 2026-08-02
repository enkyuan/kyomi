import { describe, expect, mock, test } from "bun:test";

const enqueueOpmlImportMock = mock(async () => ({ taskId: "import-1" }));
mock.module("@modules/opml/jobs", () => ({
  enqueueOpmlImport: enqueueOpmlImportMock,
}));

const { registerOpmlRoutes } = await import("@modules/opml/routes");

function fakeHandlerContext(overrides: Record<string, unknown> = {}) {
  return {
    db: {},
    userId: "user-1",
    logger: { info() {}, warn() {}, error() {} },
    set: {},
    params: {},
    query: {},
    body: {},
    headers: {},
    enforceRateLimit: async () => undefined,
    ...overrides,
  };
}

type RecordedRoute = {
  method: "get" | "post" | "delete";
  path: string;
  handler: unknown;
  options: unknown;
};

function createRouteRecorder() {
  const routes: RecordedRoute[] = [];
  const app = {
    get(path: string, handler: unknown, options?: unknown) {
      routes.push({ method: "get", path, handler, options });
      return app;
    },
    post(path: string, handler: unknown, options?: unknown) {
      routes.push({ method: "post", path, handler, options });
      return app;
    },
    delete(path: string, handler: unknown, options?: unknown) {
      routes.push({ method: "delete", path, handler, options });
      return app;
    },
  };
  return { app, routes };
}

describe("opml.routes", () => {
  test("registers import/export/task endpoints with expected methods", () => {
    const { app, routes } = createRouteRecorder();
    const returned = registerOpmlRoutes(app as never);

    expect(returned as unknown).toBe(app);
    expect(routes.map((route) => `${route.method} ${route.path}`)).toEqual([
      "post /opml/imports",
      "post /opml/imports/raw",
      "post /opml/imports/from-url",
      "get /opml/export",
      "get /opml/imports",
      "get /opml/imports/active",
      "get /opml/imports/:taskId/status",
      "get /opml/imports/:taskId/failures",
      "delete /opml/imports/:taskId/cancel",
      "delete /opml/imports/:taskId",
    ]);

    for (const route of routes) {
      expect(typeof route.handler).toBe("function");
    }
  });

  test("exposes request/response schemas for import/export/history endpoints", () => {
    const { app, routes } = createRouteRecorder();
    registerOpmlRoutes(app as never);

    const importRoute = routes.find((r) => r.method === "post" && r.path === "/opml/imports");
    const importRawRoute = routes.find(
      (r) => r.method === "post" && r.path === "/opml/imports/raw",
    );
    const importFromUrlRoute = routes.find(
      (r) => r.method === "post" && r.path === "/opml/imports/from-url",
    );
    const exportRoute = routes.find((r) => r.method === "get" && r.path === "/opml/export");
    const historyRoute = routes.find((r) => r.method === "get" && r.path === "/opml/imports");
    const activeRoute = routes.find((r) => r.path === "/opml/imports/active");

    expect(importRoute).toBeDefined();
    expect(importRawRoute).toBeDefined();
    expect(importFromUrlRoute).toBeDefined();
    expect(exportRoute).toBeDefined();
    expect(historyRoute).toBeDefined();
    expect(activeRoute).toBeDefined();

    expect((importRoute?.options as Record<string, unknown>).body).toBeDefined();
    expect((importRoute?.options as Record<string, unknown>).response).toBeDefined();
    expect((importRawRoute?.options as Record<string, unknown>).parse).toBe("text");
    expect((importRawRoute?.options as Record<string, unknown>).type).toBe("application/xml");
    expect((importRawRoute?.options as Record<string, unknown>).response).toBeDefined();
    expect((importFromUrlRoute?.options as Record<string, unknown>).body).toBeDefined();
    expect((importFromUrlRoute?.options as Record<string, unknown>).response).toBeDefined();

    expect((exportRoute?.options as Record<string, unknown>).response).toBeDefined();

    expect((historyRoute?.options as Record<string, unknown>).query).toBeDefined();
    expect((historyRoute?.options as Record<string, unknown>).response).toBeDefined();

    expect((activeRoute?.options as Record<string, unknown>).response).toBeDefined();
  });

  test("exposes request/response schemas for status/failures/cancel/delete endpoints", () => {
    const { app, routes } = createRouteRecorder();
    registerOpmlRoutes(app as never);

    const statusRoute = routes.find((r) => r.path === "/opml/imports/:taskId/status");
    const failuresRoute = routes.find((r) => r.path === "/opml/imports/:taskId/failures");
    const cancelRoute = routes.find((r) => r.path === "/opml/imports/:taskId/cancel");
    const deleteRoute = routes.find(
      (r) => r.method === "delete" && r.path === "/opml/imports/:taskId",
    );

    expect(statusRoute).toBeDefined();
    expect(failuresRoute).toBeDefined();
    expect(cancelRoute).toBeDefined();
    expect(deleteRoute).toBeDefined();

    expect((statusRoute?.options as Record<string, unknown>).params).toBeDefined();
    expect((statusRoute?.options as Record<string, unknown>).response).toBeDefined();

    expect((failuresRoute?.options as Record<string, unknown>).params).toBeDefined();
    expect((failuresRoute?.options as Record<string, unknown>).query).toBeDefined();
    expect((failuresRoute?.options as Record<string, unknown>).response).toBeDefined();

    expect((cancelRoute?.options as Record<string, unknown>).params).toBeDefined();
    expect((cancelRoute?.options as Record<string, unknown>).response).toBeDefined();

    expect((deleteRoute?.options as Record<string, unknown>).params).toBeDefined();
    expect((deleteRoute?.options as Record<string, unknown>).response).toBeDefined();
  });

  test("rejects JSON imports over the 2 MiB legacy compatibility ceiling", async () => {
    const { app, routes } = createRouteRecorder();
    registerOpmlRoutes(app as never);
    const importRoute = routes.find((r) => r.method === "post" && r.path === "/opml/imports");
    const handler = importRoute?.handler as (context: unknown) => Promise<unknown>;

    await expect(
      handler(
        fakeHandlerContext({
          body: { xml: "x".repeat(2 * 1024 * 1024 + 1) },
        }),
      ),
    ).rejects.toMatchObject({ code: "OPML_LEGACY_JSON_TOO_LARGE", status: 413 });
    expect(enqueueOpmlImportMock).not.toHaveBeenCalled();
  });

  test("accepts a raw XML import using the x-opml-filename header", async () => {
    const { app, routes } = createRouteRecorder();
    registerOpmlRoutes(app as never);
    const importRawRoute = routes.find(
      (r) => r.method === "post" && r.path === "/opml/imports/raw",
    );
    const handler = importRawRoute?.handler as (context: unknown) => Promise<unknown>;

    const result = await handler(
      fakeHandlerContext({
        body: '<opml><body><outline xmlUrl="https://example.com/feed.xml"/></body></opml>',
        headers: { "x-opml-filename": "my-feeds.opml" },
      }),
    );

    expect(result).toEqual({ taskId: "import-1" });
    expect(enqueueOpmlImportMock).toHaveBeenCalledWith(
      {},
      "user-1",
      expect.stringContaining("<opml"),
      expect.anything(),
      "my-feeds.opml",
    );
  });

  test("stores the resolved remote URL as sourceUrl for from-url imports", async () => {
    mock.module("@modules/opml/fetch-url", () => ({
      fetchOpmlDocumentFromUrl: mock(async () => ({
        xml: "<opml><body/></opml>",
        finalUrl: "https://example.com/final.opml",
        filename: "final.opml",
      })),
    }));
    const { registerOpmlRoutes: register } = await import("@modules/opml/routes");
    const { app, routes } = createRouteRecorder();
    register(app as never);
    const fromUrlRoute = routes.find(
      (r) => r.method === "post" && r.path === "/opml/imports/from-url",
    );
    const handler = fromUrlRoute?.handler as (context: unknown) => Promise<unknown>;

    await handler(fakeHandlerContext({ body: { url: "https://example.com/original.opml" } }));

    expect(enqueueOpmlImportMock).toHaveBeenCalledWith(
      {},
      "user-1",
      "<opml><body/></opml>",
      expect.anything(),
      "final.opml",
      "https://example.com/final.opml",
    );
  });

  test("status route reads counters from the durable store without a failures fan-out", async () => {
    const { app, routes } = createRouteRecorder();
    registerOpmlRoutes(app as never);
    const statusRoute = routes.find((r) => r.path === "/opml/imports/:taskId/status");
    const handler = statusRoute?.handler as (context: unknown) => Promise<unknown>;

    const row = {
      id: "import-1",
      userId: "user-1",
      filename: "feeds.opml",
      opmlTitle: "My Feeds",
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
      completedAt: null,
    };
    const limit = mock(() => Promise.resolve([row]));
    const where = mock(() => ({ limit }));
    const from = mock(() => ({ where }));
    const select = mock(() => ({ from }));
    const fakeDb = { select };

    const result = await handler(
      fakeHandlerContext({ db: fakeDb, params: { taskId: "import-1" } }),
    );

    expect(result).toMatchObject({
      taskId: "import-1",
      status: "in_progress",
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

  test("status route throws 404 when the import does not belong to the requesting user", async () => {
    const { app, routes } = createRouteRecorder();
    registerOpmlRoutes(app as never);
    const statusRoute = routes.find((r) => r.path === "/opml/imports/:taskId/status");
    const handler = statusRoute?.handler as (context: unknown) => Promise<unknown>;

    const limit = mock(() => Promise.resolve([]));
    const where = mock(() => ({ limit }));
    const from = mock(() => ({ where }));
    const select = mock(() => ({ from }));
    const fakeDb = { select };

    await expect(
      handler(fakeHandlerContext({ db: fakeDb, params: { taskId: "import-1" } })),
    ).rejects.toMatchObject({ code: "OPML_TASK_NOT_FOUND", status: 404 });
  });

  test("history route maps internal state to the camel-case stage/status page contract", async () => {
    const { app, routes } = createRouteRecorder();
    registerOpmlRoutes(app as never);
    const historyRoute = routes.find((r) => r.method === "get" && r.path === "/opml/imports");
    const handler = historyRoute?.handler as (context: unknown) => Promise<unknown>;

    const row = {
      id: "import-1",
      filename: "feeds.opml",
      sourceUrl: null,
      status: "running",
      totalItems: 10,
      completedItems: 3,
      subscribedItems: 2,
      alreadySubscribedItems: 1,
      failedItems: 0,
      cancelledItems: 0,
      lastErrorMessage: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:05:00.000Z"),
      completedAt: null,
    };
    const limit = mock(() => Promise.resolve([row]));
    const orderBy = mock(() => ({ limit }));
    const where = mock(() => ({ orderBy }));
    const from = mock(() => ({ where }));
    const select = mock(() => ({ from }));
    const fakeDb = { select };

    const result = await handler(fakeHandlerContext({ db: fakeDb, query: {} }));

    expect(result).toMatchObject({
      items: [
        {
          taskId: "import-1",
          stage: "processing",
          status: "in_progress",
          summary: { totalUrls: 10, completed: 3, subscribed: 2, alreadySubscribed: 1, failed: 0 },
        },
      ],
      hasMore: false,
    });
  });

  test("failures route returns the keyset page directly", async () => {
    const { app, routes } = createRouteRecorder();
    registerOpmlRoutes(app as never);
    const failuresRoute = routes.find((r) => r.path === "/opml/imports/:taskId/failures");
    const handler = failuresRoute?.handler as (context: unknown) => Promise<unknown>;

    let selectCount = 0;
    const select = mock(() => ({
      from: () => ({
        where: () => {
          selectCount += 1;
          if (selectCount === 1) {
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
    }));
    const fakeDb = { select };

    const result = await handler(
      fakeHandlerContext({ db: fakeDb, params: { taskId: "import-1" }, query: {} }),
    );

    expect(result).toEqual({
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

  test("cancel route drains pending items in bounded batches after a successful cancellation", async () => {
    const { app, routes } = createRouteRecorder();
    registerOpmlRoutes(app as never);
    const cancelRoute = routes.find((r) => r.path === "/opml/imports/:taskId/cancel");
    const handler = cancelRoute?.handler as (context: unknown) => Promise<unknown>;

    const row = {
      id: "import-1",
      userId: "user-1",
      status: "running",
    };
    const cancelSelectLimit = mock(() => Promise.resolve([row]));
    const cancelSelectWhere = mock(() => ({ limit: cancelSelectLimit }));
    const cancelSelectFrom = mock(() => ({ where: cancelSelectWhere }));
    const cancelSelect = mock(() => ({ from: cancelSelectFrom }));

    const cancelUpdateReturning = mock(() => Promise.resolve([{ ...row, status: "cancelling" }]));
    const cancelUpdateWhere = mock(() => ({ returning: cancelUpdateReturning }));
    const cancelUpdateSet = mock(() => ({ where: cancelUpdateWhere }));

    let batchCallCount = 0;
    const batchCounts = [2, 0];
    const fakeDb = {
      select: cancelSelect,
      update: mock(() => ({ set: cancelUpdateSet })),
      transaction: async (callback: (tx: unknown) => unknown) => {
        const count = batchCounts[batchCallCount] ?? 0;
        batchCallCount += 1;
        const tx = {
          execute: () =>
            Promise.resolve(Array.from({ length: count }, (_, i) => ({ id: `x${i}` }))),
          update: () => ({
            set: () => ({ where: () => Promise.resolve() }),
          }),
          select: () => ({
            from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }),
          }),
        };
        return callback(tx);
      },
    };

    const result = await handler(
      fakeHandlerContext({ db: fakeDb, params: { taskId: "import-1" } }),
    );

    expect(result).toMatchObject({ taskId: "import-1", cancelled: true });
    expect(batchCallCount).toBe(2);
  });
});
