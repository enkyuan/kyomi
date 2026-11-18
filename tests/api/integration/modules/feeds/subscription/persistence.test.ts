import { describe, expect, test } from "bun:test";
import { Effect } from "effect";
import { inTransaction, subscribeUserToFeed } from "@modules/feeds/subscription/persistence";
import { fakeDb } from "@api-tests/support/layers";

/** A transaction whose folder insert is ignored and whose follow-up select finds no row. */
const folderlessTransaction = {
  insert: () => ({ values: () => ({ onConflictDoNothing: async () => undefined }) }),
  select: () => ({ from: () => ({ where: () => ({ limit: async () => [] }) }) }),
};

const run = <A, E>(effect: Effect.Effect<A, E, never>) => Effect.runPromise(Effect.flip(effect));

describe("inTransaction", () => {
  test("a catalogue error from the folders domain keeps its status and code", async () => {
    const layer = fakeDb({
      transaction: async (work: (tx: unknown) => unknown) => work(folderlessTransaction),
    });

    const error = await run(
      inTransaction("test.subscribe", (tx) =>
        subscribeUserToFeed(tx, "user-1", "feed-1", new Date(0)),
      ).pipe(Effect.provide(layer)),
    );

    expect(error).toMatchObject({
      _tag: "InternalError",
      code: "FOLDER_CREATE_FAILED",
      message: "Failed to create folder",
    });
  });

  test("any other throw becomes a DatabaseError that keeps the cause", async () => {
    const cause = new Error("connection terminated");
    const layer = fakeDb({
      transaction: async () => {
        throw cause;
      },
    });

    const error = await run(
      inTransaction("test.subscribe", async () => 1).pipe(Effect.provide(layer)),
    );

    expect(error).toMatchObject({ _tag: "DatabaseError", operation: "test.subscribe", cause });
  });
});
