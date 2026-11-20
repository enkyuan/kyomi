import { afterEach, describe, expect, test } from "bun:test";
import { Effect, Exit, Layer, ManagedRuntime, Scope } from "effect";
import { Db, dbShape, type Database } from "@adapters/db/service";
import { Redis } from "@adapters/redis/service";
import { runtimeFromScope as appRuntimeFromScope, type AppRuntime } from "@app/runtime";
import { registerLifecycle } from "@app/setup/lifecycle";
import { recordingLogger, silentLogger, testConfig } from "@api-tests/support/layers";

/** `runtimeFromScope` over just the services these tests build (it only reads the context). */
const runtimeFromScope = appRuntimeFromScope as unknown as Effect.Effect<
  AppRuntime,
  never,
  Db | Scope.Scope
>;

/** A `Db` whose release is recorded, standing in for the pool without opening one. */
const recordedDb = (events: string[]) =>
  Layer.effect(
    Db,
    Effect.acquireRelease(
      Effect.sync(() => {
        events.push("db acquired");
        return Db.of(dbShape({} as Database, {} as Db["Service"]["pool"]));
      }),
      () => Effect.sync(() => void events.push("db released")),
    ),
  );

describe("Db layer", () => {
  test("disposing the runtime ends the pool", async () => {
    const runtime = ManagedRuntime.make(
      Db.layer.pipe(Layer.provide(testConfig()), Layer.provide(silentLogger)),
    );
    const { pool } = await runtime.runPromise(Effect.service(Db));
    expect(pool.ended).toBe(false);

    await runtime.dispose();

    expect(pool.ended).toBe(true);
  });
});

describe("Redis layer", () => {
  let server: Bun.TCPSocketListener<undefined> | undefined;
  afterEach(() => server?.stop(true));

  /** A TCP server speaking just enough RESP for ioredis to connect, then records every command. */
  function fakeRedisServer() {
    const commands: string[] = [];
    const closed: Promise<void> = new Promise((resolve) => {
      server = Bun.listen({
        hostname: "127.0.0.1",
        port: 0,
        socket: {
          data(socket, data) {
            // Each command is a RESP array: `*N`, then a `$len` line and a value line per element.
            const lines = new TextDecoder().decode(data).split("\r\n");
            for (let i = 0; i < lines.length; i += 1) {
              if (!lines[i]!.startsWith("*")) {
                continue;
              }
              const name = (lines[i + 2] ?? "").toUpperCase();
              if (name === "INFO") {
                const body = "# Server\r\nloading:0\r\n";
                socket.write(`$${body.length}\r\n${body}\r\n`);
              } else if (name === "PING") {
                socket.write("+PONG\r\n");
              } else {
                socket.write("+OK\r\n");
              }
              if (name !== "CLIENT") {
                commands.push(name);
              }
              if (name === "QUIT") {
                socket.end();
              }
            }
          },
          close() {
            resolve();
          },
        },
      });
    });
    return { commands, closed, url: `redis://127.0.0.1:${server!.port}` };
  }

  test("disposing the runtime quits the connection", async () => {
    const fake = fakeRedisServer();
    const runtime = ManagedRuntime.make(
      Redis.layer.pipe(
        Layer.provide(testConfig({ REDIS_URL: fake.url })),
        Layer.provide(silentLogger),
      ),
    );
    // A command waits for the connection, so it returns once the client is up (and ready-checked).
    await runtime.runPromise(
      Effect.flatMap(Effect.service(Redis), (redis) =>
        redis.use("ping", (client) => client.ping()),
      ),
    );
    expect(fake.commands).toEqual(["INFO", "PING"]);

    await runtime.dispose();
    await fake.closed;

    expect(fake.commands).toContain("QUIT");
  });
});

describe("runtimeFromScope", () => {
  test("the server's release runs before the services it uses are released", async () => {
    const events: string[] = [];
    const scope = await Effect.runPromise(Scope.make());
    const services = Layer.mergeAll(testConfig(), silentLogger, recordedDb(events));

    await Effect.runPromise(
      Effect.gen(function* () {
        // Build the services into the outer scope, as `Effect.provide(AppLive)` does in a boot file.
        const context = yield* Layer.build(services);
        const runtime = yield* runtimeFromScope.pipe(Effect.provide(context));
        // The runtime reads the services the scope built; it opens nothing of its own.
        yield* Effect.promise(() => runtime.runPromise(Effect.service(Db)));
        yield* Effect.acquireRelease(
          Effect.sync(() => void events.push("server listening")),
          () => Effect.sync(() => void events.push("server stopped")),
        );
      }).pipe(Scope.provide(scope)),
    );
    expect(events).toEqual(["db acquired", "server listening"]);

    await Effect.runPromise(Scope.close(scope, Exit.void));

    expect(events).toEqual(["db acquired", "server listening", "server stopped", "db released"]);
  });
});

describe("registerLifecycle", () => {
  /** An app that only records the hooks registered on it. */
  function recordingApp() {
    const hooks: { start?: () => unknown; stop?: () => unknown } = {};
    const app = {
      onStart: (hook: () => unknown) => void (hooks.start = hook),
      onStop: (hook: () => unknown) => void (hooks.stop = hook),
    } as unknown as Parameters<typeof registerLifecycle>[0];
    return { app, hooks };
  }

  function runtimeWith(events: string[], logs = recordingLogger()) {
    const layer = Layer.mergeAll(testConfig(), logs.layer, recordedDb(events));
    return { runtime: ManagedRuntime.make(layer) as unknown as AppRuntime, logs };
  }

  test("an app that owns its runtime disposes it on stop, after logging the shutdown", async () => {
    const events: string[] = [];
    const { runtime, logs } = runtimeWith(events);
    await runtime.runPromise(Effect.service(Db));
    const { app, hooks } = recordingApp();

    registerLifecycle(app, { runtime, ownsRuntime: true });
    await hooks.start?.();
    await hooks.stop?.();

    expect(events).toEqual(["db acquired", "db released"]);
    expect(logs.entries.map((entry) => entry.event)).toEqual([
      "application.startup.complete",
      "feed.admin.unconfigured",
      "application.shutdown.complete",
    ]);
  });

  test("an app handed a runtime leaves it to its owner", async () => {
    const events: string[] = [];
    const { runtime } = runtimeWith(events);
    await runtime.runPromise(Effect.service(Db));
    const { app, hooks } = recordingApp();

    registerLifecycle(app, { runtime, ownsRuntime: false });
    await hooks.stop?.();

    expect(events).toEqual(["db acquired"]);
    await runtime.dispose();
    expect(events).toEqual(["db acquired", "db released"]);
  });
});
