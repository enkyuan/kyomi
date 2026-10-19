import { afterEach, describe, expect, test } from "bun:test";
import {
  classifyFeedEmbedding,
  classifyItemEmbedding,
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

/**
 * Deterministic 3-dimensional "embeddings" — real BGE-M3 vectors are much higher-dimensional, but
 * a small hand-computable space, with FAKE_CATEGORY_MODEL as the category head, is enough to verify
 * the scoring, threshold, and fallback logic without needing real semantics.
 */
const UNIT_X = [1, 0, 0];
const UNIT_Y = [0, 1, 0];
const ORTHOGONAL_Z = [0, 0, 1];

afterEach(() => {
  globalThis.fetch = originalFetch;
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

/** Answers every embeddings request with `vectorFor(text)` and records each request's inputs. */
function fakeWorker(vectorFor: (text: string, index: number, inputs: string[]) => number[]) {
  const requests: string[][] = [];
  globalThis.fetch = (async (_url: string, init: RequestInit) => {
    const body = JSON.parse(init.body as string) as { input: string[] };
    requests.push(body.input);
    return new Response(
      JSON.stringify({
        data: body.input.map((text, index) => ({
          embedding: vectorFor(text, index, body.input),
          index,
        })),
      }),
      { status: 200 },
    );
  }) as unknown as typeof fetch;
  return requests;
}

const ARTICLE = {
  feedTitle: "Hacker News",
  feedDescription: null,
  feedUrl: "https://news.ycombinator.com/rss",
  feedSiteUrl: "https://news.ycombinator.com",
  sourceKind: "rss",
  itemTitle: "Some article",
  itemSummary: null,
  itemUrl: null,
};

describe("classifyItemEmbedding", () => {
  test("embeds a batch of articles in one request", async () => {
    const requests = fakeWorker((text) => (text.startsWith("First") ? UNIT_X : ORTHOGONAL_Z));

    const result = await classifyItemEmbeddings(
      [
        {
          ...ARTICLE,
          id: "item-1",
          itemTitle: "First item",
          itemContentText: "Detailed body",
          maxLabels: 1,
        },
        {
          ...ARTICLE,
          id: "item-2",
          itemTitle: "Second item",
          itemContentText: "Other body",
          maxLabels: 1,
        },
      ],
      FAKE_CONFIG,
    );

    expect(requests).toEqual([["First item. Detailed body", "Second item. Other body"]]);
    expect(result.get("item-1")?.categories[0]?.label).toBe("Software Engineering");
    expect(result.get("item-2")?.categories).toEqual([]);
  });

  test("returns the head's top category with its probability as confidence", async () => {
    fakeWorker(() => UNIT_X);

    const result = await classifyItemEmbedding(ARTICLE, FAKE_CONFIG);

    expect(result.categories).toHaveLength(1);
    expect(result.categories[0]?.label).toBe("Software Engineering");
    expect(result.categories[0]?.confidence).toBeGreaterThan(0.9);
  });

  test("abstains when the head puts its weight on no category", async () => {
    fakeWorker(() => ORTHOGONAL_Z);

    const result = await classifyItemEmbedding(ARTICLE, FAKE_CONFIG);

    // Item-level classification must be able to abstain entirely — the same discipline the
    // keyword classifier's `allowGeneralFallback: false` enforces at item level.
    expect(result.categories).toEqual([]);
  });

  test("admits a second category only within the secondary margin of the first", async () => {
    // Close to both the Software Engineering and Technology axes: about 0.57 and 0.42.
    fakeWorker(() => [1, 0.95, 0]);

    const wide = await classifyItemEmbedding(ARTICLE, {
      ...FAKE_CONFIG,
      itemMinProbability: 0.1,
      itemSecondaryMargin: 0.3,
    });
    const narrow = await classifyItemEmbedding(ARTICLE, {
      ...FAKE_CONFIG,
      itemMinProbability: 0.1,
      itemSecondaryMargin: 0.05,
    });

    expect(wide.categories.map((category) => category.label)).toEqual([
      "Software Engineering",
      "Technology",
    ]);
    expect(narrow.categories.map((category) => category.label)).toEqual(["Software Engineering"]);
  });
});

describe("classifyFeedEmbedding", () => {
  const FEED = {
    feedTitle: "Some feed",
    feedDescription: "Notes on building software",
    feedUrl: "https://example.com/rss",
    feedSiteUrl: "https://example.com",
    sourceKind: "rss",
  };

  test("scores the feed's title and description with the head in one request", async () => {
    const requests = fakeWorker(() => UNIT_X);

    const result = await classifyFeedEmbedding(FEED, FAKE_CONFIG);

    expect(requests).toEqual([["Some feed. Notes on building software"]]);
    expect(result.categories).toHaveLength(1);
    expect(result.categories[0]?.label).toBe("Software Engineering");
    expect(result.categories[0]?.confidence).toBeGreaterThan(0.9);
  });

  test("falls back to Miscellaneous at low confidence when nothing clears the floor", async () => {
    fakeWorker(() => ORTHOGONAL_Z);

    const result = await classifyFeedEmbedding(FEED, FAKE_CONFIG);

    // Unlike item-level classification, a feed must always resolve to some label — this is
    // the same discipline as the keyword classifier's feed-level `allowGeneralFallback: true`.
    expect(result.categories).toEqual([{ label: "Miscellaneous", confidence: 0.1 }]);
  });

  test("admits a second category only within the feed secondary margin", async () => {
    // About 0.57 Software Engineering and 0.42 Technology.
    fakeWorker(() => [1, 0.95, 0]);

    const narrow = await classifyFeedEmbedding(FEED, FAKE_CONFIG);
    const wide = await classifyFeedEmbedding(FEED, { ...FAKE_CONFIG, feedSecondaryMargin: 0.2 });

    expect(narrow.categories.map((category) => category.label)).toEqual(["Software Engineering"]);
    expect(wide.categories.map((category) => category.label)).toEqual([
      "Software Engineering",
      "Technology",
    ]);
  });
});
