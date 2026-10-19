import { afterEach, describe, expect, test } from "bun:test";
import {
  classifyFeedEmbedding,
  classifyItemEmbeddings,
  embedTexts,
  type EmbeddingClassifierConfig,
} from "@kyomi/worker";
import { FAKE_CATEGORY_MODEL } from "./fake-category-model";

const originalFetch = globalThis.fetch;
const FAKE_CONFIG: EmbeddingClassifierConfig = {
  apiKey: "test-key",
  apiUrl: "https://fake-embeddings.test/embed",
  categoryModel: FAKE_CATEGORY_MODEL,
};
const UNIT_X = [1, 0, 0];

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("embedding requests at scale", () => {
  // Halfway between Software Engineering and no category: the fake head gives it about 0.5.
  const HALF_MATCH = [1, 0, 1];
  const feedInput = {
    feedTitle: "Feed",
    feedDescription: null,
    feedUrl: "https://example.com/feed",
    feedSiteUrl: "https://example.com",
    sourceKind: "rss",
  };
  const itemInput = {
    feedTitle: "Feed",
    feedDescription: null,
    feedUrl: "https://example.com/feed",
    feedSiteUrl: "https://example.com",
    sourceKind: "rss",
    itemTitle: "Some article",
    itemSummary: null,
    itemUrl: null,
  };

  /** Embeds every text as `itemVector`, failing request number `failRequest`. */
  function fakeEmbeddingsApi(options: { itemVector?: number[]; failRequest?: number } = {}) {
    const requests: string[][] = [];
    globalThis.fetch = (async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string) as { input: string[] };
      requests.push(body.input);
      if (requests.length === options.failRequest) {
        return new Response("rate limited", { status: 429 });
      }
      const data = body.input.map((_, index) => ({
        embedding: options.itemVector ?? UNIT_X,
        index,
      }));
      return new Response(JSON.stringify({ data }), { status: 200 });
    }) as unknown as typeof fetch;
    return requests;
  }

  function batchInputs(count: number) {
    return Array.from({ length: count }, (_, index) => ({ ...itemInput, id: `item-${index}` }));
  }

  test("embedTexts sends large batches as several bounded requests", async () => {
    const requests = fakeEmbeddingsApi();
    const texts = Array.from({ length: 300 }, (_, index) => `text-${index}`);

    const vectors = await embedTexts(texts, FAKE_CONFIG);

    expect(requests.map((input) => input.length)).toEqual([128, 128, 44]);
    expect(vectors).toHaveLength(300);
  });

  test("embedTexts caps long texts and splits requests by total size", async () => {
    // Long articles must not add up past the provider's per-request token limit.
    const requests = fakeEmbeddingsApi();
    const texts = Array.from({ length: 40 }, (_, index) => `${index}`.padEnd(20_000, "x"));

    const vectors = await embedTexts(texts, FAKE_CONFIG);

    expect(vectors).toHaveLength(40);
    expect(requests.map((input) => input.length)).toEqual([33, 7]);
    for (const input of requests) {
      expect(input.reduce((chars, text) => chars + text.length, 0)).toBeLessThanOrEqual(200_000);
      expect(input.every((text) => text.length < 6_100 && text.includes("[truncated]"))).toBe(true);
    }
  });

  test("embedTexts keeps capped text valid UTF-16 at both cuts", async () => {
    const requests = fakeEmbeddingsApi();
    // The emoji pairs straddle the head cut (index 4,500) and the tail cut (1,500 from the end).
    const text = `${"a".repeat(4_499)}😀${"b".repeat(2_000)}😀${"c".repeat(1_499)}`;

    await embedTexts([text], FAKE_CONFIG);

    const [sent] = requests[0] ?? [];
    expect(sent).toContain("[truncated]");
    expect(sent).not.toMatch(
      /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/,
    );
  });

  test("classifyItemEmbeddings keeps the results of requests that succeed", async () => {
    // Request 1 embeds items 0-127, request 2 items 128-129.
    fakeEmbeddingsApi({ failRequest: 2 });

    const results = await classifyItemEmbeddings(batchInputs(130), FAKE_CONFIG);

    expect(results.size).toBe(128);
    expect(results.get("item-0")?.categories[0]?.label).toBe("Software Engineering");
    expect(results.has("item-128")).toBe(false);
    expect(results.has("item-129")).toBe(false);
  });

  test("classifyItemEmbeddings throws when every request fails", async () => {
    fakeEmbeddingsApi({ failRequest: 1 });

    await expect(classifyItemEmbeddings(batchInputs(3), FAKE_CONFIG)).rejects.toThrow(/429/);
  });

  test("classifyItemEmbeddings applies itemMinProbability", async () => {
    fakeEmbeddingsApi({ itemVector: HALF_MATCH });

    const strict = await classifyItemEmbeddings(batchInputs(1), {
      ...FAKE_CONFIG,
      itemMinProbability: 0.6,
    });
    const lenient = await classifyItemEmbeddings(batchInputs(1), {
      ...FAKE_CONFIG,
      itemMinProbability: 0.4,
    });

    expect(strict.get("item-0")?.categories).toEqual([]);
    expect(lenient.get("item-0")?.categories.map((category) => category.label)).toEqual([
      "Software Engineering",
    ]);
  });

  test("classifyFeedEmbedding uses the feed floor, not the item floor", async () => {
    fakeEmbeddingsApi({ itemVector: HALF_MATCH });

    const itemKnobOnly = await classifyFeedEmbedding(feedInput, {
      ...FAKE_CONFIG,
      itemMinProbability: 0.9,
    });
    const feedKnob = await classifyFeedEmbedding(feedInput, {
      ...FAKE_CONFIG,
      feedMinProbability: 0.6,
    });

    expect(itemKnobOnly.categories.map((category) => category.label)).toEqual([
      "Software Engineering",
    ]);
    expect(feedKnob.categories).toEqual([{ label: "Miscellaneous", confidence: 0.1 }]);
  });
});
