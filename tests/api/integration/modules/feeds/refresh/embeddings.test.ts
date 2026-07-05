import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  classifyFeedEmbedding,
  classifyItemEmbedding,
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
