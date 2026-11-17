import { describe, expect, test } from "bun:test";
import { Effect, Layer } from "effect";
import { TestClock } from "effect/testing";
import {
  assertUserSubscribedToFeed,
  bulkMoveFeedsToFolder,
  bulkUnsubscribeFromFeeds,
  unsubscribeFromFeed,
  updateFeedSubscriptionSettings,
} from "@modules/feeds/subscription/mutations";
import { subscribeUserToFeed } from "@modules/feeds/subscription/persistence";
import { fakeDb, recordingLogger } from "@api-tests/support/layers";

const FEED_A = "550e8400-e29b-41d4-a716-446655440000";
const FEED_B = "550e8400-e29b-41d4-a716-446655440001";

const failureOf = <A, E>(effect: Effect.Effect<A, E>) => Effect.runPromise(Effect.flip(effect));

/** `delete().where().returning()` resolving to `rows`. */
const deleting = (rows: unknown[]) => ({
  delete: () => ({ where: () => ({ returning: () => Promise.resolve(rows) }) }),
});

/** `update().set().where().returning()` resolving to `rows`; records every `set` argument. */
function updating(rows: unknown[]) {
  const sets: unknown[] = [];
  const methods = {
    update: () => ({
      set: (values: unknown) => {
        sets.push(values);
        return { where: () => ({ returning: () => Promise.resolve(rows) }) };
      },
    }),
  };
  return { methods, sets };
}

/** `select().from().where().limit()` resolving to `rows`. */
const selecting = (rows: unknown[]) => ({
  select: () => ({ from: () => ({ where: () => ({ limit: () => Promise.resolve(rows) }) }) }),
});

function provide(methods: Parameters<typeof fakeDb>[0]) {
  const logs = recordingLogger();
  return { layer: Layer.mergeAll(fakeDb(methods), logs.layer), logs };
}

describe("feeds.subscription.mutations", () => {
  test("unsubscribeFromFeed returns a message and logs when a row is deleted", async () => {
    const { layer, logs } = provide(deleting([{ id: "sub_1" }]));

    const result = await Effect.runPromise(
      unsubscribeFromFeed("u1", "f1").pipe(Effect.provide(layer)),
    );

    expect(result.message).toBe("Unsubscribed successfully");
    expect(logs.entries).toEqual([
      { level: "info", event: "feeds.unsubscribe", context: { userId: "u1", feedId: "f1" } },
    ]);
  });

  test("unsubscribeFromFeed fails with SUBSCRIPTION_NOT_FOUND when nothing was deleted", async () => {
    const { layer } = provide(deleting([]));

    const error = await failureOf(unsubscribeFromFeed("u1", "f1").pipe(Effect.provide(layer)));

    expect(error).toMatchObject({ _tag: "NotFound", code: "SUBSCRIPTION_NOT_FOUND" });
  });

  test("bulkUnsubscribeFromFeeds deletes matching ids", async () => {
    const { layer } = provide(deleting([{ id: "a" }, { id: "b" }]));

    const result = await Effect.runPromise(
      bulkUnsubscribeFromFeeds("u1", [FEED_A, FEED_B]).pipe(Effect.provide(layer)),
    );

    expect(result).toEqual({ message: "Removed 2 subscription(s)", removedCount: 2 });
  });

  test("bulkUnsubscribeFromFeeds rejects an id list that is empty after trimming", async () => {
    const { layer } = provide({});

    const error = await failureOf(
      bulkUnsubscribeFromFeeds("u1", ["", "  "]).pipe(Effect.provide(layer)),
    );

    expect(error).toMatchObject({ _tag: "BadRequest", code: "INVALID_FEED_IDS" });
  });

  test("bulkMoveFeedsToFolder checks the folder, then updates matching subscriptions", async () => {
    const { methods, sets } = updating([{ id: "a" }]);
    const { layer } = provide({ ...selecting([{ id: "folder_1" }]), ...methods });

    const result = await Effect.runPromise(
      bulkMoveFeedsToFolder("u1", [FEED_A], FEED_B).pipe(Effect.provide(layer)),
    );

    expect(result).toEqual({ updatedCount: 1 });
    expect(sets).toEqual([{ folderId: FEED_B }]);
  });

  test("bulkMoveFeedsToFolder fails with FOLDER_NOT_FOUND for a folder the user does not own", async () => {
    const { methods } = updating([]);
    const { layer } = provide({ ...selecting([]), ...methods });

    const error = await failureOf(
      bulkMoveFeedsToFolder("u1", [FEED_A], FEED_B).pipe(Effect.provide(layer)),
    );

    expect(error).toMatchObject({ _tag: "NotFound", code: "FOLDER_NOT_FOUND" });
  });

  test("bulkMoveFeedsToFolder takes feeds out of their folder without a folder lookup", async () => {
    const { methods, sets } = updating([{ id: "a" }]);
    // `select` is not provided: fakeDb throws if the folder lookup is attempted.
    const { layer } = provide(methods);

    const result = await Effect.runPromise(
      bulkMoveFeedsToFolder("u1", [FEED_A], null).pipe(Effect.provide(layer)),
    );

    expect(result.updatedCount).toBe(1);
    expect(sets).toEqual([{ folderId: null }]);
  });

  test("updateFeedSubscriptionSettings updates when the subscription exists", async () => {
    const { methods, sets } = updating([{ id: "s1" }]);
    const { layer, logs } = provide(methods);

    const result = await Effect.runPromise(
      updateFeedSubscriptionSettings("u1", "f1", { customTitle: "X" }).pipe(Effect.provide(layer)),
    );

    expect(result.message).toBe("Feed settings updated successfully");
    expect(sets).toEqual([{ customTitle: "X" }]);
    expect(logs.entries.map((entry) => entry.event)).toEqual(["feeds.subscription.updated"]);
  });

  test("updateFeedSubscriptionSettings stamps pinnedAt from the clock when pinning", async () => {
    const { methods, sets } = updating([{ id: "s1" }]);
    const { layer } = provide(methods);

    await Effect.runPromise(
      Effect.gen(function* () {
        yield* TestClock.setTime(Date.UTC(2026, 0, 2));
        yield* updateFeedSubscriptionSettings("u1", "f1", { isPinned: true });
      }).pipe(Effect.provide(Layer.mergeAll(layer, TestClock.layer()))),
    );

    expect(sets).toEqual([{ isPinned: true, pinnedAt: new Date(Date.UTC(2026, 0, 2)) }]);
  });

  test("updateFeedSubscriptionSettings clears pinnedAt when unpinning", async () => {
    const { methods, sets } = updating([{ id: "s1" }]);
    const { layer } = provide(methods);

    await Effect.runPromise(
      updateFeedSubscriptionSettings("u1", "f1", { isPinned: false }).pipe(Effect.provide(layer)),
    );

    expect(sets).toEqual([{ isPinned: false, pinnedAt: null }]);
  });

  test("updateFeedSubscriptionSettings fails with EMPTY_UPDATE when no fields", async () => {
    const { layer } = provide({});

    const error = await failureOf(
      updateFeedSubscriptionSettings("u1", "f1", {}).pipe(Effect.provide(layer)),
    );

    expect(error).toMatchObject({ _tag: "BadRequest", code: "EMPTY_UPDATE" });
  });

  test("updateFeedSubscriptionSettings fails with SUBSCRIPTION_NOT_FOUND when nothing matched", async () => {
    const { methods } = updating([]);
    const { layer } = provide(methods);

    const error = await failureOf(
      updateFeedSubscriptionSettings("u1", "f1", { customTitle: null }).pipe(Effect.provide(layer)),
    );

    expect(error).toMatchObject({ _tag: "NotFound", code: "SUBSCRIPTION_NOT_FOUND" });
  });

  test("assertUserSubscribedToFeed passes for a subscriber and is Forbidden otherwise", async () => {
    await Effect.runPromise(
      assertUserSubscribedToFeed("u1", "f1").pipe(
        Effect.provide(fakeDb(selecting([{ id: "s1" }]))),
      ),
    );

    const error = await failureOf(
      assertUserSubscribedToFeed("u1", "f1").pipe(Effect.provide(fakeDb(selecting([])))),
    );

    expect(error).toMatchObject({ _tag: "Forbidden", code: "NOT_SUBSCRIBED" });
  });
});

/**
 * Minimal in-memory fake for the feed_subscriptions table, with a real (userId, feedId)
 * uniqueness check so onConflictDoNothing behaves like Postgres would.
 */
function createFakeSubscriptionTx() {
  const subscriptions: Array<Record<string, unknown>> = [];

  const tx = {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve(subscriptions.map((s) => ({ id: s.id }))),
        }),
      }),
    }),
    insert: () => ({
      values: (row: Record<string, unknown>) => ({
        onConflictDoNothing: () => ({
          returning: () => {
            const conflict = subscriptions.some(
              (s) => s.userId === row.userId && s.feedId === row.feedId,
            );
            if (conflict) {
              return Promise.resolve([]);
            }
            subscriptions.push(row);
            return Promise.resolve([{ id: row.id }]);
          },
        }),
      }),
    }),
  };

  return { tx, subscriptions };
}

describe("subscribeUserToFeed", () => {
  const now = new Date("2026-01-01T00:00:00.000Z");

  test("inserts a subscription with the requested folder/title without a select-then-insert race", async () => {
    const { tx, subscriptions } = createFakeSubscriptionTx();

    const result = await subscribeUserToFeed(tx as never, "user-1", "feed-1", now, {
      folderId: "folder-1",
      customTitle: "Imported title",
    });

    expect(result.newSubscription).toBe(true);
    expect(subscriptions).toHaveLength(1);
    expect(subscriptions[0]).toMatchObject({
      folderId: "folder-1",
      customTitle: "Imported title",
      createdAt: now,
    });
  });

  test("duplicate delivery returns the same subscription without overwriting metadata", async () => {
    const { tx, subscriptions } = createFakeSubscriptionTx();

    const first = await subscribeUserToFeed(tx as never, "user-1", "feed-1", now, {
      folderId: "folder-original",
      customTitle: "Original",
    });
    const duplicate = await subscribeUserToFeed(tx as never, "user-1", "feed-1", now, {
      folderId: "folder-import",
      customTitle: "Import title",
    });

    expect(first.newSubscription).toBe(true);
    expect(duplicate.newSubscription).toBe(false);
    expect(duplicate.subscriptionId).toBe(first.subscriptionId);
    expect(subscriptions).toHaveLength(1);
    expect(subscriptions[0]).toMatchObject({
      folderId: "folder-original",
      customTitle: "Original",
    });
  });
});
