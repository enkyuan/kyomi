import { describe, expect, test } from "bun:test";
import { registerArticleWriteRoutes } from "@modules/articles/articles.write.routes";

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

describe("articles.write.routes", () => {
  test("registers write route surface with expected methods and paths", () => {
    const { app, routes } = createRouteRecorder();
    const returned = registerArticleWriteRoutes(app as never);

    expect(returned as unknown).toBe(app);
    expect(routes.map((route) => `${route.method} ${route.path}`)).toEqual([
      "post /articles",
      "put /articles/:articleId",
    ]);
    for (const route of routes) {
      expect(typeof route.handler).toBe("function");
    }
  });

  test("exposes request/response schemas for write routes", () => {
    const { app, routes } = createRouteRecorder();
    registerArticleWriteRoutes(app as never);

    const create = routes.find((route) => route.path === "/articles");
    const update = routes.find((route) => route.path === "/articles/:articleId");

    expect(create).toBeDefined();
    expect(update).toBeDefined();

    expect((create?.options as Record<string, unknown>).body).toBeDefined();
    expect((create?.options as Record<string, unknown>).response).toBeDefined();
    expect((update?.options as Record<string, unknown>).params).toBeDefined();
    expect((update?.options as Record<string, unknown>).body).toBeDefined();
    expect((update?.options as Record<string, unknown>).response).toBeDefined();
  });
});
