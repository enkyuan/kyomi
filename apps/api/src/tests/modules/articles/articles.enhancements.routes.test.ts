import { describe, expect, test } from "bun:test";
import { registerArticleEnhancementRoutes } from "@modules/articles/articles.enhancements.routes";

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

describe("articles.enhancements.routes", () => {
  test("registers enhancement route surface with expected methods and paths", () => {
    const { app, routes } = createRouteRecorder();
    const returned = registerArticleEnhancementRoutes(app as never);

    expect(returned as unknown).toBe(app);
    expect(routes.map((route) => `${route.method} ${route.path}`)).toEqual([
      "post /articles/:articleId/extract-full-text",
      "post /articles/:articleId/summarize",
      "post /articles/:articleId/translate",
    ]);
    for (const route of routes) {
      expect(typeof route.handler).toBe("function");
    }
  });

  test("exposes validation/response schemas for enhancement actions", () => {
    const { app, routes } = createRouteRecorder();
    registerArticleEnhancementRoutes(app as never);

    const extract = routes.find((route) => route.path.endsWith("/extract-full-text"));
    const summarize = routes.find((route) => route.path.endsWith("/summarize"));
    const translate = routes.find((route) => route.path.endsWith("/translate"));

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
});
