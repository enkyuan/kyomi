import { describe, expect, test } from "bun:test";
import { Effect, Layer } from "effect";
import { FeedSearch, type FeedSearchDocument } from "@adapters/search/service";
import { scriptedHttpClient, type ScriptedRequest } from "@api-tests/support/http";
import { testConfig } from "@api-tests/support/layers";

const enrichedDocument: FeedSearchDocument = {
  id: "feed-1",
  url: "https://a.example.com/rss",
  title: "Alpha",
  description: "An example feed",
  link: "https://a.example.com",
  faviconUrl: null,
  sourceKind: "rss",
  language: "en",
  categories: ["engineering"],
  contentType: "article",
  qualityScore: 0.9,
  domain: "a.example.com",
};

function upsertWith(config: Record<string, string>) {
  const requests: ScriptedRequest[] = [];
  const layer = FeedSearch.layer.pipe(
    Layer.provide(
      Layer.mergeAll(
        scriptedHttpClient((request) => {
          requests.push(request);
          return new Response(null, { status: 202 });
        }),
        testConfig(config),
      ),
    ),
  );
  const run = FeedSearch.use((search) => search.upsert([enrichedDocument])).pipe(
    Effect.provide(layer),
  );
  return { requests, run };
}

describe("feed search document", () => {
  test("sends the source metadata fields (sourceKind, language, categories, contentType, domain)", async () => {
    const { requests, run } = upsertWith({ MEILI_URL: "http://meili.local" });

    await Effect.runPromise(run);

    const upsert = requests.find((request) => request.url.endsWith("/documents"));
    expect(JSON.parse(upsert?.body ?? "[]")).toEqual([enrichedDocument]);
  });

  test("upsert is a safe no-op when Meili is not configured", async () => {
    const { requests, run } = upsertWith({});

    await expect(Effect.runPromise(run)).resolves.toBeUndefined();
    expect(requests).toEqual([]);
  });
});
