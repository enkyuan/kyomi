import { describe, expect, test } from "bun:test";
import { registerArticleRoutes } from "@modules/articles/articles.routes";

type RecordedRoute = {
  method: "get" | "post" | "put";
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
    put(path: string, handler: unknown, options?: unknown) {
      routes.push({ method: "put", path, handler, options });
      return app;
    },
  };
  return { app, routes };
}

describe("articles.routes", () => {
  test("registers all route paths with expected methods", () => {
    const { app, routes } = createRouteRecorder();
    const returned = registerArticleRoutes(app as never);

    expect(returned as unknown).toBe(app);
    expect(routes.map((route) => `${route.method} ${route.path}`)).toEqual([
      "get /articles/views/today",
      "get /articles/views/recently-read",
      "get /articles/views/read-later",
      "get /articles/counts",
      "get /articles/unread-counts",
      "get /articles/check-saved",
      "get /articles/saved",
      "get /articles",
      "get /articles/clips",
      "get /articles/:articleId",
      "post /articles/:articleId/extract-full-text",
      "post /articles/:articleId/summarize",
      "post /articles/:articleId/translate",
      "post /articles",
      "put /articles/:articleId",
    ]);
    for (const route of routes) {
      expect(typeof route.handler).toBe("function");
    }
  });

  test("exposes validation/response schemas for read routes", () => {
    const { app, routes } = createRouteRecorder();
    registerArticleRoutes(app as never);

    const unreadCounts = routes.find((r) => r.path === "/articles/unread-counts");
    const checkSaved = routes.find((r) => r.path === "/articles/check-saved");
    const detail = routes.find((r) => r.method === "get" && r.path === "/articles/:articleId");

    expect(unreadCounts).toBeDefined();
    expect(checkSaved).toBeDefined();
    expect(detail).toBeDefined();

    expect((unreadCounts?.options as Record<string, unknown>).query).toBeDefined();
    expect((unreadCounts?.options as Record<string, unknown>).response).toBeDefined();
    expect((checkSaved?.options as Record<string, unknown>).query).toBeDefined();
    expect((checkSaved?.options as Record<string, unknown>).response).toBeDefined();
    expect((detail?.options as Record<string, unknown>).params).toBeDefined();
    expect((detail?.options as Record<string, unknown>).response).toBeDefined();
  });

  test("exposes validation/response schemas for enhancement routes", () => {
    const { app, routes } = createRouteRecorder();
    registerArticleRoutes(app as never);

    const extract = routes.find((r) => r.path.endsWith("/extract-full-text"));
    const summarize = routes.find((r) => r.path.endsWith("/summarize"));
    const translate = routes.find((r) => r.path.endsWith("/translate"));

    expect(extract).toBeDefined();
    expect(summarize).toBeDefined();
    expect(translate).toBeDefined();

    expect((extract?.options as Record<string, unknown>).params).toBeDefined();
    expect((extract?.options as Record<string, unknown>).response).toBeDefined();
    expect((summarize?.options as Record<string, unknown>).params).toBeDefined();
    expect((summarize?.options as Record<string, unknown>).body).toBeDefined();
    expect((summarize?.options as Record<string, unknown>).response).toBeDefined();
    expect((translate?.options as Record<string, unknown>).params).toBeDefined();
    expect((translate?.options as Record<string, unknown>).body).toBeDefined();
    expect((translate?.options as Record<string, unknown>).response).toBeDefined();
  });

  test("exposes request/response schemas for write routes", () => {
    const { app, routes } = createRouteRecorder();
    registerArticleRoutes(app as never);

    const create = routes.find((r) => r.method === "post" && r.path === "/articles");
    const update = routes.find((r) => r.method === "put" && r.path === "/articles/:articleId");

    expect(create).toBeDefined();
    expect(update).toBeDefined();

    expect((create?.options as Record<string, unknown>).body).toBeDefined();
    expect((create?.options as Record<string, unknown>).response).toBeDefined();
    expect((update?.options as Record<string, unknown>).params).toBeDefined();
    expect((update?.options as Record<string, unknown>).body).toBeDefined();
    expect((update?.options as Record<string, unknown>).response).toBeDefined();
  });
});
