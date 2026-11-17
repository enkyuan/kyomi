import { describe, expect, test } from "bun:test";
import { Cause, Effect, Exit, ManagedRuntime, Result } from "effect";
import { Db } from "@adapters/db/service";
import { realDb, recordingLogger, testConfig } from "@api-tests/support/layers";
import { AppConfig } from "@config/env/service";
import { ConfigError } from "@shared/effect/errors";

describe("Db layer", () => {
  test("ends the pool when the runtime is disposed", async () => {
    const runtime = ManagedRuntime.make(realDb());
    const db = await runtime.runPromise(Effect.service(Db));
    expect(db.pool.ended).toBe(false);

    await runtime.dispose();

    expect(db.pool.ended).toBe(true);
  });

  test("maps a failing query to DatabaseError", async () => {
    const runtime = ManagedRuntime.make(
      realDb({ DATABASE_URL: "postgresql://x:y@127.0.0.1:1/none" }),
    );
    const error = await runtime
      .runPromise(
        Db.use((db) => db.use("select 1", (client) => client.execute("select 1" as never))).pipe(
          Effect.flip,
        ),
      )
      .finally(() => runtime.dispose());
    expect(error._tag).toBe("DatabaseError");
  });
});

describe("AppConfig layer", () => {
  test("fails with ConfigError when the environment is invalid", async () => {
    const runtime = ManagedRuntime.make(AppConfig.layerFrom({ NODE_ENV: "test" }));
    const exit = await runtime.runPromiseExit(Effect.service(AppConfig));
    await runtime.dispose();
    expect(Exit.isFailure(exit) && Cause.findError(exit.cause)).toBeTruthy();
    const failure = Exit.isFailure(exit) ? Cause.findError(exit.cause) : undefined;
    expect(failure && Result.isSuccess(failure) && failure.success).toBeInstanceOf(ConfigError);
  });

  test("applies defaults for a minimal valid environment", async () => {
    const runtime = ManagedRuntime.make(testConfig());
    const config = await runtime.runPromise(Effect.service(AppConfig));
    await runtime.dispose();
    expect(config.PORT).toBe(8000);
    expect(recordingLogger().entries).toEqual([]);
  });
});
