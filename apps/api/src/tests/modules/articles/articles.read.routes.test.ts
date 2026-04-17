import { describe, expect, test } from "bun:test";
import { registerArticleReadRoutes } from "@modules/articles/articles.read.routes";

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

describe("articles.read.routes", () => {
  test("registers read route surface with expected methods and paths", () => {
    const { app, routes } = createRouteRecorder();
    const returned = registerArticleReadRoutes(app as never);

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
    ]);
    for (const route of routes) {
      expect(typeof route.handler).toBe("function");
    }
  });

  test("exposes validation/response schemas for key read routes", () => {
    const { app, routes } = createRouteRecorder();
    registerArticleReadRoutes(app as never);

    const unreadCounts = routes.find((route) => route.path === "/articles/unread-counts");
    const checkSaved = routes.find((route) => route.path === "/articles/check-saved");
    const detail = routes.find((route) => route.path === "/articles/:articleId");

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
});
