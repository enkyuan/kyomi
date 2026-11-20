import { describe, expect, test } from "bun:test";
import { Effect, Layer } from "effect";
import { TestClock } from "effect/testing";
import { checkReadiness, getHealth } from "@modules/health/checks";
import { fakeDb, recordingLogger } from "@api-tests/support/layers";

describe("health checks", () => {
  test("getHealth includes semver version and the clock's time", async () => {
    const payload = await Effect.runPromise(
      Effect.gen(function* () {
        yield* TestClock.setTime(Date.UTC(2026, 0, 2, 3, 4, 5));
        return yield* getHealth;
      }).pipe(Effect.provide(TestClock.layer())),
    );

    expect(payload.status).toBe("ok");
    expect(payload.version).toMatch(/^\d+\.\d+\.\d+/);
    expect(payload.now).toBe("2026-01-02T03:04:05.000Z");
  });

  test("checkReadiness is ready when the database answers", async () => {
    const logs = recordingLogger();
    const payload = await Effect.runPromise(
      checkReadiness.pipe(
        Effect.provide(Layer.mergeAll(fakeDb({ execute: async () => undefined }), logs.layer)),
      ),
    );

    expect(payload.ready).toBe(true);
    expect(payload.service.length).toBeGreaterThan(0);
    expect(payload.version).toMatch(/^\d+\.\d+\.\d+/);
    expect(payload.now).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(logs.entries).toEqual([]);
  });

  test("checkReadiness is not ready, and logs why, when the database fails", async () => {
    const logs = recordingLogger();
    const payload = await Effect.runPromise(
      checkReadiness.pipe(
        Effect.provide(
          Layer.mergeAll(
            fakeDb({
              execute: async () => {
                throw new Error("connection refused");
              },
            }),
            logs.layer,
          ),
        ),
      ),
    );

    expect(payload.ready).toBe(false);
    expect(logs.entries).toHaveLength(1);
    expect(logs.entries[0]).toMatchObject({ level: "warn", event: "health.ready.failed" });
  });
});
