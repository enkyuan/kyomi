import { describe, expect, test } from "bun:test";
import { registerOpmlRoutes } from "@modules/opml/routes";

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
      "get /opml/export",
      "get /opml/imports/active",
      "get /opml/imports/:taskId/status",
      "delete /opml/imports/:taskId/cancel",
      "delete /opml/imports/:taskId",
    ]);

    for (const route of routes) {
      expect(typeof route.handler).toBe("function");
    }
  });

  test("exposes request/response schemas for OPML endpoints", () => {
    const { app, routes } = createRouteRecorder();
    registerOpmlRoutes(app as never);

    const importRoute = routes.find((r) => r.method === "post" && r.path === "/opml/imports");
    const exportRoute = routes.find((r) => r.method === "get" && r.path === "/opml/export");
    const activeRoute = routes.find((r) => r.path === "/opml/imports/active");
    const statusRoute = routes.find((r) => r.path === "/opml/imports/:taskId/status");
    const cancelRoute = routes.find((r) => r.path === "/opml/imports/:taskId/cancel");
    const deleteRoute = routes.find(
      (r) => r.method === "delete" && r.path === "/opml/imports/:taskId",
    );

    expect(importRoute).toBeDefined();
    expect(exportRoute).toBeDefined();
    expect(activeRoute).toBeDefined();
    expect(statusRoute).toBeDefined();
    expect(cancelRoute).toBeDefined();
    expect(deleteRoute).toBeDefined();

    expect((importRoute?.options as Record<string, unknown>).body).toBeDefined();
    expect((importRoute?.options as Record<string, unknown>).response).toBeDefined();

    expect((exportRoute?.options as Record<string, unknown>).response).toBeDefined();

    expect((activeRoute?.options as Record<string, unknown>).response).toBeDefined();

    expect((statusRoute?.options as Record<string, unknown>).params).toBeDefined();
    expect((statusRoute?.options as Record<string, unknown>).response).toBeDefined();

    expect((cancelRoute?.options as Record<string, unknown>).params).toBeDefined();
    expect((cancelRoute?.options as Record<string, unknown>).response).toBeDefined();

    expect((deleteRoute?.options as Record<string, unknown>).params).toBeDefined();
    expect((deleteRoute?.options as Record<string, unknown>).response).toBeDefined();
  });
});
