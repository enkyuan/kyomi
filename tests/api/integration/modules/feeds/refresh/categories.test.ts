import { afterEach, describe, expect, test } from "bun:test";
import { sql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import {
  canonicalWinsOnConflictSql,
  runFeedRefresh,
  syncInferredFeedCategories,
  syncItemInferences,
} from "@kyomi/worker";
import {
  createFeedRefreshDb,
  KEYWORD_MODEL,
  labelsForAssignments,
  mockFetch,
  restoreFetch,
} from "./category-test-helpers";

afterEach(restoreFetch);

describe("runFeedRefresh category ingestion", () => {
  test("persists RSS channel and item categories mapped to canonical labels", async () => {
    const fake = createFeedRefreshDb();
    globalThis.fetch = mockFetch(async () => {
      const response = new Response(
        `<?xml version="1.0"?>
        <rss version="2.0">
          <channel>
            <title>Example Feed</title>
            <link>https://example.com/</link>
            <description>Updates</description>
            <category>Technology</category>
            <item>
              <title>First item</title>
              <link>https://example.com/first</link>
              <guid>first</guid>
              <description>Summary</description>
              <category>JavaScript</category>
              <category>Programming</category>
              <pubDate>Wed, 01 Jul 2026 00:00:00 GMT</pubDate>
            </item>
          </channel>
        </rss>`,
        {
          status: 200,
          headers: { "content-type": "application/rss+xml" },
        },
      );
      Object.defineProperty(response, "url", { value: "https://example.com/feed.xml" });
      return response;
    });

    const result = await runFeedRefresh(fake as never, "feed-1", undefined, {
      enrichArticles: false,
    });

    expect(result.ok).toBe(true);
    // Explicit-provenance sync runs first, then the classifier sync (which finds explicit
    // canonical labels already present and writes nothing) issues its own delete pass on
    // both tables.
    expect(fake.deletes).toEqual([
      "feed_item_tag_assignments",
      "feed_category_assignments",
      "feed_item_category_assignments",
      "feed_category_assignments",
      "feed_item_category_assignments",
    ]);
    // Raw "JavaScript"/"Programming"/"Technology" source labels are canonicalized before
    // ever reaching the categories dictionary, so both map onto "Software Engineering" and
    // "Technology" stays as-is; no raw label is inserted as its own row.
    expect(fake.categories.map((row) => row.label)).toEqual(["Technology", "Software Engineering"]);
    expect(fake.categories.every((row) => row.provenance === "feed")).toBe(true);
    expect(labelsForAssignments(fake.feedCategoryAssignments, fake.categories)).toEqual([
      "Technology",
    ]);
    expect(labelsForAssignments(fake.feedItemCategoryAssignments, fake.categories)).toEqual([
      "Software Engineering",
    ]);
    expect(fake.feedItemTagAssignments.map((row) => row.label)).toEqual([
      "JavaScript",
      "Programming",
    ]);
    expect(result.categoryStats?.sourceTagAssignments).toBe(2);
  });

  test("does not insert a raw category row for an unmapped RSS label", async () => {
    const fake = createFeedRefreshDb();
    globalThis.fetch = mockFetch(async () => {
      const response = new Response(
        `<?xml version="1.0"?>
        <rss version="2.0">
          <channel>
            <title>Example Feed</title>
            <link>https://example.com/</link>
            <description>Updates</description>
            <item>
              <title>First item</title>
              <link>https://example.com/first</link>
              <guid>first</guid>
              <description>Summary</description>
              <category>#random-tag-2026</category>
              <pubDate>Wed, 01 Jul 2026 00:00:00 GMT</pubDate>
            </item>
          </channel>
        </rss>`,
        { status: 200, headers: { "content-type": "application/rss+xml" } },
      );
      Object.defineProperty(response, "url", { value: "https://example.com/feed.xml" });
      return response;
    });

    const result = await runFeedRefresh(fake as never, "feed-1", undefined, {
      enrichArticles: false,
    });

    expect(result.ok).toBe(true);
    expect(fake.categories.some((row) => row.provenance === "feed")).toBe(false);
    expect(fake.feedItemCategoryAssignments.some((row) => row.provenance === "feed")).toBe(false);
    expect(fake.feedItemTagAssignments.map((row) => row.label)).toEqual(["#random-tag-2026"]);
    expect(result.categoryStats?.sourceTagAssignments).toBe(1);
    // The feed has no explicit channel-level category at all, so the classifier fallback
    // still runs and fills in a canonical label from the feed title/description/domain.
    expect(fake.feedCategoryAssignments.some((row) => row.provenance === "classifier")).toBe(true);
  });

  test("persists classifier feed and item categories without touching explicit feed provenance", async () => {
    const fake = createFeedRefreshDb();
    const now = new Date("2026-07-04T00:00:00.000Z");

    await syncInferredFeedCategories(
      fake as never,
      {
        feedId: "feed-1",
        feedCategories: [{ label: "Technology", confidence: 0.7 }],
        items: [
          {
            id: "item-1",
            inferredCategoryLabels: [{ label: "Security & Privacy", confidence: 0.8 }],
          },
        ],
        model: KEYWORD_MODEL,
      },
      now,
    );

    expect(fake.deletes).toEqual(["feed_category_assignments", "feed_item_category_assignments"]);
    expect(fake.categories.map((row) => row.label)).toEqual(["Technology", "Security & Privacy"]);
    expect(fake.feedCategoryAssignments).toMatchObject([
      { feedId: "feed-1", provenance: "classifier", confidence: 0.7 },
    ]);
    expect(fake.feedItemCategoryAssignments).toMatchObject([
      { feedItemId: "item-1", provenance: "classifier", confidence: 0.8 },
    ]);
  });

  test("syncs item-only classifier categories without deleting feed-level classifier rows", async () => {
    const fake = createFeedRefreshDb({
      existingFeedCategoryAssignments: [
        {
          id: "feed-assignment-1",
          feedId: "feed-1",
          categoryId: "category-1",
          provenance: "classifier",
          modelId: KEYWORD_MODEL.modelId,
        },
      ],
    });
    const now = new Date("2026-07-04T00:00:00.000Z");

    await syncItemInferences(
      fake as never,
      {
        items: [
          {
            id: "item-1",
            inferredCategoryLabels: [{ label: "Security & Privacy", confidence: 0.8 }],
          },
        ],
        model: KEYWORD_MODEL,
      },
      now,
    );

    expect(fake.deletes).toEqual(["feed_item_category_assignments"]);
    expect(fake.feedCategoryAssignments).toEqual([
      {
        id: "feed-assignment-1",
        feedId: "feed-1",
        categoryId: "category-1",
        provenance: "classifier",
        modelId: KEYWORD_MODEL.modelId,
      },
    ]);
    expect(fake.feedItemCategoryAssignments).toMatchObject([
      { feedItemId: "item-1", provenance: "classifier", confidence: 0.8 },
    ]);
  });

  test("stamps model_id, taxonomy_version, and classifier_method on classifier assignment rows", async () => {
    // The keyword classifier writes provenance fields (modelId, taxonomyVersion,
    // classifierMethod) so a future re-classify pass can pick out stale rows, and so the read
    // path can rank embedding rows above keyword rows without parsing modelId. Locking in the
    // expected values here is the guard against a future refactor accidentally dropping the
    // stamps and leaving the DB unable to tell keyword-classifier rows from
    // embedding-classifier rows.
    const fake = createFeedRefreshDb();
    const now = new Date("2026-07-04T00:00:00.000Z");

    await syncInferredFeedCategories(
      fake as never,
      {
        feedId: "feed-1",
        feedCategories: [{ label: "Technology", confidence: 0.7 }],
        items: [
          {
            id: "item-1",
            inferredCategoryLabels: [{ label: "Security & Privacy", confidence: 0.8 }],
          },
        ],
        model: KEYWORD_MODEL,
      },
      now,
    );

    expect(fake.feedCategoryAssignments).toMatchObject([
      {
        provenance: "classifier",
        modelId: "keyword-v1",
        taxonomyVersion: "v1",
        classifierMethod: "keyword",
      },
    ]);
    expect(fake.feedItemCategoryAssignments).toMatchObject([
      {
        provenance: "classifier",
        modelId: "keyword-v1",
        taxonomyVersion: "v1",
        classifierMethod: "keyword",
      },
    ]);
  });

  test("does not write item classifier labels when an item has no inferred labels", async () => {
    const fake = createFeedRefreshDb();
    const now = new Date("2026-07-04T00:00:00.000Z");

    await syncInferredFeedCategories(
      fake as never,
      {
        feedId: "feed-1",
        feedCategories: [{ label: "Miscellaneous", confidence: 0.1 }],
        items: [{ id: "item-1", inferredCategoryLabels: [] }],
        model: KEYWORD_MODEL,
      },
      now,
    );

    expect(fake.feedCategoryAssignments).toHaveLength(1);
    expect(fake.feedItemCategoryAssignments).toHaveLength(0);
  });
});

describe("canonicalWinsOnConflictSql", () => {
  test("lets a canonical incoming label win over a non-canonical existing label", () => {
    // Regression test: categories.slug is unique across all provenances, so a raw noisy label
    // (e.g. "MISCELLANEOUS") and the canonical label it happens to slug-collide with (e.g.
    // "Miscellaneous") can land on the same row. Without this branch, a classifier upsert that
    // lost the initial insert race would silently keep the non-canonical existing label
    // forever, and callers would attach new classifier assignments to a non-canonical row.
    const query = new PgDialect().sqlToQuery(
      canonicalWinsOnConflictSql(sql`existing_column`, sql`excluded.some_column`),
    );
    expect(query.sql).toContain("excluded.label IN (");
    expect(query.sql).toContain("NOT IN (");
    expect(query.sql).toContain("THEN excluded.some_column ELSE existing_column END");
    expect(query.params).toContain("Miscellaneous");
    expect(query.params).toContain("Software Engineering");
  });
});
