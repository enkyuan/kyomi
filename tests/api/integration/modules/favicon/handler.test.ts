import { describe, expect, test } from "bun:test";
import { Effect, Layer } from "effect";
import { TestClock } from "effect/testing";
import type { FaviconHostStore, PersistedFaviconHostResult } from "@kyomi/ingest/favicon";
import { handleFaviconRequestWithStore } from "@modules/favicon/handler";
import { FaviconResolver } from "@modules/favicon/service";
import { DatabaseError } from "@shared/effect/errors";
import { MemoryFaviconHostStore, ORIGIN } from "./store";

const ICON_URL = `${ORIGIN}/icon-256.png`;
const HOSTNAME = new URL(ORIGIN).hostname;

function faviconRequest(rawDomain: string) {
  return new Request(`https://kyomi.test/api/favicon?domain=${encodeURIComponent(rawDomain)}`);
}

const hit = (url = ICON_URL): PersistedFaviconHostResult => ({
  kind: "hit",
  origin: ORIGIN,
  hostname: HOSTNAME,
  url,
  source: "html_link",
  contentType: null,
});

const miss: PersistedFaviconHostResult = {
  kind: "miss",
  origin: ORIGIN,
  hostname: HOSTNAME,
  errorCode: "not_found",
};

type ResolverScript = {
  /** Answers each `resolveHost` call in order; the last answer repeats. */
  resolveHost?: Array<PersistedFaviconHostResult | null | DatabaseError>;
  fetchImage?: (url: string) => Response | null;
};

/** A `FaviconResolver` that answers from a script and records what the handler asked for. */
function scriptedResolver(script: ResolverScript = {}) {
  const resolveCalls: Array<{ origin: string; forceRefresh: boolean }> = [];
  const fetchCalls: string[] = [];
  const answers = script.resolveHost ?? [];
  const layer = Layer.succeed(
    FaviconResolver,
    FaviconResolver.of({
      resolveHost: (_store, origin, options) => {
        resolveCalls.push({ origin, forceRefresh: options?.forceRefresh ?? false });
        const answer = answers[Math.min(resolveCalls.length - 1, answers.length - 1)] ?? null;
        return answer instanceof DatabaseError ? Effect.fail(answer) : Effect.succeed(answer);
      },
      fetchImage: (url) => {
        fetchCalls.push(url);
        return Effect.succeed(script.fetchImage?.(url) ?? null);
      },
    }),
  );
  return { layer, resolveCalls, fetchCalls };
}

const png = () => new Response("png", { headers: { "content-type": "image/png" } });

function handle(layer: Layer.Layer<FaviconResolver>, store: FaviconHostStore, rawDomain: string) {
  return Effect.runPromise(
    handleFaviconRequestWithStore(store, faviconRequest(rawDomain)).pipe(Effect.provide(layer)),
  );
}

describe("favicon request handler", () => {
  test("rejects invalid domains without resolving anything", async () => {
    const { layer, resolveCalls, fetchCalls } = scriptedResolver();

    const response = await handle(layer, new MemoryFaviconHostStore(), "not-a-url");

    expect(response.status).toBe(400);
    expect(await response.text()).toBe("Invalid domain");
    expect(resolveCalls).toHaveLength(0);
    expect(fetchCalls).toHaveLength(0);
  });

  test("answers 400 when the resolver rejects the origin", async () => {
    const { layer } = scriptedResolver({ resolveHost: [null] });

    const response = await handle(layer, new MemoryFaviconHostStore(), ORIGIN);

    expect(response.status).toBe(400);
  });

  test("an unsafe host is cached as a miss through the real resolver and never served", async () => {
    // The live layer is the ingest resolver: `localhost` fails its safety check before any fetch.
    const store = new MemoryFaviconHostStore();

    const response = await handle(FaviconResolver.layer, store, "http://localhost");

    expect(response.status).toBe(404);
    expect(store.rows.get("http://localhost")?.status).toBe("miss");
  });

  test("serves a resolved favicon with cache headers and records its content type", async () => {
    const store = new MemoryFaviconHostStore();
    store.seedHit({ resolvedUrl: ICON_URL });
    const { layer, fetchCalls } = scriptedResolver({
      resolveHost: [hit()],
      fetchImage: (url) => (url === ICON_URL ? png() : null),
    });

    const response = await handle(layer, store, ORIGIN);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("cache-control")).toBe(
      "public, max-age=604800, stale-while-revalidate=2592000",
    );
    expect(response.headers.get("vary")).toBe("Accept");
    expect(await response.text()).toBe("png");
    expect(fetchCalls).toEqual([ICON_URL]);
    expect(store.rows.get(ORIGIN)?.contentType).toBe("image/png");
  });

  test("defaults the content type of an image served without one", async () => {
    const { layer } = scriptedResolver({
      resolveHost: [hit()],
      fetchImage: () => new Response("ico"),
    });

    const response = await handle(layer, new MemoryFaviconHostStore(), ORIGIN);

    expect(response.headers.get("content-type")).toBe("image/x-icon");
  });

  test("never serves a content type the upstream picked unless it is an image", async () => {
    for (const declared of [
      "text/html; charset=utf-8",
      "application/octet-stream",
      "text/x-icon",
      "image/x-icon/../html",
      "image/",
      "image/svg xml",
    ]) {
      const { layer } = scriptedResolver({
        resolveHost: [hit()],
        fetchImage: () =>
          new Response("<script>alert(1)</script>", { headers: { "content-type": declared } }),
      });

      const response = await handle(layer, new MemoryFaviconHostStore(), ORIGIN);

      expect(response.headers.get("content-type")).toBe("image/x-icon");
    }
  });

  test("passes an ordinary image type through", async () => {
    for (const declared of [
      "image/png",
      "image/svg+xml",
      "image/vnd.microsoft.icon; charset=binary",
    ]) {
      const { layer } = scriptedResolver({
        resolveHost: [hit()],
        fetchImage: () => new Response("img", { headers: { "content-type": declared } }),
      });

      const response = await handle(layer, new MemoryFaviconHostStore(), ORIGIN);

      expect(response.headers.get("content-type")).toBe(declared.split(";")[0]);
    }
  });

  test("sandboxes every favicon so a scriptable image opened as a document cannot run", async () => {
    const { layer } = scriptedResolver({
      resolveHost: [hit()],
      fetchImage: () =>
        new Response("<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>", {
          headers: { "content-type": "image/svg+xml" },
        }),
    });

    const response = await handle(layer, new MemoryFaviconHostStore(), ORIGIN);

    expect(response.headers.get("content-type")).toBe("image/svg+xml");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("content-security-policy")).toContain("sandbox");
    expect(response.headers.get("content-security-policy")).toContain("default-src 'none'");
  });

  test("stops reading an oversized body that declares no length", async () => {
    let pulls = 0;
    let cancelled = false;
    const chunk = new Uint8Array(40 * 1024);
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulls += 1;
        controller.enqueue(chunk);
      },
      cancel() {
        cancelled = true;
      },
    });
    const { layer } = scriptedResolver({
      resolveHost: [hit()],
      fetchImage: () => new Response(body, { headers: { "content-type": "image/png" } }),
    });

    const response = await handle(layer, new MemoryFaviconHostStore(), ORIGIN);

    expect(response.status).toBe(404);
    expect(cancelled).toBe(true);
    expect(pulls).toBeLessThanOrEqual(4);
  });

  test("a cached miss answers 404 with the short miss cache and fetches nothing", async () => {
    const { layer, resolveCalls, fetchCalls } = scriptedResolver({ resolveHost: [miss] });

    const response = await handle(layer, new MemoryFaviconHostStore(), ORIGIN);

    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toBe(
      "public, max-age=120, stale-while-revalidate=600",
    );
    expect(resolveCalls).toEqual([{ origin: ORIGIN, forceRefresh: false }]);
    expect(fetchCalls).toHaveLength(0);
  });

  test("re-resolves with a forced refresh when the cached icon no longer fetches", async () => {
    const store = new MemoryFaviconHostStore();
    const refreshedUrl = `${ORIGIN}/new-icon.png`;
    const { layer, resolveCalls, fetchCalls } = scriptedResolver({
      resolveHost: [hit(), hit(refreshedUrl)],
      fetchImage: (url) => (url === refreshedUrl ? png() : null),
    });

    const response = await handle(layer, store, ORIGIN);

    expect(response.status).toBe(200);
    expect(resolveCalls.map((call) => call.forceRefresh)).toEqual([false, true]);
    expect(fetchCalls).toEqual([ICON_URL, refreshedUrl]);
  });

  test("answers 404 when the refresh resolves to a miss or still cannot fetch", async () => {
    const refreshedMiss = scriptedResolver({ resolveHost: [hit(), miss] });
    expect((await handle(refreshedMiss.layer, new MemoryFaviconHostStore(), ORIGIN)).status).toBe(
      404,
    );
    expect(refreshedMiss.fetchCalls).toEqual([ICON_URL]);

    const unfetchable = scriptedResolver({ resolveHost: [hit(), hit()] });
    expect((await handle(unfetchable.layer, new MemoryFaviconHostStore(), ORIGIN)).status).toBe(
      404,
    );
    expect(unfetchable.fetchCalls).toEqual([ICON_URL, ICON_URL]);
  });

  test("negative-caches oversized favicon responses for the miss TTL and does not refresh", async () => {
    const store = new MemoryFaviconHostStore();
    store.seedHit({ resolvedUrl: ICON_URL });
    const { layer, resolveCalls } = scriptedResolver({
      resolveHost: [hit()],
      fetchImage: () =>
        new Response(new Uint8Array(65 * 1024), { headers: { "content-type": "image/png" } }),
    });

    const response = await Effect.runPromise(
      Effect.gen(function* () {
        yield* TestClock.setTime(1_000_000);
        return yield* handleFaviconRequestWithStore(store, faviconRequest(ORIGIN));
      }).pipe(Effect.provide(Layer.mergeAll(layer, TestClock.layer()))),
    );

    expect(response.status).toBe(404);
    expect(resolveCalls).toHaveLength(1);
    const row = store.rows.get(ORIGIN);
    expect(row?.status).toBe("miss");
    expect(row?.errorCode).toBe("response_too_large");
    expect(row?.expiresAt?.getTime()).toBe(1_000_000 + 120_000);
  });

  test("a resolver store failure is a typed DatabaseError, not a response", async () => {
    const failure = new DatabaseError({ operation: "favicon.resolve_host", cause: new Error("x") });
    const { layer } = scriptedResolver({ resolveHost: [failure] });

    const error = await Effect.runPromise(
      Effect.flip(
        handleFaviconRequestWithStore(new MemoryFaviconHostStore(), faviconRequest(ORIGIN)).pipe(
          Effect.provide(layer),
        ),
      ),
    );

    expect(error).toBe(failure);
  });

  test("a failing store write while recording metadata is a typed DatabaseError", async () => {
    const store = new MemoryFaviconHostStore();
    store.updateResponseMetadata = async () => {
      throw new Error("connection lost");
    };
    const { layer } = scriptedResolver({ resolveHost: [hit()], fetchImage: () => png() });

    const error = await Effect.runPromise(
      Effect.flip(
        handleFaviconRequestWithStore(store, faviconRequest(ORIGIN)).pipe(Effect.provide(layer)),
      ),
    );

    expect(error).toMatchObject({
      _tag: "DatabaseError",
      operation: "favicon.update_metadata",
    });
  });
});
