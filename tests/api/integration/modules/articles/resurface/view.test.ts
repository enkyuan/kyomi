import { describe, expect, test } from "bun:test";
import {
  listContinueReading,
  normalizeContinueReadingLimit,
} from "@modules/articles/resurface/operations";
import { CLIP_LIST_FEED_ID } from "@modules/articles/write/clips/constants";
import { RESURFACE_CONFIG } from "@modules/articles/resurface/schedule";
import {
  DAY,
  HOUR,
  NOW,
  ago,
  clipCandidateRow,
  createViewDb,
  feedCandidateRow,
  readingRow,
  renderSql,
} from "./fakes";

type Db = Parameters<typeof listContinueReading>[0];

function asDb(fake: ReturnType<typeof createViewDb>): Db {
  return fake.db as unknown as Db;
}

describe("normalizeContinueReadingLimit", () => {
  test("defaults to 5 and clamps to 1..20", () => {
    expect(normalizeContinueReadingLimit(undefined)).toBe(5);
    expect(normalizeContinueReadingLimit("abc")).toBe(5);
    expect(normalizeContinueReadingLimit("0")).toBe(1);
    expect(normalizeContinueReadingLimit("-4")).toBe(1);
    expect(normalizeContinueReadingLimit("7")).toBe(7);
    expect(normalizeContinueReadingLimit("500")).toBe(20);
  });
});

describe("listContinueReading", () => {
  test("returns an unpaginated list response", async () => {
    const fake = createViewDb({ feed: [feedCandidateRow({ reading: readingRow() })] });

    const result = await listContinueReading(asDb(fake), "user-1", 5, NOW);

    expect(result.next_cursor).toBeNull();
    expect(result.has_more).toBe(false);
    expect(result.total_count).toBeNull();
    expect(result.items).toHaveLength(1);
  });

  test("maps feed items to list items with reading progress", async () => {
    const reading = readingRow({
      feedItemId: "item-a",
      progress: 0.5,
      maxProgress: 0.6,
      contentWords: 2_380,
      state: "resurfacing",
    });
    const fake = createViewDb({
      feed: [feedCandidateRow({ reading, id: "item-a", isSaved: true })],
    });

    const [item] = (await listContinueReading(asDb(fake), "user-1", 5, NOW)).items;

    expect(item).toMatchObject({
      id: "item-a",
      articleType: "feed",
      feedId: "feed-1",
      feedTitle: "Example feed",
      link: "https://example.com/item-a",
      isRead: false,
      categories: [],
    });
    expect(item!.readingProgress).toEqual({
      progress: 0.5,
      maxProgress: 0.6,
      state: "resurfacing",
      engaged: true,
      remainingMinutes: 5,
      lastReadAt: reading.lastReadAt.toISOString(),
      completedAt: null,
    });
  });

  test("includes clips alongside feed items", async () => {
    const clipReading = readingRow({ feedItemId: null, clipId: "clip-1", maxProgress: 0.9 });
    const fake = createViewDb({
      feed: [feedCandidateRow({ reading: readingRow({ feedItemId: "item-a", maxProgress: 0.1 }) })],
      clips: [clipCandidateRow(clipReading, "clip-1")],
    });

    const { items } = await listContinueReading(asDb(fake), "user-1", 5, NOW);

    expect(items.map((item) => `${item.articleType}:${item.id}`)).toEqual([
      "clip:clip-1",
      "feed:item-a",
    ]);
    const clip = items[0]!;
    expect(clip.feedId).toBe(CLIP_LIST_FEED_ID);
    expect(clip.isSaved).toBe(true);
  });

  test("orders by score: momentum, saved, and recency outrank a stale low-progress row", async () => {
    const strong = readingRow({ feedItemId: "strong", maxProgress: 0.8, progress: 0.8 });
    const saved = readingRow({ feedItemId: "saved", maxProgress: 0.3, progress: 0.3 });
    const stale = readingRow({
      feedItemId: "stale",
      maxProgress: 0.3,
      progress: 0.3,
      lastReadAt: ago(60 * DAY),
    });
    const fake = createViewDb({
      feed: [
        feedCandidateRow({ reading: stale }),
        feedCandidateRow({ reading: saved, isSaved: true }),
        feedCandidateRow({ reading: strong }),
      ],
    });

    const { items } = await listContinueReading(asDb(fake), "user-1", 5, NOW);

    expect(items.map((item) => item.id)).toEqual(["strong", "saved", "stale"]);
  });

  test("feed affinity relative to the user's top feed breaks otherwise equal rows", async () => {
    const base = { maxProgress: 0.5, progress: 0.5 };
    const familiar = readingRow({ feedItemId: "familiar", ...base });
    const unfamiliar = readingRow({ feedItemId: "unfamiliar", ...base });
    const fake = createViewDb({
      feed: [
        feedCandidateRow({ reading: unfamiliar, viewedItemCount: 1 }),
        feedCandidateRow({ reading: familiar, viewedItemCount: 80 }),
      ],
      maxViewedItemCount: 80,
    });

    const { items } = await listContinueReading(asDb(fake), "user-1", 5, NOW);

    expect(items.map((item) => item.id)).toEqual(["familiar", "unfamiliar"]);
  });

  test("returns only the top N", async () => {
    const feed = Array.from({ length: 6 }, (_, index) =>
      feedCandidateRow({
        reading: readingRow({
          feedItemId: `item-${index}`,
          maxProgress: 0.1 + index * 0.1,
          progress: 0.1 + index * 0.1,
        }),
      }),
    );
    const fake = createViewDb({ feed });

    const { items } = await listContinueReading(asDb(fake), "user-1", 3, NOW);

    expect(items.map((item) => item.id)).toEqual(["item-5", "item-4", "item-3"]);
  });

  test("is stable for equal scores (earliest due first, then id)", async () => {
    const first = readingRow({ feedItemId: "b", dueAt: ago(3 * DAY) });
    const second = readingRow({ feedItemId: "a", dueAt: ago(DAY) });
    const third = readingRow({ feedItemId: "c", dueAt: ago(DAY) });
    const fake = createViewDb({
      feed: [second, third, first].map((reading) => feedCandidateRow({ reading })),
    });

    const { items } = await listContinueReading(asDb(fake), "user-1", 5, NOW);

    expect(items.map((item) => item.id)).toEqual(["b", "a", "c"]);
  });

  describe("eligibility", () => {
    const ineligible: Array<[string, Parameters<typeof readingRow>[0]]> = [
      ["not yet due", { dueAt: new Date(NOW.getTime() + HOUR) }],
      ["no due time", { dueAt: null }],
      ["not engaged by progress", { maxProgress: 0.04 }],
      ["not engaged by time", { activeReadMs: 10_000 }],
      ["too short", { contentWords: RESURFACE_CONFIG.minWords - 1 }],
      ["unmeasured", { contentWords: null }],
      ["read too recently", { lastReadAt: ago(RESURFACE_CONFIG.minGapMs - 1) }],
      ["completed", { state: "completed" }],
      ["dismissed", { state: "dismissed" }],
      ["abandoned", { state: "abandoned" }],
    ];

    for (const [label, overrides] of ineligible) {
      test(`excludes a row that is ${label}`, async () => {
        const fake = createViewDb({
          feed: [feedCandidateRow({ reading: readingRow({ feedItemId: "x", ...overrides }) })],
        });

        const { items } = await listContinueReading(asDb(fake), "user-1", 5, NOW);

        expect(items).toEqual([]);
      });
    }

    test("excludes hidden feed items even if the query returned them", async () => {
      const fake = createViewDb({
        feed: [feedCandidateRow({ reading: readingRow(), hiddenAt: ago(HOUR) })],
      });

      expect((await listContinueReading(asDb(fake), "user-1", 5, NOW)).items).toEqual([]);
    });

    test("an ineligible row does not displace eligible ones", async () => {
      const fake = createViewDb({
        feed: [
          feedCandidateRow({
            reading: readingRow({ feedItemId: "dismissed", state: "dismissed" }),
          }),
          feedCandidateRow({ reading: readingRow({ feedItemId: "ok" }) }),
        ],
      });

      const { items } = await listContinueReading(asDb(fake), "user-1", 5, NOW);

      expect(items.map((item) => item.id)).toEqual(["ok"]);
    });
  });

  describe("query scoping", () => {
    test("every candidate query is scoped to the caller and the due window", async () => {
      const fake = createViewDb({});

      await listContinueReading(asDb(fake), "user-42", 5, NOW);

      const reads = fake.queries.filter((query) => query.where !== undefined);
      // feed candidates, clip candidates, and the affinity denominator
      expect(reads).toHaveLength(3);
      for (const read of reads) {
        const { sql, params } = renderSql(read.where!);
        expect(params).toContain("user-42");
        expect(sql).toContain("user_id");
      }

      const candidateReads = reads.filter((query) => query.limit === 200);
      expect(candidateReads).toHaveLength(2);
      for (const read of candidateReads) {
        const { sql, params } = renderSql(read.where!);
        expect(sql).toContain('"state" in');
        expect(sql).toContain('"due_at" <=');
        expect(params).toEqual(
          expect.arrayContaining(["reading", "resurfacing", NOW.toISOString()]),
        );
        expect(params).toContain(RESURFACE_CONFIG.minWords);
      }
    });

    test("clip candidates also require the clip to belong to the caller", async () => {
      const fake = createViewDb({});

      await listContinueReading(asDb(fake), "user-42", 5, NOW);

      const clipRead = fake.queries.find(
        (query) => query.joins.length === 1 && query.limit === 200,
      );
      const { sql, params } = renderSql(clipRead!.where!);
      expect(sql).toContain('"article_clips"."user_id" =');
      expect(params.filter((param) => param === "user-42")).toHaveLength(2);
    });

    test("feed candidates scope user state and stats joins and skip hidden items", async () => {
      const fake = createViewDb({});

      await listContinueReading(asDb(fake), "user-42", 5, NOW);

      const feedRead = fake.queries.find((query) => query.joins.length === 4);
      const { sql } = renderSql(feedRead!.where!);
      expect(sql).toContain('"hidden_at" is null');
    });
  });
});
