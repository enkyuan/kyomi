import { describe, expect, test } from "bun:test";
import { Effect, Layer } from "effect";
import { FeedSearch, type FeedSearchShape } from "@adapters/search/service";
import {
  createOrSubscribeToFeed,
  subscribeToExistingFeed,
} from "@modules/feeds/subscription/subscribe";
import { FeedBackground } from "@modules/feeds/service";
import { UpstreamError } from "@shared/effect/errors";
import { scriptedHttpClient } from "@api-tests/support/http";
import { fakeDb, recordingLogger, testConfig } from "@api-tests/support/layers";

const FEED_URL = "https://93.184.216.34/feed.xml";
const rss = `<?xml version="1.0"?><rss version="2.0"><channel><title>Example &amp; Co</title><link>https://site.example/</link><description>Notes</description></channel></rss>`;
const xml = () =>
  new Response(rss, { status: 200, headers: { "content-type": "application/rss+xml" } });

type Row = Record<string, unknown>;

/** A transaction over empty tables: records inserts and answers every select with `selected`. */
function fakeTransaction(selected: unknown[][] = []) {
  const inserts: Row[] = [];
  let selects = 0;
  const tx = {
    select: () => ({
      from: () => ({ where: () => ({ limit: async () => selected[selects++] ?? [] }) }),
    }),
    insert: () => ({
      values: (row: Row) => {
        inserts.push(row);
        return Object.assign(Promise.resolve(), {
          onConflictDoNothing: () => ({ returning: async () => [{ id: row.id }] }),
        });
      },
    }),
  };
  return { tx, inserts };
}

function environment(options: {
  topLevelSelect?: unknown[];
  transaction?: ReturnType<typeof fakeTransaction>;
  searchFails?: boolean;
}) {
  const transaction = options.transaction ?? fakeTransaction();
  let transactions = 0;
  const indexed: unknown[] = [];
  const background: Array<Effect.Effect<void, never, never>> = [];
  const search: FeedSearchShape = {
    isConfigured: () => true,
    upsert: (documents) => {
      indexed.push(...documents);
      return options.searchFails
        ? Effect.fail(new UpstreamError({ operation: "meili upsert", cause: new Error("down") }))
        : Effect.void;
    },
    remove: () => Effect.void,
    search: () => Effect.succeed([]),
  };
  const logs = recordingLogger();
  const layer = Layer.mergeAll(
    fakeDb({
      select: () => ({
        from: () => ({ where: () => ({ limit: async () => options.topLevelSelect ?? [] }) }),
      }),
      transaction: async (run: (tx: unknown) => unknown) => {
        transactions += 1;
        return run(transaction.tx);
      },
    }),
    scriptedHttpClient(xml),
    Layer.succeed(FeedSearch, FeedSearch.of(search)),
    // Background work is captured, not run: it would probe the network for a favicon.
    Layer.succeed(
      FeedBackground,
      FeedBackground.of({
        run: (task) =>
          Effect.sync(() => {
            background.push(task as Effect.Effect<void, never, never>);
          }),
      }),
    ),
    logs.layer,
    testConfig(),
  );
  return {
    layer,
    logs,
    indexed,
    background,
    inserts: transaction.inserts,
    transactions: () => transactions,
  };
}

describe("createOrSubscribeToFeed", () => {
  test("fetches a new feed, stores it and the subscription, indexes it and defers the favicon probe", async () => {
    const env = environment({});

    const result = await Effect.runPromise(
      createOrSubscribeToFeed("user-1", FEED_URL, {
        folderId: "folder-1",
        customTitle: " Mine ",
      }).pipe(Effect.provide(env.layer)),
    );

    expect(result).toMatchObject({
      url: FEED_URL,
      title: "Example & Co",
      link: "https://site.example/",
      faviconUrl: null,
      newFeed: true,
      newSubscription: true,
    });
    expect(env.inserts).toHaveLength(2);
    expect(env.inserts[0]).toMatchObject({
      id: result.feedId,
      url: FEED_URL,
      title: "Example & Co",
    });
    expect(env.inserts[1]).toMatchObject({
      id: result.subscriptionId,
      userId: "user-1",
      feedId: result.feedId,
      folderId: "folder-1",
      customTitle: "Mine",
    });
    expect(env.indexed).toEqual([
      expect.objectContaining({ id: result.feedId, url: FEED_URL, title: "Example & Co" }),
    ]);
    // No icon in the feed itself: the website favicon is probed after the response.
    expect(env.background).toHaveLength(1);
  });

  test("a search index outage is logged and the subscription still succeeds", async () => {
    const env = environment({ searchFails: true });

    const result = await Effect.runPromise(
      createOrSubscribeToFeed("user-1", FEED_URL, { folderId: "folder-1" }).pipe(
        Effect.provide(env.layer),
      ),
    );

    expect(result.newSubscription).toBe(true);
    expect(env.logs.entries).toContainEqual({
      level: "warn",
      event: "feeds.search_index.failed",
      context: expect.objectContaining({
        feedId: result.feedId,
        url: FEED_URL,
        error: expect.objectContaining({ name: "UpstreamError" }),
      }),
    });
  });

  test("an already known URL subscribes to the stored feed without fetching it", async () => {
    const stored = {
      id: "feed-9",
      url: FEED_URL,
      title: "Stored",
      link: null,
      faviconUrl: "https://93.184.216.34/icon.png",
      faviconSource: "html_link",
    };
    const env = environment({
      topLevelSelect: [{ id: "feed-9" }],
      transaction: fakeTransaction([[stored]]),
    });

    const result = await Effect.runPromise(
      createOrSubscribeToFeed("user-1", FEED_URL, { folderId: "folder-1" }).pipe(
        Effect.provide(
          Layer.mergeAll(
            env.layer,
            scriptedHttpClient(() => new Error("no network")),
          ),
        ),
      ),
    );

    expect(result).toMatchObject({ feedId: "feed-9", title: "Stored", newFeed: false });
    expect(env.background).toHaveLength(0);
  });

  test("an invalid URL fails as INVALID_FEED_URL before any transaction", async () => {
    const env = environment({});

    const error = await Effect.runPromise(
      Effect.flip(createOrSubscribeToFeed("user-1", "ftp://example.com/feed", {})).pipe(
        Effect.provide(env.layer),
      ),
    );

    expect(error).toMatchObject({ _tag: "BadRequest", code: "INVALID_FEED_URL" });
    expect(env.transactions()).toBe(0);
  });
});

describe("subscribeToExistingFeed", () => {
  test("fails with FEED_NOT_FOUND for an unknown feed id", async () => {
    const env = environment({ transaction: fakeTransaction([[]]) });

    const error = await Effect.runPromise(
      Effect.flip(subscribeToExistingFeed("user-1", "missing")).pipe(Effect.provide(env.layer)),
    );

    expect(error).toMatchObject({ _tag: "NotFound", code: "FEED_NOT_FOUND" });
  });
});
