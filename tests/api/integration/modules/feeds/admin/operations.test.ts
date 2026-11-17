import { describe, expect, test } from "bun:test";
import { Effect, Layer } from "effect";
import { FeedSearch, type FeedSearchShape } from "@adapters/search/service";
import { adminDeleteGlobalFeed, adminUpdateGlobalFeed } from "@modules/feeds/admin/operations";
import { UpstreamError } from "@shared/effect/errors";
import { fakeDb, recordingLogger, testConfig } from "@api-tests/support/layers";

const ADMIN = "admin-1";
const HEADERS = new Headers();

const feedRow = {
  id: "feed_1",
  url: "https://example.com/feed.xml",
  title: "Example",
  description: null,
  link: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-02T00:00:00.000Z"),
};

const failureOf = <A, E>(effect: Effect.Effect<A, E>) => Effect.runPromise(Effect.flip(effect));

/** A feed index that records writes, or fails every call when `fail` is set. */
function fakeSearch(options: { fail?: boolean } = {}) {
  const calls: Array<{ op: "upsert" | "remove"; arg: unknown }> = [];
  const outcome = (operation: string) =>
    options.fail
      ? Effect.fail(new UpstreamError({ operation, cause: new Error("meili down") }))
      : Effect.void;
  const shape: FeedSearchShape = {
    isConfigured: () => true,
    upsert: (documents) => {
      calls.push({ op: "upsert", arg: documents });
      return outcome("meili upsert");
    },
    remove: (feedId) => {
      calls.push({ op: "remove", arg: feedId });
      return outcome("meili delete");
    },
    search: () => Effect.succeed([]),
  };
  return { calls, layer: Layer.succeed(FeedSearch, FeedSearch.of(shape)) };
}

/** `select().from().where().limit()`, `update().set().where().returning()` and `delete()` over one row. */
function adminDb(options: { existing?: unknown[]; clash?: unknown[]; deleted?: unknown[] } = {}) {
  const selects = [options.existing ?? [feedRow], options.clash ?? []];
  const sets: unknown[] = [];
  let selectCall = 0;
  const methods = {
    select: () => ({
      from: () => ({
        where: () => ({ limit: async () => selects[selectCall++] ?? [] }),
      }),
    }),
    update: () => ({
      set: (values: unknown) => {
        sets.push(values);
        return {
          where: () => ({ returning: async () => [{ ...feedRow, ...(values as object) }] }),
        };
      },
    }),
    delete: () => ({
      where: () => ({ returning: async () => options.deleted ?? [{ id: "feed_1" }] }),
    }),
  };
  return { methods, sets };
}

function environment(
  options: {
    db?: Parameters<typeof fakeDb>[0];
    search?: ReturnType<typeof fakeSearch>;
    config?: Record<string, string>;
  } = {},
) {
  const logs = recordingLogger();
  const search = options.search ?? fakeSearch();
  const layer = Layer.mergeAll(
    fakeDb(options.db ?? adminDb().methods),
    search.layer,
    logs.layer,
    testConfig({ FEED_ADMIN_USER_IDS: ADMIN, ...options.config }),
  );
  return { layer, logs, search };
}

const update = (
  patch: Parameters<typeof adminUpdateGlobalFeed>[3],
  headers = HEADERS,
  user = ADMIN,
) => adminUpdateGlobalFeed(user, headers, "feed_1", patch);

describe("adminUpdateGlobalFeed", () => {
  test("fails with EMPTY_UPDATE when no fields are given", async () => {
    const { layer } = environment();

    const error = await failureOf(update({}).pipe(Effect.provide(layer)));

    expect(error).toMatchObject({ _tag: "BadRequest", code: "EMPTY_UPDATE" });
  });

  test("fails with FEED_NOT_FOUND when the feed row is missing", async () => {
    const { layer } = environment({ db: adminDb({ existing: [] }).methods });

    const error = await failureOf(update({ title: "New" }).pipe(Effect.provide(layer)));

    expect(error).toMatchObject({ _tag: "NotFound", code: "FEED_NOT_FOUND" });
  });

  test("an empty title is INVALID_FEED_TITLE and nothing is written", async () => {
    const db = adminDb();
    const { layer } = environment({ db: db.methods });

    const error = await failureOf(update({ title: "   " }).pipe(Effect.provide(layer)));

    expect(error).toMatchObject({ _tag: "BadRequest", code: "INVALID_FEED_TITLE" });
    expect(db.sets).toHaveLength(0);
  });

  test("an unusable URL is INVALID_FEED_URL, a taken one is FEED_URL_CONFLICT", async () => {
    const invalid = await failureOf(
      update({ url: "ftp://example.com/x" }).pipe(Effect.provide(environment().layer)),
    );
    expect(invalid).toMatchObject({ _tag: "BadRequest", code: "INVALID_FEED_URL" });

    const blank = await failureOf(update({ url: " " }).pipe(Effect.provide(environment().layer)));
    expect(blank).toMatchObject({ _tag: "BadRequest", code: "INVALID_FEED_URL" });

    const taken = environment({ db: adminDb({ clash: [{ id: "feed_2" }] }).methods });
    const conflict = await failureOf(
      update({ url: "https://other.example/feed.xml" }).pipe(Effect.provide(taken.layer)),
    );
    expect(conflict).toMatchObject({ _tag: "Conflict", code: "FEED_URL_CONFLICT" });
  });

  test("writes the trimmed fields, indexes the feed and logs the update", async () => {
    const db = adminDb();
    const { layer, logs, search } = environment({ db: db.methods });

    const detail = await Effect.runPromise(
      update({ title: "  Renamed  ", link: "  ", description: "d" }).pipe(Effect.provide(layer)),
    );

    expect(db.sets[0]).toMatchObject({ title: "Renamed", link: null, description: "d" });
    expect(detail).toMatchObject({ id: "feed_1", title: "Renamed", description: "d", link: null });
    expect(search.calls).toEqual([
      {
        op: "upsert",
        arg: [expect.objectContaining({ id: "feed_1", title: "Renamed", link: null })],
      },
    ]);
    expect(logs.entries.map((entry) => entry.event)).toEqual(["feeds.admin.updated"]);
  });

  test("an unchanged URL is not re-checked for conflicts", async () => {
    // Only the existing-feed select is scripted; a second select would return no rows and still
    // pass, so assert on the write instead: the URL is left out of the update.
    const db = adminDb();
    const { layer } = environment({ db: db.methods });

    await Effect.runPromise(update({ url: feedRow.url }).pipe(Effect.provide(layer)));

    expect(db.sets[0]).not.toHaveProperty("url");
  });

  test("an index failure after an update is logged with its cause, and the update still succeeds", async () => {
    const { layer, logs } = environment({ search: fakeSearch({ fail: true }) });

    const detail = await Effect.runPromise(
      update({ title: "Example" }).pipe(Effect.provide(layer)),
    );

    expect(detail.id).toBe("feed_1");
    expect(logs.entries).toContainEqual({
      level: "warn",
      event: "feeds.admin.search_sync_failed",
      context: expect.objectContaining({
        operation: "upsert",
        feedId: "feed_1",
        error: expect.objectContaining({ name: "UpstreamError" }),
      }),
    });
  });

  test("a caller outside the allowlist is Forbidden before anything is read", async () => {
    // No db methods are provided: any query would throw.
    const { layer } = environment({ db: {} });

    const error = await failureOf(
      update({ title: "x" }, HEADERS, "someone-else").pipe(Effect.provide(layer)),
    );

    expect(error).toMatchObject({ _tag: "Forbidden", code: "FEED_ADMIN_FORBIDDEN" });
  });
});

describe("adminDeleteGlobalFeed", () => {
  const remove = (user = ADMIN) => adminDeleteGlobalFeed(user, HEADERS, "feed_1");

  test("deletes the row, drops it from the index and logs", async () => {
    const { layer, logs, search } = environment();

    const result = await Effect.runPromise(remove().pipe(Effect.provide(layer)));

    expect(result).toEqual({ message: "Feed deleted" });
    expect(search.calls).toEqual([{ op: "remove", arg: "feed_1" }]);
    expect(logs.entries.map((entry) => entry.event)).toEqual(["feeds.admin.deleted"]);
  });

  test("fails with FEED_NOT_FOUND when no row was deleted", async () => {
    const { layer, search } = environment({ db: adminDb({ deleted: [] }).methods });

    const error = await failureOf(remove().pipe(Effect.provide(layer)));

    expect(error).toMatchObject({ _tag: "NotFound", code: "FEED_NOT_FOUND" });
    expect(search.calls).toHaveLength(0);
  });

  test("an index failure after a delete is logged and the delete still succeeds", async () => {
    const { layer, logs } = environment({ search: fakeSearch({ fail: true }) });

    await Effect.runPromise(remove().pipe(Effect.provide(layer)));

    expect(logs.entries).toContainEqual({
      level: "warn",
      event: "feeds.admin.search_sync_failed",
      context: expect.objectContaining({ operation: "delete", feedId: "feed_1" }),
    });
  });
});
