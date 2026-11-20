import { describe, expect, test } from "bun:test";
import { Effect, Fiber, Layer } from "effect";
import { TestClock } from "effect/testing";
import { FeedSearch, type FeedSearchDocument } from "@adapters/search/service";
import { scriptedHttpClient, type ScriptedRequest } from "@api-tests/support/http";
import { testConfig } from "@api-tests/support/layers";

const MEILI = {
  MEILI_URL: "http://meili.local/",
  MEILI_MASTER_KEY: "secret",
  MEILI_INDEX_FEEDS: "feeds_v2",
};

const document: FeedSearchDocument = {
  id: "a",
  url: "u",
  title: "t",
  description: null,
  link: null,
};

type Answer = Response | Error | Promise<Response>;

function searchWith(
  respond: (request: ScriptedRequest) => Answer,
  config: Record<string, string> = MEILI,
) {
  const requests: ScriptedRequest[] = [];
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
    Layer.provideMerge(TestClock.layer()),
  );
  const run = <A, E>(effect: Effect.Effect<A, E, FeedSearch>) =>
    Effect.runPromise(effect.pipe(Effect.provide(layer)) as Effect.Effect<A, E>);
  return { requests, run };
}

const ok = () => new Response(null, { status: 202 });
const withSearch = <A, E>(use: (search: FeedSearch["Service"]) => Effect.Effect<A, E>) =>
  FeedSearch.use(use);
const summary = (requests: ScriptedRequest[]) =>
  requests.map((request) => `${request.method} ${request.url}`);

describe("FeedSearch", () => {
  test("is a no-op that makes no requests when Meilisearch is not configured", async () => {
    const { requests, run } = searchWith(() => new Error("must not be called"), {});

    const result = await run(
      withSearch((search) =>
        Effect.gen(function* () {
          expect(search.isConfigured()).toBe(false);
          yield* search.upsert([document]);
          yield* search.remove("a");
          return yield* search.search("q", 5);
        }),
      ),
    );

    expect(result).toEqual([]);
    expect(requests).toEqual([]);
  });

  test("configures the index, then searches with the bearer key and the configured index", async () => {
    const { requests, run } = searchWith((request) =>
      request.url.endsWith("/search") ? Response.json({ hits: [{ id: "a" }] }) : ok(),
    );

    const hits = await run(withSearch((search) => search.search("rss", 7)));

    expect(hits).toEqual([{ id: "a" } as FeedSearchDocument]);
    expect(summary(requests)).toEqual([
      "POST http://meili.local/indexes",
      "PUT http://meili.local/indexes/feeds_v2/settings/searchable-attributes",
      "PUT http://meili.local/indexes/feeds_v2/settings/filterable-attributes",
      "POST http://meili.local/indexes/feeds_v2/search",
    ]);
    expect(requests.every((request) => request.headers.authorization === "Bearer secret")).toBe(
      true,
    );
    expect(JSON.parse(requests[0]?.body ?? "")).toEqual({ uid: "feeds_v2", primaryKey: "id" });
    expect(JSON.parse(requests[3]?.body ?? "")).toEqual({ q: "rss", limit: 7 });
  });

  test("treats an existing index (409) as configured and a malformed payload as no hits", async () => {
    const { run } = searchWith((request) =>
      request.url.endsWith("/indexes")
        ? new Response(null, { status: 409 })
        : request.url.endsWith("/search")
          ? Response.json({ unexpected: true })
          : ok(),
    );

    expect(await run(withSearch((search) => search.search("rss", 5)))).toEqual([]);
  });

  test("creates the index once per layer and retries after a failed creation", async () => {
    let settingsAttempts = 0;
    const { requests, run } = searchWith((request) => {
      if (request.url.endsWith("/searchable-attributes") && (settingsAttempts += 1) === 1) {
        return new Response(null, { status: 500 });
      }
      return ok();
    });

    const program = withSearch((search) =>
      Effect.gen(function* () {
        const first = yield* Effect.flip(search.upsert([document]));
        yield* search.upsert([document]);
        yield* search.upsert([document]);
        return first;
      }),
    );
    const first = await run(program);

    expect(first).toMatchObject({
      _tag: "Unavailable",
      code: "MEILI_SETTINGS_UPDATE_FAILED",
    });
    expect(requests.filter((request) => request.url.endsWith("/indexes"))).toHaveLength(2);
    expect(requests.filter((request) => request.url.endsWith("/documents"))).toHaveLength(2);
  });

  test("a rejected upsert fails with the Meilisearch code and status", async () => {
    const { run } = searchWith((request) =>
      request.url.endsWith("/documents") ? new Response("no", { status: 503 }) : ok(),
    );

    const error = await run(withSearch((search) => Effect.flip(search.upsert([document]))));

    expect(error).toMatchObject({
      _tag: "Unavailable",
      code: "MEILI_UPSERT_FAILED",
      message: "Meilisearch upsert failed (503)",
    });
  });

  test("a transport failure is an UpstreamError naming the request", async () => {
    const { run } = searchWith((request) =>
      request.url.endsWith("/search") ? new Error("connection refused") : ok(),
    );

    const error = await run(withSearch((search) => Effect.flip(search.search("rss", 5))));

    expect(error).toMatchObject({
      _tag: "UpstreamError",
      operation: "meili POST /indexes/feeds_v2/search",
    });
  });

  test("a request that never answers fails with MEILI_TIMEOUT instead of hanging", async () => {
    const { run } = searchWith(() => new Promise<Response>(() => {}));

    const error = await run(
      withSearch((search) =>
        Effect.gen(function* () {
          const fiber = yield* Effect.forkChild(Effect.flip(search.search("rss", 5)));
          yield* TestClock.adjust("11 seconds");
          return yield* Fiber.join(fiber);
        }),
      ),
    );

    expect(error).toMatchObject({ _tag: "Unavailable", code: "MEILI_TIMEOUT" });
  });

  test("remove treats a missing document as success and does not send a body", async () => {
    const { requests, run } = searchWith(() => new Response(null, { status: 404 }));

    await run(withSearch((search) => search.remove("feed/1")));

    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      method: "DELETE",
      url: "http://meili.local/indexes/feeds_v2/documents/feed%2F1",
      body: undefined,
    });
  });

  test("a failed remove carries MEILI_DELETE_FAILED", async () => {
    const { run } = searchWith(() => new Response(null, { status: 500 }));

    expect(await run(withSearch((search) => Effect.flip(search.remove("a"))))).toMatchObject({
      code: "MEILI_DELETE_FAILED",
    });
  });

  test("skips the request for an empty upsert", async () => {
    const { requests, run } = searchWith(() => new Error("must not be called"));

    await run(withSearch((search) => search.upsert([])));

    expect(requests).toEqual([]);
  });
});
