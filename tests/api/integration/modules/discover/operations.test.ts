import { describe, expect, test } from "bun:test";
import { Effect, Layer } from "effect";
import { FeedSearch } from "@adapters/search/service";
import { previewFeedFromUrl, searchFeeds } from "@modules/discover/operations";
import { fakeDb, recordingLogger, testConfig } from "@api-tests/support/layers";
import { scriptedHttpClient } from "@api-tests/support/http";
import { selectsReturning } from "./helpers";

const MEILI = { MEILI_URL: "http://meili.local", MEILI_MASTER_KEY: "test-key" };

type Request = { method: string; url: string };

/** `FeedSearch` over a scripted Meilisearch: `hits` answer searches, everything else succeeds. */
function meili(
  respond: (request: Request) => Response | Error,
  config: Record<string, string> = MEILI,
) {
  const requests: Request[] = [];
  const layer = FeedSearch.layer.pipe(
    Layer.provide(
      Layer.mergeAll(
        scriptedHttpClient((request) => {
          requests.push(request);
          return respond(request);
        }),
        testConfig(config),
      ),
    ),
  );
  return { requests, layer };
}

const healthyMeili = (hits: unknown[]) => (request: Request) => {
  if (request.url.endsWith("/indexes")) {
    return new Response(null, { status: 409 });
  }
  if (request.url.includes("/settings/")) {
    return new Response(null, { status: 202 });
  }
  return Response.json({ hits });
};

const feedRow = (overrides: Record<string, unknown> = {}) => ({
  id: "feed_1",
  url: "https://example.com/feed.xml",
  title: "Example Feed",
  description: "Latest updates",
  link: "https://example.com",
  faviconUrl: null,
  isSubscribed: false,
  ...overrides,
});

const meiliHit = (overrides: Record<string, unknown> = {}) => ({
  id: "feed_1",
  url: "https://example.com/feed.xml",
  title: "Example Feed",
  description: "Latest updates",
  link: "https://example.com",
  faviconUrl: null,
  ...overrides,
});

function harness(options: {
  db: ReturnType<typeof selectsReturning>;
  search: Layer.Layer<FeedSearch, unknown>;
}) {
  const logs = recordingLogger();
  const layer = Layer.mergeAll(fakeDb({ select: options.db.select }), logs.layer, options.search);
  return {
    logs,
    run: <A, E>(effect: Effect.Effect<A, E, Layer.Success<typeof layer>>) =>
      Effect.runPromise(effect.pipe(Effect.provide(layer))),
  };
}

describe("searchFeeds", () => {
  test("trims input and maps Meilisearch hits to followable feeds", async () => {
    const search = meili(
      healthyMeili([
        meiliHit({ title: "Example &#8216;Feed&#8217;", description: "Latest &amp; updates" }),
      ]),
    );
    const db = selectsReturning([
      feedRow({
        title: "Example &#8216;Feed&#8217;",
        description: "Latest &amp; updates",
        isSubscribed: true,
      }),
    ]);

    const result = await harness({ db, search: search.layer }).run(
      searchFeeds("user_1", "  example  ", 10),
    );

    expect(result).toEqual([
      feedRow({
        title: "Example ‘Feed’",
        description: "Latest & updates",
        isSubscribed: true,
      }),
    ]);
    expect(search.requests.at(-1)).toMatchObject({ method: "POST" });
    expect(search.requests.at(-1)?.url).toBe("http://meili.local/indexes/feeds/search");
  });

  test("keeps stale Meilisearch hits followable by URL and says so", async () => {
    const search = meili(
      healthyMeili([
        meiliHit({
          id: "missing_feed",
          url: "https://stale.example/feed.xml",
          title: "Stale Feed",
          description: "No longer in Postgres",
          link: "https://stale.example",
        }),
        meiliHit(),
      ]),
    );
    const test = harness({ db: selectsReturning([feedRow()]), search: search.layer });

    const result = await test.run(searchFeeds("user_1", "example", 10));

    expect(result).toEqual([
      {
        id: null,
        url: "https://stale.example/feed.xml",
        title: "Stale Feed",
        description: "No longer in Postgres",
        link: "https://stale.example",
        faviconUrl: null,
        isSubscribed: false,
      },
      feedRow(),
    ]);
    expect(test.logs.entries).toContainEqual({
      level: "warn",
      event: "discover.search.meili_stale_hits",
      context: { userId: "user_1", query: "example", limit: 10, staleHitCount: 1 },
    });
  });

  test("returns nothing for blank input without touching either backend", async () => {
    const search = meili(() => new Error("must not be called"));
    const db = selectsReturning();

    const result = await harness({ db, search: search.layer }).run(searchFeeds("user_1", "   "));

    expect(result).toEqual([]);
    expect(search.requests).toEqual([]);
    expect(db.calls).toBe(0);
  });

  test("returns an empty list, without a Postgres fallback, when Meilisearch has no hits", async () => {
    const search = meili(healthyMeili([]));
    const db = selectsReturning([feedRow()]);

    const result = await harness({ db, search: search.layer }).run(
      searchFeeds("user_1", "example", 10),
    );

    expect(result).toEqual([]);
    expect(db.calls).toBe(0);
  });

  test("returns an empty list, with no Postgres fallback, when Meilisearch fails, and says so", async () => {
    const search = meili((request) =>
      request.url.endsWith("/search")
        ? new Response("meili is down", { status: 503 })
        : healthyMeili([])(request),
    );
    const db = selectsReturning([{ ...feedRow(), score: 3 }]);
    const test = harness({ db, search: search.layer });

    const result = await test.run(searchFeeds("user_1", "example", 10));

    expect(result).toEqual([]);
    expect(db.calls).toBe(0);
    expect(test.logs.entries).toContainEqual({
      level: "warn",
      event: "discover.search.meili_fallback",
      context: expect.objectContaining({
        userId: "user_1",
        limit: 40,
        errorCode: "MEILI_SEARCH_FAILED",
      }),
    });
  });

  test("returns an empty list when Meilisearch is unreachable", async () => {
    const search = meili(() => new Error("connection refused"));
    const db = selectsReturning([{ ...feedRow(), score: 4 }]);
    const test = harness({ db, search: search.layer });

    expect(await test.run(searchFeeds("user_1", "example", 10))).toEqual([]);
    expect(db.calls).toBe(0);
    expect(test.logs.entries.map((entry) => entry.event)).toContain(
      "discover.search.meili_fallback",
    );
  });

  test("returns an empty list when the Postgres join over Meilisearch hits fails", async () => {
    const search = meili(healthyMeili([meiliHit()]));
    const db = {
      select: () => {
        throw new Error("postgres is down");
      },
      calls: 0,
    };
    const test = harness({ db, search: search.layer });

    expect(await test.run(searchFeeds("user_1", "example", 10))).toEqual([]);
    expect(test.logs.entries.map((entry) => entry.event)).toContain(
      "discover.search.meili_fallback",
    );
  });

  test("uses Postgres alone when Meilisearch is not configured", async () => {
    const search = meili(() => new Error("must not be called"), {});
    const db = selectsReturning([{ ...feedRow(), score: 0 }]);

    const result = await harness({ db, search: search.layer }).run(
      searchFeeds("user_1", "example", 10),
    );

    expect(result).toEqual([feedRow()]);
    expect(search.requests).toEqual([]);
  });

  test("collapses duplicate results and logs how many", async () => {
    const search = meili(() => new Error("unused"), {});
    const db = selectsReturning([
      { ...feedRow({ id: "a", url: "https://example.com/feed.xml" }), score: 0 },
      {
        ...feedRow({ id: "b", url: "https://example.com/feed.xml/", isSubscribed: true }),
        score: 0,
      },
    ]);
    const test = harness({ db, search: search.layer });

    const result = await test.run(searchFeeds("user_1", "example", 10));

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: "b", isSubscribed: true });
    expect(test.logs.entries).toContainEqual({
      level: "info",
      event: "discover.search.deduped",
      context: expect.objectContaining({ duplicateCount: 1, source: "database" }),
    });
  });

  test("creates the index once and retries creation after a failure", async () => {
    let failIndexCreation = true;
    const search = meili((request) => {
      if (request.url.endsWith("/indexes") && failIndexCreation) {
        failIndexCreation = false;
        return new Response(null, { status: 500 });
      }
      return healthyMeili([meiliHit()])(request);
    });
    const db = selectsReturning([{ ...feedRow(), score: 4 }], [feedRow()], [feedRow()]);
    const test = harness({ db, search: search.layer });

    await test.run(
      Effect.gen(function* () {
        yield* searchFeeds("user_1", "one", 10);
        yield* searchFeeds("user_1", "two", 10);
        yield* searchFeeds("user_1", "three", 10);
      }),
    );

    const creations = search.requests.filter((request) => request.url.endsWith("/indexes"));
    expect(creations).toHaveLength(2);
  });
});

describe("previewFeedFromUrl", () => {
  const feedXml = `<?xml version="1.0"?><rss version="2.0"><channel><title>Fresh &amp; New</title><link>https://site.example/</link><description>D</description></channel></rss>`;

  test("answers from the database for a feed already known by URL", async () => {
    const db = selectsReturning([
      feedRow({ title: "Known &amp; Loved", description: null, isSubscribed: true }),
    ]);
    const http = scriptedHttpClient(() => new Error("must not be called"));
    const search = meili(() => new Error("unused"), {});
    const test = harness({ db, search: search.layer });

    const preview = await test.run(
      previewFeedFromUrl("user_1", "https://example.com/feed.xml").pipe(Effect.provide(http)),
    );

    expect(preview).toEqual({
      id: "feed_1",
      url: "https://example.com/feed.xml",
      title: "Known & Loved",
      description: "",
      link: "https://example.com",
      faviconUrl: null,
      isSubscribed: true,
    });
  });

  test("fetches an unknown feed and reports it as not followed", async () => {
    const db = selectsReturning([], []);
    const http = scriptedHttpClient(
      () => new Response(feedXml, { status: 200, headers: { "content-type": "application/xml" } }),
    );
    const search = meili(() => new Error("unused"), {});
    const test = harness({ db, search: search.layer });

    const preview = await test.run(
      previewFeedFromUrl("user_1", "https://93.184.216.34/feed.xml").pipe(Effect.provide(http)),
    );

    expect(preview).toEqual({
      id: null,
      url: "https://93.184.216.34/feed.xml",
      title: "Fresh & New",
      description: "D",
      link: "https://site.example/",
      faviconUrl: null,
      isSubscribed: false,
    });
  });

  test("fails with the feed's wire error when the URL cannot be fetched", async () => {
    const db = selectsReturning([]);
    const http = scriptedHttpClient(() => new Response("nope", { status: 500 }));
    const search = meili(() => new Error("unused"), {});

    const error = await harness({ db, search: search.layer }).run(
      previewFeedFromUrl("user_1", "https://93.184.216.34/feed.xml").pipe(
        Effect.provide(http),
        Effect.flip,
      ),
    );

    expect(error).toMatchObject({
      _tag: "Unprocessable",
      code: "FEED_FETCH_FAILED",
      details: { fetchCode: "HTTP_ERROR", fetchStatus: 500 },
    });
  });
});
