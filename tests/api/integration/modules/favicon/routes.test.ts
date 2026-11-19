import { afterEach, describe, expect, test } from "bun:test";
import { Effect, Layer, ManagedRuntime } from "effect";
import { faviconPlugin } from "@modules/favicon/routes";
import { FaviconResolver } from "@modules/favicon/service";
import { DatabaseError } from "@shared/effect/errors";
import { fakeDb, silentLogger, testConfig } from "@api-tests/support/layers";
import { ORIGIN } from "./store";
import { registerTestErrorHandlers } from "@api-tests/support/elysia";

const runtimes: Array<{ dispose: () => Promise<void> }> = [];

afterEach(async () => {
  await Promise.all(runtimes.splice(0).map((runtime) => runtime.dispose()));
});

type Resolver = (typeof FaviconResolver)["Service"];

function appWith(resolver: Partial<Resolver> = {}) {
  const runtime = ManagedRuntime.make(
    Layer.mergeAll(
      // The host cache table: one `update ... where` for the content-type write.
      fakeDb({ update: () => ({ set: () => ({ where: async () => undefined }) }) }),
      testConfig(),
      Layer.succeed(
        FaviconResolver,
        FaviconResolver.of({
          resolveHost: () => Effect.succeed(null),
          fetchImage: () => Effect.succeed(null),
          ...resolver,
        }),
      ),
    ),
  );
  runtimes.push(runtime);
  const app = faviconPlugin(runtime);
  registerTestErrorHandlers(app);
  return app;
}

const get = (app: ReturnType<typeof appWith>, domain: string) =>
  app.handle(new Request(`http://localhost/api/favicon?domain=${encodeURIComponent(domain)}`));

describe("GET /api/favicon", () => {
  test("an invalid domain is a plain 400 with a request id", async () => {
    const response = await get(appWith(), "not-a-url");

    expect(response.status).toBe(400);
    expect(await response.text()).toBe("Invalid domain");
    expect(response.headers.get("x-request-id")).toBeTruthy();
  });

  test("passes the resolved image through with its cache headers", async () => {
    const app = appWith({
      resolveHost: () =>
        Effect.succeed({
          kind: "hit",
          origin: ORIGIN,
          hostname: new URL(ORIGIN).hostname,
          url: `${ORIGIN}/icon.png`,
          source: "html_link",
          contentType: null,
        }),
      fetchImage: () =>
        Effect.succeed(new Response("png", { headers: { "content-type": "image/png" } })),
    });

    const response = await get(app, ORIGIN);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("cache-control")).toContain("max-age=604800");
    expect(await response.text()).toBe("png");
  });

  test("an infrastructure failure renders the opaque 500 envelope", async () => {
    const app = appWith({
      resolveHost: () =>
        Effect.fail(
          new DatabaseError({ operation: "favicon.resolve_host", cause: new Error("down") }),
        ),
    });

    const response = await get(app, ORIGIN);

    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({
      error: { code: "INTERNAL_ERROR", message: "Internal error" },
    });
  });
});
