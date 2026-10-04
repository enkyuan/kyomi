import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  classifyFeedEmbedding,
  classifyItemEmbedding,
  classifyItemEmbeddings,
  embedTexts,
  resetPrototypeCache,
  type EmbeddingClassifierConfig,
} from "@kyomi/worker";

const originalFetch = globalThis.fetch;
const FAKE_CONFIG: EmbeddingClassifierConfig = {
  apiKey: "test-key",
  apiUrl: "https://fake.voyage.test/v1/embeddings",
};

/**
 * Deterministic 3-dimensional "embeddings" — real Voyage vectors are much higher-dimensional,
 * but cosine similarity is dimension-agnostic, so a small hand-computable space is enough to
 * verify the classifier's scoring/threshold/fallback logic without needing real semantics.
 */
const UNIT_X = [1, 0, 0];
const UNIT_Y = [0, 1, 0];
const ORTHOGONAL_Z = [0, 0, 1];

beforeEach(() => {
  resetPrototypeCache();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  resetPrototypeCache();
});

describe("embedTexts", () => {
  test("returns one vector per input, sorted by response index", async () => {
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string) as { input: string[] };
      expect(body.input).toEqual(["a", "b"]);
      // Respond with indices reversed to verify embedTexts re-sorts by index rather than
      // trusting array order.
      return new Response(
        JSON.stringify({
          data: [
            { embedding: UNIT_Y, index: 1 },
            { embedding: UNIT_X, index: 0 },
          ],
        }),
        { status: 200 },
      );
    }) as unknown as typeof fetch;

    const result = await embedTexts(["a", "b"], FAKE_CONFIG);
    expect(result).toEqual([UNIT_X, UNIT_Y]);
  });

  test("returns an empty array without calling fetch for an empty input list", async () => {
    let called = false;
    globalThis.fetch = (async () => {
      called = true;
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;

    const result = await embedTexts([], FAKE_CONFIG);
    expect(result).toEqual([]);
    expect(called).toBe(false);
  });

  test("throws with the response body when the API call fails", async () => {
    globalThis.fetch = (async () =>
      new Response("rate limited", { status: 429 })) as unknown as typeof fetch;

    await expect(embedTexts(["a"], FAKE_CONFIG)).rejects.toThrow(/429/);
  });

  test("rejects a response with fewer vectors than inputs", async () => {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ data: [{ embedding: UNIT_X, index: 0 }] }), {
        status: 200,
      })) as unknown as typeof fetch;

    await expect(embedTexts(["a", "b"], FAKE_CONFIG)).rejects.toThrow(/1 vectors for 2 inputs/);
  });

  test("rejects a response whose indices skip an input", async () => {
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          data: [
            { embedding: UNIT_X, index: 0 },
            { embedding: UNIT_Y, index: 0 },
          ],
        }),
        { status: 200 },
      )) as unknown as typeof fetch;

    await expect(embedTexts(["a", "b"], FAKE_CONFIG)).rejects.toThrow(/did not match/);
  });

  test("aborts requests when timeoutMs elapses", async () => {
    globalThis.fetch = (async (_url: string, init: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        const signal = init.signal as AbortSignal;
        expect(signal).toBeInstanceOf(AbortSignal);
        signal.addEventListener("abort", () => reject(new Error("aborted")));
      })) as unknown as typeof fetch;

    await expect(embedTexts(["a"], { ...FAKE_CONFIG, timeoutMs: 1 })).rejects.toThrow("aborted");
  });
});

describe("classifyItemEmbedding", () => {
  test("batches multiple item texts in one embeddings request after prototypes are cached", async () => {
    const inputs: string[][] = [];
    globalThis.fetch = (async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string) as { input: string[] };
      inputs.push(body.input);
      if (inputs.length === 1) {
        const embeddings = body.input.map((_, i) => (i < 4 ? UNIT_X : ORTHOGONAL_Z));
        return new Response(
          JSON.stringify({ data: embeddings.map((e, i) => ({ embedding: e, index: i })) }),
          { status: 200 },
        );
      }

      expect(body.input).toEqual(["First item. Detailed body", "Second item. Other body"]);
      return new Response(
        JSON.stringify({
          data: [
            { embedding: UNIT_X, index: 0 },
            { embedding: UNIT_Y, index: 1 },
          ],
        }),
        { status: 200 },
      );
    }) as unknown as typeof fetch;

    const result = await classifyItemEmbeddings(
      [
        {
          id: "item-1",
          feedTitle: "Feed",
          feedDescription: null,
          feedUrl: "https://example.com/feed",
          feedSiteUrl: "https://example.com",
          sourceKind: "rss",
          itemTitle: "First item",
          itemSummary: null,
          itemContentText: "Detailed body",
          itemUrl: "https://example.com/1",
          maxLabels: 1,
        },
        {
          id: "item-2",
          feedTitle: "Feed",
          feedDescription: null,
          feedUrl: "https://example.com/feed",
          feedSiteUrl: "https://example.com",
          sourceKind: "rss",
          itemTitle: "Second item",
          itemSummary: null,
          itemContentText: "Other body",
          itemUrl: "https://example.com/2",
          maxLabels: 1,
        },
      ],
      FAKE_CONFIG,
    );

    expect(inputs).toHaveLength(2);
    expect(result.get("item-1")?.categories[0]?.label).toBe("Software Engineering");
    expect(result.get("item-2")?.categories).toEqual([]);
  });

  test("returns categories above the similarity threshold, sorted by score", async () => {
    // First call embeds all category-card prototypes; second call embeds the item text.
    // CATEGORY_CARDS order is deterministic (defined in category-cards.ts), so the first
    // card's prototypes get UNIT_X (perfect match), everything else gets ORTHOGONAL_Z (no
    // match) — the item embedding is UNIT_X, so only the first card should score above 0.
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string) as { input: string[] };
      const isPrototypeCall = body.input.length > 1;
      if (isPrototypeCall) {
        // First 4 prototypes (Software Engineering's description + 3 titles) get UNIT_X;
        // everything else gets an orthogonal vector so it never matches.
        const embeddings = body.input.map((_, i) => (i < 4 ? UNIT_X : ORTHOGONAL_Z));
        return new Response(
          JSON.stringify({ data: embeddings.map((e, i) => ({ embedding: e, index: i })) }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({ data: [{ embedding: UNIT_X, index: 0 }] }), {
        status: 200,
      });
    }) as unknown as typeof fetch;

    const result = await classifyItemEmbedding(
      {
        feedTitle: "Hacker News",
        feedDescription: null,
        feedUrl: "https://news.ycombinator.com/rss",
        feedSiteUrl: "https://news.ycombinator.com",
        sourceKind: "rss",
        itemTitle: "Some article",
        itemSummary: null,
        itemUrl: null,
      },
      FAKE_CONFIG,
    );

    expect(result.categories).toHaveLength(1);
    expect(result.categories[0]?.label).toBe("Software Engineering");
    expect(result.categories[0]?.confidence).toBeGreaterThan(0.9);
  });

  test("abstains (returns no categories) when nothing clears the similarity threshold", async () => {
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string) as { input: string[] };
      const isPrototypeCall = body.input.length > 1;
      if (isPrototypeCall) {
        const embeddings = body.input.map(() => UNIT_Y);
        return new Response(
          JSON.stringify({ data: embeddings.map((e, i) => ({ embedding: e, index: i })) }),
          { status: 200 },
        );
      }
      // Item embedding orthogonal to every prototype: cosine similarity is 0, well below
      // the item threshold.
      return new Response(JSON.stringify({ data: [{ embedding: ORTHOGONAL_Z, index: 0 }] }), {
        status: 200,
      });
    }) as unknown as typeof fetch;

    const result = await classifyItemEmbedding(
      {
        feedTitle: "Hacker News",
        feedDescription: null,
        feedUrl: "https://news.ycombinator.com/rss",
        feedSiteUrl: "https://news.ycombinator.com",
        sourceKind: "rss",
        itemTitle: "Some unrelated article",
        itemSummary: null,
        itemUrl: null,
      },
      FAKE_CONFIG,
    );

    // Item-level classification must be able to abstain entirely — the same discipline the
    // keyword classifier's `allowGeneralFallback: false` enforces at item level.
    expect(result.categories).toEqual([]);
  });

  test("caches category prototypes across calls with the same config", async () => {
    let prototypeCallCount = 0;
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string) as { input: string[] };
      const isPrototypeCall = body.input.length > 1;
      if (isPrototypeCall) {
        prototypeCallCount += 1;
        const embeddings = body.input.map(() => ORTHOGONAL_Z);
        return new Response(
          JSON.stringify({ data: embeddings.map((e, i) => ({ embedding: e, index: i })) }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({ data: [{ embedding: ORTHOGONAL_Z, index: 0 }] }), {
        status: 200,
      });
    }) as unknown as typeof fetch;

    const input = {
      feedTitle: "Hacker News",
      feedDescription: null,
      feedUrl: "https://news.ycombinator.com/rss",
      feedSiteUrl: "https://news.ycombinator.com",
      sourceKind: "rss",
      itemTitle: "First article",
      itemSummary: null,
      itemUrl: null,
    };
    await classifyItemEmbedding(input, FAKE_CONFIG);
    await classifyItemEmbedding({ ...input, itemTitle: "Second article" }, FAKE_CONFIG);

    // Prototypes should only be embedded once across both calls, not once per call.
    expect(prototypeCallCount).toBe(1);
  });

  test("does not share cached category prototypes across API keys", async () => {
    let prototypeCallCount = 0;
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string) as { input: string[] };
      const isPrototypeCall = body.input.length > 1;
      if (isPrototypeCall) {
        prototypeCallCount += 1;
        const embeddings = body.input.map(() => ORTHOGONAL_Z);
        return new Response(
          JSON.stringify({ data: embeddings.map((e, i) => ({ embedding: e, index: i })) }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({ data: [{ embedding: ORTHOGONAL_Z, index: 0 }] }), {
        status: 200,
      });
    }) as unknown as typeof fetch;

    const input = {
      feedTitle: "Hacker News",
      feedDescription: null,
      feedUrl: "https://news.ycombinator.com/rss",
      feedSiteUrl: "https://news.ycombinator.com",
      sourceKind: "rss",
      itemTitle: "First article",
      itemSummary: null,
      itemUrl: null,
    };
    await classifyItemEmbedding(input, {
      ...FAKE_CONFIG,
      apiKey: "first-account-key",
    });
    await classifyItemEmbedding(input, {
      ...FAKE_CONFIG,
      apiKey: "second-account-key",
    });

    expect(prototypeCallCount).toBe(2);
  });

  test("evicts failed prototype cache entries so a later call can retry", async () => {
    let prototypeCallCount = 0;
    let failNextPrototypeCall = true;
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string) as { input: string[] };
      const isPrototypeCall = body.input.length > 1;
      if (isPrototypeCall) {
        prototypeCallCount += 1;
        if (failNextPrototypeCall) {
          failNextPrototypeCall = false;
          return new Response("temporary outage", { status: 503 });
        }
        const embeddings = body.input.map((_, i) => (i < 4 ? UNIT_X : ORTHOGONAL_Z));
        return new Response(
          JSON.stringify({ data: embeddings.map((e, i) => ({ embedding: e, index: i })) }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({ data: [{ embedding: UNIT_X, index: 0 }] }), {
        status: 200,
      });
    }) as unknown as typeof fetch;

    const input = {
      feedTitle: "Hacker News",
      feedDescription: null,
      feedUrl: "https://news.ycombinator.com/rss",
      feedSiteUrl: "https://news.ycombinator.com",
      sourceKind: "rss",
      itemTitle: "Some article",
      itemSummary: null,
      itemUrl: null,
    };

    await expect(classifyItemEmbedding(input, FAKE_CONFIG)).rejects.toThrow(/503/);
    const result = await classifyItemEmbedding(input, FAKE_CONFIG);

    expect(prototypeCallCount).toBe(2);
    expect(result.categories[0]?.label).toBe("Software Engineering");
  });
});

describe("embedding requests at scale", () => {
  // Cosine similarity 0.5 with UNIT_X: below the default 0.6 cutoff.
  const PARTIAL_MATCH = [0.5, Math.sqrt(0.75), 0];
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

  /** The first request answers the prototype load; later ones embed every item as `itemVector`. */
  function fakeEmbeddingsApi(options: { itemVector?: number[]; failRequest?: number } = {}) {
    const requests: string[][] = [];
    globalThis.fetch = (async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string) as { input: string[] };
      requests.push(body.input);
      if (requests.length === options.failRequest) {
        return new Response("rate limited", { status: 429 });
      }
      const isPrototypeLoad = requests.length === 1;
      const data = body.input.map((_, index) => ({
        embedding: isPrototypeLoad
          ? index < 4
            ? UNIT_X
            : ORTHOGONAL_Z
          : (options.itemVector ?? UNIT_X),
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

  test("classifyItemEmbeddings keeps the results of requests that succeed", async () => {
    // Request 1 loads prototypes, request 2 embeds items 0-127, request 3 items 128-129.
    fakeEmbeddingsApi({ failRequest: 3 });

    const results = await classifyItemEmbeddings(batchInputs(130), FAKE_CONFIG);

    expect(results.size).toBe(128);
    expect(results.get("item-0")?.categories[0]?.label).toBe("Software Engineering");
    expect(results.has("item-128")).toBe(false);
    expect(results.has("item-129")).toBe(false);
  });

  test("classifyItemEmbeddings throws when every request fails", async () => {
    fakeEmbeddingsApi({ failRequest: 2 });

    await expect(classifyItemEmbeddings(batchInputs(3), FAKE_CONFIG)).rejects.toThrow(/429/);
  });

  test("classifyItemEmbeddings applies itemSimilarityThreshold", async () => {
    fakeEmbeddingsApi({ itemVector: PARTIAL_MATCH });

    const strict = await classifyItemEmbeddings(batchInputs(1), FAKE_CONFIG);
    const lenient = await classifyItemEmbeddings(batchInputs(1), {
      ...FAKE_CONFIG,
      itemSimilarityThreshold: 0.4,
    });

    expect(strict.get("item-0")?.categories).toEqual([]);
    expect(lenient.get("item-0")?.categories.map((category) => category.label)).toEqual([
      "Software Engineering",
    ]);
  });

  test("classifyFeedEmbedding uses the feed threshold, not the item threshold", async () => {
    fakeEmbeddingsApi({ itemVector: PARTIAL_MATCH });
    const feedInput = {
      feedTitle: "Feed",
      feedDescription: null,
      feedUrl: "https://example.com/feed",
      feedSiteUrl: "https://example.com",
      sourceKind: "rss",
    };

    const itemKnobOnly = await classifyFeedEmbedding(feedInput, {
      ...FAKE_CONFIG,
      itemSimilarityThreshold: 0.4,
    });
    const feedKnob = await classifyFeedEmbedding(feedInput, {
      ...FAKE_CONFIG,
      feedSimilarityThreshold: 0.4,
    });

    expect(itemKnobOnly.categories).toEqual([{ label: "Miscellaneous", confidence: 0.1 }]);
    expect(feedKnob.categories.map((category) => category.label)).toEqual(["Software Engineering"]);
  });

  test("callers with different timeouts share one prototype load", async () => {
    const requests = fakeEmbeddingsApi();

    await classifyItemEmbedding(itemInput, { ...FAKE_CONFIG, timeoutMs: 8_000 });
    await classifyItemEmbedding(itemInput, FAKE_CONFIG);

    expect(requests.filter((input) => input.length > 1)).toHaveLength(1);
  });

  test("a caller that gives up leaves the prototype load warming the cache", async () => {
    let releasePrototypes!: () => void;
    const prototypesReleased = new Promise<void>((resolve) => {
      releasePrototypes = resolve;
    });
    let prototypeLoads = 0;
    globalThis.fetch = (async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string) as { input: string[] };
      const isPrototypeLoad = body.input.length > 1;
      if (isPrototypeLoad) {
        prototypeLoads += 1;
        await prototypesReleased;
      }
      const data = body.input.map((_, index) => ({
        embedding: isPrototypeLoad && index >= 4 ? ORTHOGONAL_Z : UNIT_X,
        index,
      }));
      return new Response(JSON.stringify({ data }), { status: 200 });
    }) as unknown as typeof fetch;

    await expect(
      classifyItemEmbedding(itemInput, { ...FAKE_CONFIG, timeoutMs: 10 }),
    ).rejects.toThrow(/not ready within 10ms/);
    releasePrototypes();
    const result = await classifyItemEmbedding(itemInput, FAKE_CONFIG);

    expect(prototypeLoads).toBe(1);
    expect(result.categories[0]?.label).toBe("Software Engineering");
  });
});

describe("classifyFeedEmbedding", () => {
  test("falls back to Miscellaneous at low confidence when nothing clears the threshold", async () => {
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string) as { input: string[] };
      const isPrototypeCall = body.input.length > 1;
      if (isPrototypeCall) {
        const embeddings = body.input.map(() => UNIT_Y);
        return new Response(
          JSON.stringify({ data: embeddings.map((e, i) => ({ embedding: e, index: i })) }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({ data: [{ embedding: ORTHOGONAL_Z, index: 0 }] }), {
        status: 200,
      });
    }) as unknown as typeof fetch;

    const result = await classifyFeedEmbedding(
      {
        feedTitle: "Some obscure feed",
        feedDescription: null,
        feedUrl: "https://example.com/rss",
        feedSiteUrl: "https://example.com",
        sourceKind: "rss",
      },
      FAKE_CONFIG,
    );

    // Unlike item-level classification, a feed must always resolve to some label — this is
    // the same discipline as the keyword classifier's feed-level `allowGeneralFallback: true`.
    expect(result.categories).toEqual([{ label: "Miscellaneous", confidence: 0.1 }]);
  });
});
