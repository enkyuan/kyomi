# Per-Article Category Classification Accuracy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every feed item gets an article-specific category attempt after refresh/backfill, while feed-level categories remain the fallback when an item has no confident item-level signal.

**Architecture:** Keep the existing deterministic taxonomy, category assignment tables, provenance ranking SQL, and chip rendering path. Change the worker and backfill paths so item classification runs for every feed item, not only hardcoded mixed-feed hosts, and score item categories only from item title, item summary/content, and item URL host. Preserve explicit RSS/Atom/JSON/catalog categories by writing classifier assignments with lower-ranked `provenance = "classifier"`.

**Tech Stack:** Bun, TypeScript, Drizzle/Postgres, `@kyomi/db`, `@kyomi/worker`, API integration tests, GitButler for checkpoint commits.

## Global Constraints

- Do not add a database migration.
- Do not add external ML, LLM, embedding, or network dependencies.
- Keep canonical categories limited to `CANONICAL_CATEGORY_LABELS` from `packages/db/src/category-taxonomy.ts`.
- Use `Miscellaneous`, not `General`, for the fallback category.
- Preserve assignment precedence in `apps/api/src/modules/articles/read/list/service.ts`: explicit item category, classifier item category, explicit feed category, classifier feed category.
- Keep `isMixedFeedHost()` exported for compatibility, but do not use it as a hard gate for item classification.
- Do not hardcode category chips in React.
- Run item classification after article enrichment in refresh so fetched article text can inform the score.
- Backfill must remain dry-run by default and require `--apply` for database writes.
- Use GitButler (`but`) for version-control inspection and commits. Do not use raw `git add` or `git commit`.
- Keep unrelated pending workspace changes out of this implementation.

---

## Current-State Assessment

Claude's quoted assessment is accurate for the current implementation:

- `packages/worker/src/services/feed/refresh.ts` classifies feed-level categories for every feed when source categories do not canonicalize.
- `refresh.ts` only calls item-level classifier output when `isMixedFeed()` returns true.
- `isMixedFeed()` is backed by `MIXED_FEED_HOSTS` in `packages/worker/src/services/feed/taxonomy.ts`, currently covering Hacker News, Lobsters, Reddit, old Reddit, and Slashdot.
- `packages/worker/src/services/feed/classifier.ts` currently builds item `bodyText` from `itemSummary`, `feedTitle`, and `feedDescription`, which can pull article-level scoring toward the parent feed.
- `scripts/categories/backfill.ts` repeats the same allowlist gate and only classifies recent items up to `--item-limit`.
- The API read path already ranks item classifier labels ahead of feed labels, so the missing work is data population and scoring accuracy, not UI.

Target data flow:

```text
new refresh
  parsed item
    -> explicit item labels canonicalized as provenance="feed"
    -> independent item classifier runs for every item
    -> classifier labels are filtered against explicit item labels
    -> syncInferredFeedCategories() writes provenance="classifier"

existing rows
  backfill scans feeds
    -> feed classifier labels
    -> all items unless --item-limit is passed
    -> independent item classifier runs for every item
    -> syncInferredFeedCategories() writes provenance="classifier"

read time
  item explicit labels
  then item classifier labels
  then feed explicit labels
  then feed classifier labels
```

## What Already Exists

- `packages/db/src/category-taxonomy.ts` defines the normalized category set and aliases.
- `packages/worker/src/services/feed/taxonomy.ts` mirrors those labels for deterministic scoring.
- `packages/worker/src/services/feed/classifier.ts` exposes `classifyFeedCategories()`, `classifyFeedItemCategories()`, and `isMixedFeedHost()`.
- `packages/worker/src/services/feed/categories.ts` exposes `syncParsedFeedCategories()` and `syncInferredFeedCategories()`.
- `packages/worker/src/services/feed/refresh.ts` calls parser, enrichment, explicit category sync, classifier sync, and search sync.
- `scripts/categories/backfill.ts` can dry-run/apply classifier assignments for existing feeds/items.
- `apps/api/src/modules/articles/read/list/service.ts` already unions item and feed category assignments with provenance ranking.
- `tests/api/integration/modules/feeds/refresh/classifier.test.ts` covers current deterministic scoring.
- `tests/api/integration/modules/feeds/refresh/categories.test.ts` covers category writes through refresh.
- `tests/api/integration/scripts/categories/backfill.test.ts` covers backfill argument parsing and summary copy.
- `tests/api/integration/modules/articles/read/list-tags.test.ts` covers DTO category mapping and SQL ranking shape.

## NOT In Scope

- AI tagging or LLM-backed classification.
- Per-user category customization.
- Manual category editing UI.
- Replacing the deterministic taxonomy with a different taxonomy.
- Changing chip placement or visual styling.
- Changing `feedCategoryLabelsSql` ranking unless a regression test proves it no longer matches the required precedence.
- Deleting the exported `isMixedFeedHost()` API in this branch.

## File Structure

- Modify `packages/worker/src/services/feed/classifier.ts` to make item scoring item-only and accept optional `itemContentText`.
- Modify `packages/worker/src/services/feed/refresh.ts` to classify every item after enrichment and filter classifier labels against explicit item labels.
- Modify `scripts/categories/backfill.ts` to classify every loaded item, load `contentText`, and scan all existing items by default.
- Extend `tests/api/integration/modules/feeds/refresh/classifier.test.ts` with item-only and content-text regression tests.
- Extend `tests/api/integration/modules/feeds/refresh/categories.test.ts` with a non-allowlisted mixed-content feed refresh test.
- Extend `tests/api/integration/scripts/categories/backfill.test.ts` with backfill item classification and default all-items parsing tests.
- Keep `apps/api/src/modules/articles/read/list/service.ts` unchanged unless the SQL ranking test fails.

## Acceptance Criteria

- A non-allowlisted feed such as `https://example.com/feed.xml` can produce item-level classifier assignments.
- A single-topic feed still gets feed-level classifier assignments for fallback chips.
- An item with a strong title/summary/content signal gets item-specific labels even when the parent feed title points elsewhere.
- Parent feed title and description do not contribute to item category scores.
- Enriched `contentText` contributes to item category scores when RSS summary text is thin.
- Explicit item source categories remain first-ranked and can fill the chip slots before classifier labels.
- Backfill classifies all existing items by default; `--item-limit` becomes an explicit cap.
- Dry-run backfill prints counts without writing classifier assignments.
- Existing `feedCategoryLabelsSql` precedence remains unchanged and tested.

## Task 1: Make Item Classification Independent

**Files:**
- Modify: `packages/worker/src/services/feed/classifier.ts`
- Test: `tests/api/integration/modules/feeds/refresh/classifier.test.ts`

**Interfaces:**
- Consumes: existing `CATEGORY_TAXONOMY`, `InferredCategoryLabel`, `CategoryClassification`.
- Produces: `FeedItemCategoryClassificationInput` with `itemContentText?: string | null`.
- Produces: `classifyFeedItemCategories(input: FeedItemCategoryClassificationInput): CategoryClassification` that scores only item title, item summary/content, and item URL host.

- [ ] **Step 1: Add failing classifier regression tests**

Append these tests to `tests/api/integration/modules/feeds/refresh/classifier.test.ts` inside the existing `describe("feed category classifier", () => { ... })` block:

```ts
  test("does not let parent feed metadata dilute item classification", () => {
    const result = classifyFeedItemCategories({
      feedTitle: "AI & ML Daily",
      feedDescription:
        "Language model, transformer, embedding, agent, and artificial intelligence analysis.",
      feedUrl: "https://example.com/rss",
      feedSiteUrl: "https://example.com",
      sourceKind: "rss",
      itemTitle: "A practical guide to pasta dough and weeknight cooking",
      itemSummary: "Chef notes on kitchen technique, recipe testing, and restaurant prep.",
      itemUrl: "https://seriouseats.com/pasta-dough-guide",
    });

    const labels = result.categories.map((category) => category.label);
    expect(labels).toContain("Food & Travel");
    expect(labels).not.toContain("AI & ML");
  });

  test("uses enriched content text when RSS summary is thin", () => {
    const result = classifyFeedItemCategories({
      feedTitle: "Daily Links",
      feedDescription: "A mixed collection of links.",
      feedUrl: "https://example.com/rss",
      feedSiteUrl: "https://example.com",
      sourceKind: "rss",
      itemTitle: "Release notes",
      itemSummary: "Comments",
      itemContentText:
        "The new open weights language model uses transformer layers, embeddings, and agent training data.",
      itemUrl: "https://huggingface.co/blog/open-model-release",
    });

    expect(result.categories.map((category) => category.label)).toEqual(["AI & ML"]);
  });
```

- [ ] **Step 2: Run the focused classifier test and verify failure**

Run from `apps/api`:

```bash
bunx --no-install dotenvx run -f ../../docker/.env -f .env -- bun test ../../tests/api/integration/modules/feeds/refresh/classifier.test.ts
```

Expected:

- The new `itemContentText` call fails to typecheck or run because the input type does not include it.
- The feed-metadata dilution test fails because item body text currently includes feed title/description.

- [ ] **Step 3: Extend the classifier input type**

In `packages/worker/src/services/feed/classifier.ts`, replace the existing `FeedItemCategoryClassificationInput` type with:

```ts
export type FeedItemCategoryClassificationInput = FeedCategoryClassificationInput & {
  itemTitle: string;
  itemSummary: string | null;
  itemContentText?: string | null;
  itemUrl: string | null;
};
```

- [ ] **Step 4: Replace item scoring with item-only scoring**

In `packages/worker/src/services/feed/classifier.ts`, replace `classifyFeedItemCategories()` with:

```ts
export function classifyFeedItemCategories(
  input: FeedItemCategoryClassificationInput,
): CategoryClassification {
  const itemHost = safeHost(input.itemUrl);
  const titleText = normalizeText(input.itemTitle);
  const bodyText = normalizeText([input.itemSummary, input.itemContentText].filter(Boolean).join(" "));

  return {
    categories: topCategories({
      titleText,
      bodyText,
      hosts: [itemHost],
      threshold: ITEM_SCORE_THRESHOLD,
      allowGeneralFallback: false,
    }),
  };
}
```

- [ ] **Step 5: Run the focused classifier test and verify pass**

Run from `apps/api`:

```bash
bunx --no-install dotenvx run -f ../../docker/.env -f .env -- bun test ../../tests/api/integration/modules/feeds/refresh/classifier.test.ts
```

Expected: PASS.

## Task 2: Classify Every Refreshed Item

**Files:**
- Modify: `packages/worker/src/services/feed/refresh.ts`
- Test: `tests/api/integration/modules/feeds/refresh/categories.test.ts`

**Interfaces:**
- Consumes: `classifyFeedItemCategories(input)` from Task 1.
- Consumes: `canonicalizeCategoryLabels(labels: readonly string[]): string[]`.
- Produces: `ParsedFeedItem.inferredCategoryLabels` for every refreshed item that has classifier labels after explicit-label filtering.

- [ ] **Step 1: Add a failing non-allowlisted refresh test**

Append this test to `tests/api/integration/modules/feeds/refresh/categories.test.ts` inside `describe("runFeedRefresh category ingestion", () => { ... })`:

```ts
  test("classifies item-level categories for non-allowlisted feeds", async () => {
    const fake = createFeedRefreshDb({
      feed: {
        id: "feed-1",
        url: "https://example.com/feed.xml",
        link: "https://example.com",
        title: "Daily Links",
        description: "A mixed collection of links from across the web.",
        faviconUrl: null,
        faviconSource: null,
        etag: null,
        lastModified: null,
        lastRefreshSucceededAt: null,
        lastRefreshFailedAt: null,
      },
    });
    globalThis.fetch = async () => {
      const response = new Response(
        `<?xml version="1.0"?>
        <rss version="2.0">
          <channel>
            <title>Daily Links</title>
            <link>https://example.com</link>
            <description>A mixed collection of links from across the web.</description>
            <item>
              <title>Open weights language model released</title>
              <link>https://huggingface.co/blog/open-model-release</link>
              <guid>ai-story</guid>
              <description>The transformer model uses embeddings and agent training data.</description>
              <pubDate>Wed, 01 Jul 2026 00:00:00 GMT</pubDate>
            </item>
            <item>
              <title>Bitcoin market rally lifts crypto stocks</title>
              <link>https://finance.yahoo.com/news/bitcoin-market-rally</link>
              <guid>finance-story</guid>
              <description>Investors watch the market, stock prices, and crypto trading volume.</description>
              <pubDate>Wed, 01 Jul 2026 01:00:00 GMT</pubDate>
            </item>
          </channel>
        </rss>`,
        { status: 200, headers: { "content-type": "application/rss+xml" } },
      );
      Object.defineProperty(response, "url", { value: "https://example.com/feed.xml" });
      return response;
    };

    const result = await runFeedRefresh(fake as never, "feed-1", undefined, {
      enrichArticles: false,
    });

    expect(result.ok).toBe(true);
    const itemLabels = labelsForAssignments(fake.feedItemCategoryAssignments, fake.categories);
    expect(itemLabels).toContain("AI & ML");
    expect(itemLabels).toContain("Finance & Markets");
    expect(fake.feedItemCategoryAssignments.every((row) => row.provenance === "classifier")).toBe(
      true,
    );
  });
```

- [ ] **Step 2: Run the focused refresh category test and verify failure**

Run from `apps/api`:

```bash
bunx --no-install dotenvx run -f ../../docker/.env -f .env -- bun test ../../tests/api/integration/modules/feeds/refresh/categories.test.ts
```

Expected: FAIL because `https://example.com` is not in `MIXED_FEED_HOSTS`, so no item classifier assignments are written.

- [ ] **Step 3: Remove the mixed-feed gate from refresh**

In `packages/worker/src/services/feed/refresh.ts`, remove `isMixedFeedHost` from the classifier import:

```ts
import {
  classifyFeedCategories,
  classifyFeedItemCategories,
  type InferredCategoryLabel,
} from "./classifier";
```

Delete the entire `isMixedFeed()` helper:

```ts
function isMixedFeed(input: {
  feed: { url: string; link: string | null };
  parsed: ParsedFeedDocument;
}): boolean {
  return (
    isMixedFeedHost(input.parsed.metadata.canonicalUrl) ||
    isMixedFeedHost(input.parsed.metadata.link) ||
    isMixedFeedHost(input.feed.url) ||
    isMixedFeedHost(input.feed.link)
  );
}
```

- [ ] **Step 4: Replace item classification logic**

In `packages/worker/src/services/feed/refresh.ts`, replace `classifyItemLevelCategories()` with:

```ts
/**
 * Classifies item-level categories for every item after enrichment. Explicit source
 * categories still win at read time; classifier labels only fill remaining chip slots.
 */
function classifyItemLevelCategories(input: {
  feed: { url: string; link: string | null; sourceKind: string | null };
  parsed: { metadata: FeedMetadata };
  items: ParsedFeedItem[];
}): ParsedFeedItem[] {
  return input.items.map((item) => {
    const explicitLabels = canonicalizeCategoryLabels(item.categoryLabels);
    const remainingChipSlots = Math.max(0, 2 - explicitLabels.length);
    if (remainingChipSlots === 0) {
      return { ...item, inferredCategoryLabels: [] };
    }

    const itemClassification = classifyFeedItemCategories({
      feedTitle: input.parsed.metadata.title,
      feedDescription: input.parsed.metadata.description,
      feedUrl: input.parsed.metadata.canonicalUrl || input.feed.url,
      feedSiteUrl: input.parsed.metadata.link ?? input.feed.link,
      sourceKind: input.feed.sourceKind,
      itemTitle: item.title,
      itemSummary: item.summary,
      itemContentText: item.contentText,
      itemUrl: item.link,
    });

    const inferredCategoryLabels = itemClassification.categories
      .filter((category) => !explicitLabels.includes(category.label))
      .slice(0, remainingChipSlots);

    return { ...item, inferredCategoryLabels };
  });
}
```

- [ ] **Step 5: Update the refresh callsite**

In `runFeedRefresh()`, delete this block:

```ts
    const mixedFeed = isMixedFeed({
      feed: feedForClassification,
      parsed: { metadata: parsed.metadata, items: [] },
    });
```

Then replace the item classification call with:

```ts
    items = classifyItemLevelCategories({
      feed: feedForClassification,
      parsed: { metadata: parsed.metadata },
      items,
    });
```

- [ ] **Step 6: Run refresh category tests**

Run from `apps/api`:

```bash
bunx --no-install dotenvx run -f ../../docker/.env -f .env -- bun test ../../tests/api/integration/modules/feeds/refresh/categories.test.ts
```

Expected: PASS.

## Task 3: Backfill Every Existing Item By Default

**Files:**
- Modify: `scripts/categories/backfill.ts`
- Test: `tests/api/integration/scripts/categories/backfill.test.ts`

**Interfaces:**
- Consumes: `classifyFeedItemCategories(input)` from Task 1.
- Produces: `parseBackfillArgs(argv): BackfillArgs` where `itemLimit` is `number | null`.
- Produces: `nextItemBackfillBatchSize(input: { itemLimit: number | null; processed: number }): number | null`.
- Produces: `inferBackfillItemCategories(feed, item): InferredCategoryLabel[]`.
- Produces: all-items default scanning with `--item-limit` as an explicit cap.

- [ ] **Step 1: Add failing backfill tests**

Replace the first two tests in `tests/api/integration/scripts/categories/backfill.test.ts` with:

```ts
  test("defaults to dry-run and scans all items", () => {
    expect(parseBackfillArgs(["bun", "backfill"])).toEqual({
      apply: false,
      limit: 500,
      itemLimit: null,
      feedId: null,
    });
  });

  test("parses apply, limit, item limit, and feed id", () => {
    expect(
      parseBackfillArgs([
        "bun",
        "backfill",
        "--apply",
        "--limit",
        "25",
        "--item-limit",
        "10",
        "--feed-id",
        "feed-1",
      ]),
    ).toEqual({
      apply: true,
      limit: 25,
      itemLimit: 10,
      feedId: "feed-1",
    });
  });
```

Add this import:

```ts
import {
  inferBackfillItemCategories,
  nextItemBackfillBatchSize,
  parseBackfillArgs,
  summarizeBackfill,
} from "../../../../../scripts/categories/backfill";
```

Add this test inside the same `describe("category backfill script", () => { ... })` block:

```ts
  test("classifies non-allowlisted feed items during backfill", () => {
    const labels = inferBackfillItemCategories(
      {
        title: "Daily Links",
        description: "A mixed collection of links.",
        url: "https://example.com/feed.xml",
        link: "https://example.com",
        sourceKind: "rss",
      },
      {
        title: "Bitcoin market rally lifts crypto stocks",
        summary: "Investors watch market prices, stock performance, and crypto trading volume.",
        contentText: null,
        link: "https://finance.yahoo.com/news/bitcoin-market-rally",
        canonicalUrl: "https://finance.yahoo.com/news/bitcoin-market-rally",
      },
    ).map((category) => category.label);

    expect(labels).toEqual(["Finance & Markets"]);
  });
```

Add this test inside the same `describe("category backfill script", () => { ... })` block:

```ts
  test("computes all-item and capped item backfill batches", () => {
    expect(nextItemBackfillBatchSize({ itemLimit: null, processed: 0 })).toBe(500);
    expect(nextItemBackfillBatchSize({ itemLimit: null, processed: 1500 })).toBe(500);
    expect(nextItemBackfillBatchSize({ itemLimit: 10, processed: 0 })).toBe(10);
    expect(nextItemBackfillBatchSize({ itemLimit: 750, processed: 0 })).toBe(500);
    expect(nextItemBackfillBatchSize({ itemLimit: 750, processed: 500 })).toBe(250);
    expect(nextItemBackfillBatchSize({ itemLimit: 750, processed: 750 })).toBeNull();
  });
```

- [ ] **Step 2: Run the focused backfill test and verify failure**

Run from `apps/api`:

```bash
bunx --no-install dotenvx run -f ../../docker/.env -f .env -- bun test ../../tests/api/integration/scripts/categories/backfill.test.ts
```

Expected:

- The default argument test fails because `itemLimit` is currently `50`.
- The batch-size helper import fails because `nextItemBackfillBatchSize()` does not exist.
- The helper import fails because `inferBackfillItemCategories()` does not exist.

- [ ] **Step 3: Update backfill types and parsing**

In `scripts/categories/backfill.ts`, change `BackfillArgs` to:

```ts
export type BackfillArgs = {
  apply: boolean;
  limit: number;
  itemLimit: number | null;
  feedId: string | null;
};
```

Add this helper below `positiveInt()`:

```ts
function optionalPositiveInt(value: string | null): number | null {
  if (!value) {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}
```

Replace `parseBackfillArgs()` with:

```ts
export function parseBackfillArgs(argv: string[]): BackfillArgs {
  return {
    apply: argv.includes("--apply"),
    limit: positiveInt(valueAfter(argv, "--limit"), 500),
    itemLimit: optionalPositiveInt(valueAfter(argv, "--item-limit")),
    feedId: valueAfter(argv, "--feed-id"),
  };
}
```

- [ ] **Step 4: Remove allowlist import and load item content text**

In `scripts/categories/backfill.ts`, remove `isMixedFeedHost` from the worker import.

Replace `loadRecentItems()` with:

```ts
const ITEM_BACKFILL_BATCH_SIZE = 500;

function loadItemsPage(feedId: string, limit: number, offset: number) {
  return db
    .select({
      id: feedItems.id,
      title: feedItems.title,
      summary: feedItems.summary,
      contentText: feedItems.contentText,
      link: feedItems.link,
      canonicalUrl: feedItems.canonicalUrl,
    })
    .from(feedItems)
    .where(eq(feedItems.feedId, feedId))
    .orderBy(desc(feedItems.publishedAt), desc(feedItems.id))
    .limit(limit)
    .offset(offset);
}
```

- [ ] **Step 5: Add pure backfill helpers**

Add this helper above `runCategoryBackfill()`:

```ts
export function nextItemBackfillBatchSize(input: {
  itemLimit: number | null;
  processed: number;
}): number | null {
  if (input.itemLimit === null) {
    return ITEM_BACKFILL_BATCH_SIZE;
  }
  const remaining = input.itemLimit - input.processed;
  if (remaining <= 0) {
    return null;
  }
  return Math.min(ITEM_BACKFILL_BATCH_SIZE, remaining);
}
```

Add these types and helper below it:

```ts
type BackfillFeedRow = {
  title: string;
  description: string | null;
  url: string;
  link: string | null;
  sourceKind: string | null;
};

type BackfillItemRow = {
  title: string;
  summary: string | null;
  contentText: string | null;
  link: string | null;
  canonicalUrl: string;
};

export function inferBackfillItemCategories(
  feed: BackfillFeedRow,
  item: BackfillItemRow,
): InferredCategoryLabel[] {
  return classifyFeedItemCategories({
    feedTitle: feed.title,
    feedDescription: feed.description,
    feedUrl: feed.url,
    feedSiteUrl: feed.link,
    sourceKind: feed.sourceKind,
    itemTitle: item.title,
    itemSummary: item.summary,
    itemContentText: item.contentText,
    itemUrl: item.link || item.canonicalUrl,
  }).categories;
}
```

- [ ] **Step 6: Replace item loop in `runCategoryBackfill()`**

Inside the `for (const feed of feedRows)` loop, replace the existing `mixedFeed`, `loadRecentItems()`, and `inferredItems` block with:

```ts
    let itemOffset = 0;
    let remainingItems = args.itemLimit ?? Number.POSITIVE_INFINITY;

    while (remainingItems > 0) {
      const batchSize = nextItemBackfillBatchSize({
        itemLimit: args.itemLimit,
        processed: itemOffset,
      });
      if (batchSize === null) {
        break;
      }
      const items = await loadItemsPage(feed.id, batchSize, itemOffset);
      if (items.length === 0) {
        break;
      }

      const inferredItems = items.map((item) => {
        stats.itemsScanned += 1;
        const inferredCategoryLabels = inferBackfillItemCategories(feed, item);
        if (inferredCategoryLabels.length > 0) {
          stats.itemsWithClassifierCategories += 1;
        }
        return { id: item.id, inferredCategoryLabels };
      });

      if (args.apply) {
        await syncInferredFeedCategories(
          db,
          {
            feedId: feed.id,
            feedCategories,
            items: inferredItems,
          },
          now,
        );
      }

      itemOffset += items.length;
      if (Number.isFinite(remainingItems)) {
        remainingItems -= items.length;
      }
      if (items.length < batchSize) {
        break;
      }
    }

    if (args.apply && itemOffset === 0) {
      await syncInferredFeedCategories(
        db,
        {
          feedId: feed.id,
          feedCategories,
          items: [],
        },
        now,
      );
    }
```

- [ ] **Step 7: Run the focused backfill test**

Run from `apps/api`:

```bash
bunx --no-install dotenvx run -f ../../docker/.env -f .env -- bun test ../../tests/api/integration/scripts/categories/backfill.test.ts
```

Expected: PASS.

## Task 4: Verify Read-Time Ranking And End-To-End Category Coverage

**Files:**
- Read: `apps/api/src/modules/articles/read/list/service.ts`
- Test: `tests/api/integration/modules/articles/read/list-tags.test.ts`
- Test: `tests/api/integration/modules/feeds/refresh/classifier.test.ts`
- Test: `tests/api/integration/modules/feeds/refresh/categories.test.ts`
- Test: `tests/api/integration/scripts/categories/backfill.test.ts`

**Interfaces:**
- Consumes: item/feed assignment provenance from Tasks 1-3.
- Produces: verified behavior that item classifier labels appear before feed fallback labels.

- [ ] **Step 1: Re-read category ranking SQL**

Confirm `apps/api/src/modules/articles/read/list/service.ts` still contains this ranking shape:

```ts
CASE WHEN ${feedItemCategoryAssignments.provenance} = 'classifier' THEN 1 ELSE 0 END AS source_rank
```

and:

```ts
CASE WHEN ${feedCategoryAssignments.provenance} = 'classifier' THEN 3 ELSE 2 END AS source_rank
```

Expected interpretation:

- rank `0`: explicit item assignment
- rank `1`: classifier item assignment
- rank `2`: explicit feed assignment
- rank `3`: classifier feed assignment

- [ ] **Step 2: Run list tag tests**

Run from `apps/api`:

```bash
bunx --no-install dotenvx run -f ../../docker/.env -f .env -- bun test ../../tests/api/integration/modules/articles/read/list-tags.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run the full focused category suite**

Run from `apps/api`:

```bash
bunx --no-install dotenvx run -f ../../docker/.env -f .env -- bun test ../../tests/api/integration/modules/feeds/refresh/classifier.test.ts ../../tests/api/integration/modules/feeds/refresh/categories.test.ts ../../tests/api/integration/scripts/categories/backfill.test.ts ../../tests/api/integration/modules/articles/read/list-tags.test.ts
```

Expected: PASS.

- [ ] **Step 4: Run app typecheck**

Run from repo root:

```bash
SKIP_ENV_VALIDATION=true bun run typecheck:app
```

Expected: PASS.

## Task 5: Manual Database Verification

**Files:**
- Read/write DB only through existing app scripts and worker refresh.

**Interfaces:**
- Consumes: `categories:backfill` script.
- Produces: observed classifier item rows for non-allowlisted feeds and visible chips in inbox.

- [ ] **Step 1: Dry-run backfill**

Run from repo root:

```bash
bun run categories:backfill
```

Expected:

- Output begins with `DRY RUN: scanned `.
- Output includes `would write classifier categories`.
- Output includes `would rewrite`.
- The reported item count includes all items for the scanned feeds unless `--item-limit` is supplied.

- [ ] **Step 2: Apply backfill for one feed first**

Run from repo root, using a real feed ID from the local database:

```bash
bun run categories:backfill -- --apply --feed-id 6b5c6215-a4f8-42cf-bfeb-e98d3dfd76a4
```

Expected:

- Output begins with `APPLIED: scanned 1 feeds`.
- Output includes `wrote classifier categories for 1 feeds`.
- Output includes `rewrote`.

- [ ] **Step 3: Inspect classifier item rows**

Run from repo root:

```bash
docker compose --env-file docker/.env.example --env-file docker/.env --project-directory docker exec -T postgres psql -U postgres -d kyomi -c "SELECT c.label, count(*)::int AS item_count FROM feed_item_category_assignments fica INNER JOIN categories c ON c.id = fica.category_id INNER JOIN feed_items fi ON fi.id = fica.feed_item_id WHERE fi.feed_id = '6b5c6215-a4f8-42cf-bfeb-e98d3dfd76a4' AND fica.provenance = 'classifier' GROUP BY c.label ORDER BY item_count DESC, c.label LIMIT 10;"
```

Verify rows exist in `feed_item_category_assignments` with `provenance = 'classifier'` for the chosen feed's items.

Expected:

- At least one row for `AI & ML`, `Security & Privacy`, `Science & Research`, `Finance & Markets`, `Food & Travel`, or another canonical label when recent items contain strong article-level signals.
- No deletion of `provenance = 'feed'` or `provenance = 'catalog'` rows.

- [ ] **Step 4: Apply full backfill**

Run from repo root:

```bash
bun run categories:backfill -- --apply
```

Expected:

- Existing feeds get feed-level classifier fallbacks.
- Existing feed items get item-level classifier labels when their own title, summary, content text, or URL host crosses threshold.

- [ ] **Step 5: Verify inbox visually**

Open the local app at `http://localhost:3000/inbox?filter=my-feed`.

Expected:

- Articles from mixed or broad feeds show item-specific chips.
- Articles with no item-level signal still show feed-level fallback chips.
- Chips do not require manual database inserts.

## Engineering Review Pass

### Scope Challenge

The minimal complete change touches three implementation files plus three focused test files. No new service, migration, dependency, or UI code is needed. Keeping `isMixedFeedHost()` exported avoids public API churn while removing it from the write path.

### Architecture Review

No architecture gaps remain. The plan reuses the existing assignment tables and read-time precedence. The only behavior change is where classifier rows are generated:

```text
refresh/backfill
  feed row
    -> feed classifier fallback
  item row
    -> explicit labels canonicalized
    -> item classifier from item-only text
    -> classifier rows stored lower than explicit rows
```

Failure mode covered: item text is sparse. The classifier returns no item labels, `syncInferredFeedCategories()` writes no item row, and read time falls back to feed-level assignment.

Failure mode covered: explicit source labels already fill both chip slots. Refresh writes no classifier item label for that item, avoiding hidden lower-priority noise.

Failure mode covered: backfill over a large feed. The plan processes items in batches of 500 and preserves `--item-limit` as an explicit cap.

### Code Quality Review

No code quality gaps remain. The plan keeps the scoring change local to `classifier.ts`, keeps refresh orchestration in `refresh.ts`, and keeps backfill-specific batching in `scripts/categories/backfill.ts`. The pure `inferBackfillItemCategories()` helper exists only so the script's classification behavior can be tested without a live database.

### Test Review

Coverage map:

```text
classifier.ts
  classifyFeedCategories()
    -> existing feed tests
  classifyFeedItemCategories()
    -> item URL host scoring
    -> item title scoring
    -> item summary scoring
    -> item contentText scoring
    -> no feed title/description scoring

refresh.ts
  classifyFeedLevelCategories()
    -> existing no-RSS-category refresh test
  classifyItemLevelCategories()
    -> non-allowlisted feed item classifier test
    -> existing mixed feed item classifier test
    -> explicit category sync tests stay intact

backfill.ts
  parseBackfillArgs()
    -> dry-run default
    -> --apply, --limit, --item-limit, --feed-id
  nextItemBackfillBatchSize()
    -> all-items default
    -> capped first batch
    -> capped final partial batch
    -> capped complete state
  inferBackfillItemCategories()
    -> non-allowlisted feed item test
  runCategoryBackfill()
    -> dry-run/apply summary tests

service.ts
  feedCategoryLabelsSql
    -> existing ranking shape test
    -> existing two-label cap test
```

No untested branch blocks implementation. Pagination math is covered by `nextItemBackfillBatchSize()`, item classification is covered by `inferBackfillItemCategories()`, and database write behavior is still smoke-verified with dry-run/apply counts.

### Performance Review

No performance gaps remain. Item classification is pure in-process string matching over the existing taxonomy. Refresh already iterates every parsed item; adding one classifier call per item does not add I/O. Backfill batching prevents loading every item for a feed into memory at once.

### Plan-Tune Pass

No user question is needed. The complete path is clearly better than preserving the allowlist gate: it improves article accuracy, keeps explicit categories authoritative, and avoids adding dependencies or UI work.

## Implementation Tasks

Synthesized from this review's findings. Each task derives from a specific finding above. Run with Codex or Claude Code; checkbox as you ship.

- [ ] **T1 (P1, human: ~45m / CC: ~10m)** — Classifier — Score item categories from item-only text and URL host.
  - Surfaced by: Architecture Review — parent feed metadata currently dilutes item category scoring.
  - Files: `packages/worker/src/services/feed/classifier.ts`, `tests/api/integration/modules/feeds/refresh/classifier.test.ts`
  - Verify: classifier focused test command from Task 1.
- [ ] **T2 (P1, human: ~1h / CC: ~15m)** — Refresh — Classify every refreshed item regardless of host allowlist.
  - Surfaced by: Scope Challenge — the hard mixed-feed gate blocks item-level chips for broad non-allowlisted feeds.
  - Files: `packages/worker/src/services/feed/refresh.ts`, `tests/api/integration/modules/feeds/refresh/categories.test.ts`
  - Verify: refresh category focused test command from Task 2.
- [ ] **T3 (P1, human: ~1h / CC: ~15m)** — Backfill — Classify every existing item by default and keep explicit cap support.
  - Surfaced by: Performance Review — existing backfill only classifies allowlisted recent items.
  - Files: `scripts/categories/backfill.ts`, `tests/api/integration/scripts/categories/backfill.test.ts`
  - Verify: backfill focused test command from Task 3.
- [ ] **T4 (P2, human: ~30m / CC: ~5m)** — Verification — Run ranking, focused suite, typecheck, and local backfill smoke checks.
  - Surfaced by: Test Review — article-list ranking and manual data population must be verified together.
  - Files: `apps/api/src/modules/articles/read/list/service.ts` read-only, database state through `categories:backfill`
  - Verify: commands from Tasks 4 and 5.

## Commit Checkpoints

- After Task 1 passes, create a GitButler checkpoint commit named `fix(feeds): score item categories independently`.
- After Tasks 2 and 3 pass, create a GitButler checkpoint commit named `fix(feeds): classify every feed item`.
- After Tasks 4 and 5 pass, create a GitButler checkpoint commit named `test(feeds): verify article category coverage` if verification-only test/docs changes remain.
- Use `but diff` before each commit and include only the file IDs for this plan's files in each `but commit feat/feed-metadata ... --changes` invocation.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | not run | Backend accuracy refinement; CEO review not required |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | not run | Not requested for this plan |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAR | 0 unresolved, 0 critical gaps after folding scope, architecture, test, and performance checks into the plan |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | not run | No UI changes planned |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | not run | No developer-facing API or setup change beyond backfill defaults |

**VERDICT:** ENG CLEARED — ready to implement.

NO UNRESOLVED DECISIONS
