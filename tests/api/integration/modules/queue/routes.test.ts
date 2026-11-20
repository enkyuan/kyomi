import { afterEach, describe, expect, mock, test } from "bun:test";
import { Layer, ManagedRuntime } from "effect";
import { registerQueueRoutes } from "@modules/queue/routes";
import { Elysia, registerTestErrorHandlers } from "@api-tests/support/elysia";
import { fakeQueue, recordingLogger, testConfig } from "@api-tests/support/layers";

type Routed = { handle(request: Request): Promise<Response> };

const runtimes: Array<{ dispose: () => Promise<void> }> = [];

function appWith(redis: Parameters<typeof fakeQueue>[0]) {
  const runtime = ManagedRuntime.make(
    Layer.mergeAll(
      fakeQueue(redis),
      recordingLogger().layer,
      testConfig({ FEED_ADMIN_SHARED_SECRET: "queue-test-secret" }),
    ),
  );
  runtimes.push(runtime);
  // What `/api/v1` provides before a domain route runs: the session, a request id, logger and db.
  const authenticated = new Elysia().derive(() => ({
    userId: "user-1",
    requestId: "req-1",
    logger: { info: () => undefined, warn: () => undefined, error: () => undefined },
    db: {},
  }));
  // Hooks only reach routes registered after them.
  registerTestErrorHandlers(authenticated);
  return registerQueueRoutes(authenticated as never, runtime) as unknown as Routed;
}

afterEach(async () => {
  await Promise.all(runtimes.splice(0).map((runtime) => runtime.dispose()));
});

const adminHeaders = { "x-feed-admin-secret": "queue-test-secret" };
const payload = JSON.stringify({ feedId: "feed-1", userId: "system" });

describe("queue routes", () => {
  test("list dead-lettered jobs, newest first, for a feed admin", async () => {
    const app = appWith({
      xrevrange: async () => [
        ["1-0", ["type", "feed.refresh", "payload", payload, "attempts", "3", "error", "boom"]],
      ],
    });

    const response = await app.handle(
      new Request("http://localhost/queue/dead-letter?limit=5", { headers: adminHeaders }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([
      {
        id: "1-0",
        type: "feed.refresh",
        attempts: 3,
        error: "boom",
        failedAt: null,
        originalStreamId: null,
        payload,
      },
    ]);
  });

  test("refuse anyone who is not a feed admin with the standard error envelope", async () => {
    const xrevrange = mock(async () => []);
    const app = appWith({ xrevrange });

    const response = await app.handle(new Request("http://localhost/queue/dead-letter"));

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      error: { code: "FEED_ADMIN_FORBIDDEN", message: "Forbidden" },
    });
    expect(xrevrange).not.toHaveBeenCalled();
  });

  test("replay dead-lettered jobs", async () => {
    const xadd = mock(async () => "5-0");
    const app = appWith({
      xrange: async () => [["1-0", ["type", "feed.refresh", "payload", payload]]],
      xadd,
      xdel: async () => 1,
    });

    const response = await app.handle(
      new Request("http://localhost/queue/dead-letter/replay", {
        method: "POST",
        headers: { ...adminHeaders, "content-type": "application/json" },
        body: JSON.stringify({ ids: ["1-0"] }),
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      message: "Replayed 1 dead-letter job(s)",
      replayed: 1,
    });
    expect(xadd).toHaveBeenCalledTimes(1);
  });

  test("a Redis failure renders as an opaque 500 envelope carrying the request id", async () => {
    const app = appWith({
      xrevrange: async () => {
        throw new Error("Connection is closed.");
      },
    });

    const response = await app.handle(
      new Request("http://localhost/queue/dead-letter", { headers: adminHeaders }),
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({
      error: { code: "INTERNAL_ERROR", message: "Internal error", requestId: expect.any(String) },
    });
  });
});
