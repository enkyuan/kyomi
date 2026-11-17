import { afterEach, describe, expect, test } from "bun:test";
import { Layer, ManagedRuntime } from "effect";
import { healthPlugin } from "@modules/health/routes";
import { fakeDb, fakeRedis, recordingLogger, testConfig } from "@api-tests/support/layers";
import { registerTestErrorHandlers } from "@api-tests/support/elysia";

const runtimes: Array<{ dispose: () => Promise<void> }> = [];

function appWith(options: {
  db?: Parameters<typeof fakeDb>[0];
  redis?: Parameters<typeof fakeRedis>[0];
}) {
  const runtime = ManagedRuntime.make(
    Layer.mergeAll(
      fakeDb(options.db ?? { execute: async () => undefined }),
      fakeRedis(
        options.redis ?? { xlen: async () => 0, xpending: async () => [0], zcard: async () => 0 },
      ),
      recordingLogger().layer,
      testConfig(),
    ),
  );
  runtimes.push(runtime);
  const app = healthPlugin(runtime);
  registerTestErrorHandlers(app);
  return app;
}

afterEach(async () => {
  await Promise.all(runtimes.splice(0).map((runtime) => runtime.dispose()));
});

describe("health routes", () => {
  test("liveness answers on both mounts and carries a request id", async () => {
    const app = appWith({});
    for (const path of ["/health", "/api/health"]) {
      const response = await app.handle(new Request(`http://localhost${path}`));
      expect(response.status).toBe(200);
      expect(response.headers.get("x-request-id")).toBeTruthy();
      expect(await response.json()).toMatchObject({ status: "ok" });
    }
  });

  test("readiness is 200 when ready and 503 when the database is down", async () => {
    const ok = await appWith({}).handle(new Request("http://localhost/ready"));
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ ready: true });

    const down = await appWith({
      db: {
        execute: async () => {
          throw new Error("connection refused");
        },
      },
    }).handle(new Request("http://localhost/api/ready"));
    expect(down.status).toBe(503);
    expect(await down.json()).toMatchObject({ ready: false });
  });

  test("queue health returns stream counts", async () => {
    const response = await appWith({
      redis: {
        xlen: async () => 4,
        xpending: async () => [1, "1-0", "1-0", []],
        zcard: async () => 3,
      },
    }).handle(new Request("http://localhost/queue/health"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      streams: {
        "jobs:feed-refresh": { length: 4, pending: 1, scheduled: 3 },
        "jobs:opml": { length: 4, pending: 1, scheduled: 3 },
      },
    });
  });

  test("a Redis failure renders the standard error envelope", async () => {
    const response = await appWith({
      redis: {
        xlen: async () => 4,
        xpending: async () => {
          throw new Error("Connection is closed.");
        },
      },
    }).handle(
      new Request("http://localhost/queue/health", { headers: { "x-request-id": "req-1" } }),
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: { message: "Internal error", code: "INTERNAL_ERROR", requestId: "req-1" },
    });
  });
});
