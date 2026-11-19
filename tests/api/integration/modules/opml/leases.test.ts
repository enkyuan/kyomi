import { describe, expect, test } from "bun:test";
import { Effect, Exit, Fiber, Layer } from "effect";
import { TestClock } from "effect/testing";
import { OPML_ITEM_HEARTBEAT_MS } from "@modules/opml/constants";
import { OpmlLeaseLost, withOpmlItemLeaseHeartbeat } from "@modules/opml/store";
import { fakeDb as dbLayer, recordingLogger } from "@api-tests/support/layers";

const claim = {
  id: "item-1",
  importId: "import-1",
  userId: "user-1",
  originalUrl: "https://example.com/feed.xml",
  normalizedUrl: "https://example.com/feed.xml",
  title: null,
  folderName: "Unsorted",
  folderId: null,
  feedId: null,
  leaseToken: "lease-1",
  attempts: 1,
};

/** A db whose heartbeat update answers each beat from `beats` (a row, no row, or a failure). */
function heartbeatDb(beats: Array<"renewed" | "lost" | Error>) {
  const patches: Array<Record<string, unknown>> = [];
  const db = {
    update: () => ({
      set: (patch: Record<string, unknown>) => {
        patches.push(patch);
        return {
          where: () => ({
            returning: () => {
              const beat = beats[patches.length - 1] ?? "renewed";
              if (beat instanceof Error) {
                return Promise.reject(beat);
              }
              return Promise.resolve(beat === "renewed" ? [{ id: "item-1" }] : []);
            },
          }),
        };
      },
    }),
  };
  return { db, patches };
}

/**
 * One heartbeat interval of test time, then a real macrotask so the beat's database promise
 * settles and the loop registers its next sleep before the clock moves again.
 */
const tick = TestClock.adjust(OPML_ITEM_HEARTBEAT_MS).pipe(
  Effect.andThen(Effect.promise(() => new Promise<void>((resolve) => setTimeout(resolve, 0)))),
);

const layerFor = (db: unknown) => {
  const logs = recordingLogger();
  return { logs, layer: Layer.mergeAll(dbLayer(db as never), logs.layer, TestClock.layer()) };
};

describe("withOpmlItemLeaseHeartbeat", () => {
  test("renews the lease every heartbeat interval while the task runs and stops with it", async () => {
    const { db, patches } = heartbeatDb([]);
    const { layer } = layerFor(db);

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const fiber = yield* Effect.forkChild(
          withOpmlItemLeaseHeartbeat(
            claim,
            Effect.sleep(OPML_ITEM_HEARTBEAT_MS * 2.5).pipe(Effect.as("done")),
          ),
        );
        yield* tick;
        const afterOne = patches.length;
        yield* tick;
        const afterTwo = patches.length;
        yield* tick;
        const value = yield* Fiber.join(fiber);
        yield* TestClock.adjust(OPML_ITEM_HEARTBEAT_MS * 4);
        return { value, afterOne, afterTwo, final: patches.length };
      }).pipe(Effect.provide(layer)),
    );

    expect(result.value).toBe("done");
    expect(result.afterOne).toBe(1);
    expect(result.afterTwo).toBe(2);
    // The task finished at 2.5 intervals; no beat fires after it, however long the clock runs.
    expect(result.final).toBe(2);
    expect(patches[0]?.leaseExpiresAt).toBeInstanceOf(Date);
  });

  test("interrupts the task and fails with OpmlLeaseLost when a beat matches no row", async () => {
    const { db } = heartbeatDb(["renewed", "lost"]);
    const { layer } = layerFor(db);
    let interrupted = false;
    const task = Effect.never.pipe(
      Effect.onInterrupt(() => Effect.sync(() => (interrupted = true))),
    );

    const exit = await Effect.runPromise(
      Effect.gen(function* () {
        const fiber = yield* Effect.forkChild(Effect.exit(withOpmlItemLeaseHeartbeat(claim, task)));
        yield* tick;
        yield* tick;
        return yield* Fiber.join(fiber);
      }).pipe(Effect.provide(layer)),
    );

    expect(Exit.isFailure(exit)).toBe(true);
    const failure = Exit.isFailure(exit) ? exit.cause : null;
    expect(JSON.stringify(failure)).toContain("OpmlLeaseLost");
    expect(interrupted).toBe(true);
    expect(new OpmlLeaseLost({ itemId: "item-1" })._tag).toBe("OpmlLeaseLost");
  });

  test("logs a database failure on a beat and keeps renewing on the next one", async () => {
    const { db, patches } = heartbeatDb([new Error("connection reset"), "renewed"]);
    const { layer, logs } = layerFor(db);

    const value = await Effect.runPromise(
      Effect.gen(function* () {
        const fiber = yield* Effect.forkChild(
          withOpmlItemLeaseHeartbeat(
            claim,
            Effect.sleep(OPML_ITEM_HEARTBEAT_MS * 2.5).pipe(Effect.as("done")),
          ),
        );
        yield* tick;
        yield* tick;
        yield* tick;
        return yield* Fiber.join(fiber);
      }).pipe(Effect.provide(layer)),
    );

    expect(value).toBe("done");
    expect(patches).toHaveLength(2);
    expect(logs.entries).toContainEqual(
      expect.objectContaining({
        level: "warn",
        event: "opml.import.item.heartbeat_failed",
        context: expect.objectContaining({ importId: "import-1", itemId: "item-1" }),
      }),
    );
  });
});
