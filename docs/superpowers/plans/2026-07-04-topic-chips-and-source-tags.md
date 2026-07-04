# Topic Chips And Source Tags Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep visible article chips as clean canonical topics while preserving raw publisher tags separately for search and diagnostics.

**Architecture:** Reuse Kyomi's existing canonical category assignment path for user-facing topics and the existing `feed_item_tag_assignments` table for raw source tags. Refresh writes both: canonical categories power list/reader chips, and raw feed item labels are stored as `provenance = "feed"` tags without entering the category dictionary or chip UI.

**Tech Stack:** Bun, TypeScript, Drizzle/Postgres, `@kyomi/db`, `@kyomi/worker`, Elysia API DTOs, TanStack React Start web modules, Vitest/Bun integration tests, GitButler for checkpoint commits.

## Global Constraints

- Do not add a database migration; `feed_item_tag_assignments` already exists.
- Do not show raw source tags in the main list or reader UI.
- Do not add external ML, LLM, embedding, or network dependencies.
- Keep visible article chips limited to canonical labels from `CANONICAL_CATEGORY_LABELS`.
- Keep the article-list chip cap at two labels.
- Preserve read-time precedence: explicit item category, classifier item category, explicit feed category, classifier feed category.
- For mixed feeds, item-level categories remain preferred; broad feed fallback should stay suppressible.
- If confidence is low, show no canonical chip rather than `Miscellaneous`.
- Do not implement the later correction affordance in this plan.
- Use GitButler (`but`) for version-control inspection and commits. Do not use raw `git add` or `git commit`.
- Use the dedicated GitButler branch name `codex/topic-chips-source-tags` for this implementation.

---

## Product Validity

The proposed hybrid is valid and matches the product goal:

```text
publisher labels from feed
  ├─ canonicalize when recognized -> categories table -> visible chips
  └─ preserve raw label exactly enough -> feed_item_tag_assignments -> search/debug later

classifier signal
  └─ item-level first -> canonical categories -> visible chips

reader/list display
  └─ same categories array -> same visible chips
```

Why this is the right shape:

- Users need a small, stable topic language, not arbitrary publisher strings.
- Raw feed tags are still valuable evidence, especially for search, audits, and future "why this topic?" explanations.
- Hacker News and other mixed feeds should not inherit broad feed labels just to fill the chip slot.
- The current code already does most of the clean-topic work; the gaps are raw tag preservation and reader/list consistency.

## What Already Exists

- `packages/db/src/schema/sources.ts` already defines `categories`, `feedCategoryAssignments`, `feedItemCategoryAssignments`, and `feedItemTagAssignments`.
- `packages/worker/src/services/feed/parse.ts` already extracts RSS/Atom/JSON Feed labels into `ParsedFeedItem.categoryLabels` and feed metadata `categoryLabels`.
- `packages/worker/src/services/feed/categories.ts` already canonicalizes parsed source labels before writing category assignments.
- `packages/worker/src/services/feed/classifier.ts` and `taxonomy.ts` already produce canonical classifier categories.
- `apps/api/src/modules/articles/read/list/service.ts` already ranks item categories ahead of feed fallback and caps chips at two.
- `apps/web/src/modules/feeds/components/item/categories.tsx` already renders the shared visual chip style.
- `apps/api/src/modules/articles/read/detail.ts` currently returns `categories: []`, which is the main reader/list consistency gap.

## NOT In Scope

- Manual "wrong topic?" feedback UI. This remains a later product loop.
- User-specific topic preferences or hidden-topic rules.
- Showing raw source tags in feed rows, reader header, or public article DTOs.
- Historical raw tag backfill for old items whose original feed labels were already discarded. Future refreshes will capture raw tags for refreshed items.
- Article search indexing changes. This plan preserves raw tags so search can use them later.
- Replacing the deterministic taxonomy.
- Adding a tag-management UI or an "Article info" panel.

## File Structure

- Create `packages/worker/src/services/feed/tags.ts` for raw source-tag normalization and sync.
- Modify `packages/worker/src/services/feed/refresh.ts` to write raw item tags in the same transaction as feed items and category assignments.
- Modify `packages/worker/src/services/feed/types.ts` to add an optional raw-tag count to refresh stats.
- Create `apps/api/src/modules/articles/read/category-labels.ts` to share the canonical category-label SQL between list and detail reads.
- Modify `apps/api/src/modules/articles/read/list/service.ts` to import the shared SQL instead of owning it inline.
- Modify `apps/api/src/modules/articles/read/list/views.ts` to import the shared SQL from the new module.
- Modify `apps/api/src/modules/articles/read/detail.ts` to return the same canonical categories as list rows.
- Modify `apps/web/src/modules/reader/components/article/index.tsx` to render the existing `Categories` component in the reader header.
- Extend API and web tests under `tests/api/integration/...` and `tests/web/integration/...`.

## Acceptance Criteria

- Feed item raw labels such as `JavaScript`, `2026-07`, or `internal-section/foo` are persisted in `feed_item_tag_assignments` with `provenance = "feed"`.
- Unmapped raw labels never create `categories` rows and never appear as visible chips.
- Mapped source labels can still produce canonical category assignments.
- Classifier item labels still fill canonical chips when parsed item labels do not canonicalize.
- Article list and article detail return the same `categories` array for the same feed item.
- Reader detail shows the same 1-2 canonical topic chips as the list item.
- Raw source tags are not added to public API DTOs in this plan.

## Task 1: Persist Raw Source Tags During Refresh

**Files:**
- Create: `packages/worker/src/services/feed/tags.ts`
- Modify: `packages/worker/src/services/feed/refresh.ts`
- Modify: `packages/worker/src/services/feed/types.ts`
- Test: `tests/api/integration/modules/feeds/refresh/categories.test.ts`

**Interfaces:**
- Consumes: `ParsedFeedItem.id` and `ParsedFeedItem.categoryLabels`.
- Produces: `syncParsedFeedItemTags(database, items, now): Promise<number>`.
- Produces: tag rows in `feed_item_tag_assignments` with `provenance = "feed"` and `confidence = null`.
- Produces: optional `sourceTagAssignments?: number` on `FeedRefreshCategoryStats`.

- [ ] **Step 1: Add failing raw tag persistence coverage**

Extend the fake database in `tests/api/integration/modules/feeds/refresh/categories.test.ts` so it captures inserts and deletes for `feed_item_tag_assignments`.

Add this test:

```ts
test("persists raw source tags separately from canonical category chips", async () => {
  const fake = createRefreshDb();
  globalThis.fetch = mockFetch(() => {
    const response = new Response(
      `<?xml version="1.0"?>
      <rss version="2.0">
        <channel>
          <title>Example Feed</title>
          <link>https://example.com</link>
          <description>Mixed labels</description>
          <item>
            <title>TypeScript release notes</title>
            <link>https://example.com/typescript</link>
            <guid>typescript-release</guid>
            <category>JavaScript</category>
            <category>internal-section/foo</category>
            <category>2026-07</category>
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
  expect(result.categoryStats?.sourceTagAssignments).toBe(3);
  expect(fake.feedItemTagAssignments).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ label: "JavaScript", slug: "javascript", provenance: "feed" }),
      expect.objectContaining({
        label: "internal-section/foo",
        slug: "internal-section-foo",
        provenance: "feed",
      }),
      expect.objectContaining({ label: "2026-07", slug: "2026-07", provenance: "feed" }),
    ]),
  );
  expect(labelsForAssignments(fake.feedItemCategoryAssignments, fake.categories)).toEqual([
    "Software Engineering",
  ]);
  expect(fake.categories.map((row) => row.label)).not.toContain("internal-section/foo");
});
```

- [ ] **Step 2: Run the focused test and verify failure**

Run from `apps/api`:

```bash
bunx --no-install dotenvx run -f ../../docker/.env -f .env -- bun test ../../tests/api/integration/modules/feeds/refresh/categories.test.ts
```

Expected: FAIL because `feed_item_tag_assignments` is not written and `sourceTagAssignments` does not exist.

- [ ] **Step 3: Create raw tag sync helper**

Create `packages/worker/src/services/feed/tags.ts`:

```ts
import { and, eq, inArray, sql } from "drizzle-orm";
import { feedItemTagAssignments, toCategorySlug } from "@kyomi/db";
import type { FeedIngestDatabase, ParsedFeedItem } from "./types";

const SOURCE_TAG_PROVENANCE = "feed";
const MAX_SOURCE_TAGS_PER_ITEM = 20;

type SourceTagAssignmentDatabase = Pick<FeedIngestDatabase, "delete" | "insert">;

type SourceTagRecord = {
  slug: string;
  label: string;
};

export function normalizeSourceTagRecords(labels: readonly string[]): SourceTagRecord[] {
  const bySlug = new Map<string, SourceTagRecord>();
  for (const label of labels) {
    const normalized = label.replace(/\s+/g, " ").trim();
    if (!normalized) {
      continue;
    }
    const slug = toCategorySlug(normalized);
    if (!slug || bySlug.has(slug)) {
      continue;
    }
    bySlug.set(slug, { slug, label: normalized });
    if (bySlug.size >= MAX_SOURCE_TAGS_PER_ITEM) {
      break;
    }
  }
  return Array.from(bySlug.values());
}

export async function syncParsedFeedItemTags(
  database: SourceTagAssignmentDatabase,
  items: Pick<ParsedFeedItem, "id" | "categoryLabels">[],
  now: Date,
): Promise<number> {
  const itemIds = items.map((item) => item.id);
  if (itemIds.length === 0) {
    return 0;
  }

  await database
    .delete(feedItemTagAssignments)
    .where(
      and(
        inArray(feedItemTagAssignments.feedItemId, itemIds),
        eq(feedItemTagAssignments.provenance, SOURCE_TAG_PROVENANCE),
      ),
    );

  const rows = items.flatMap((item) =>
    normalizeSourceTagRecords(item.categoryLabels).map((record) => ({
      id: crypto.randomUUID(),
      feedItemId: item.id,
      slug: record.slug,
      label: record.label,
      provenance: SOURCE_TAG_PROVENANCE,
      confidence: null,
      createdAt: now,
      updatedAt: now,
    })),
  );

  if (rows.length === 0) {
    return 0;
  }

  await database
    .insert(feedItemTagAssignments)
    .values(rows)
    .onConflictDoUpdate({
      target: [
        feedItemTagAssignments.feedItemId,
        feedItemTagAssignments.slug,
        feedItemTagAssignments.provenance,
      ],
      set: {
        label: sql`excluded.label`,
        confidence: null,
        updatedAt: now,
      },
    });

  return rows.length;
}
```

- [ ] **Step 4: Extend refresh stats**

In `packages/worker/src/services/feed/types.ts`, extend `FeedRefreshCategoryStats`:

```ts
export type FeedRefreshCategoryStats = {
  feedClassifierLabels: number;
  itemClassifierLabels: number;
  itemClassifierAbstentions: number;
  suppressedFeedClassifierFallback: boolean;
  sourceTagAssignments?: number;
};
```

- [ ] **Step 5: Wire raw tag sync into refresh**

In `packages/worker/src/services/feed/refresh.ts`, import the helper:

```ts
import { syncParsedFeedItemTags } from "./tags";
```

Before the existing `await database.transaction(async (tx) => { ... })`, initialize the count so it can be returned after the transaction:

```ts
    let sourceTagAssignments = 0;
```

Inside the existing refresh transaction, after feed item upsert and before the transaction closes, add:

```ts
      sourceTagAssignments = await syncParsedFeedItemTags(tx, items, now);
```

Then include it in the success result:

```ts
sourceTagAssignments,
```

The final success stats block should contain:

```ts
categoryStats: {
  feedClassifierLabels: feedCategories.length,
  itemClassifierLabels: itemCategoryStats.itemClassifierLabels,
  itemClassifierAbstentions: itemCategoryStats.itemClassifierAbstentions,
  suppressedFeedClassifierFallback: feedClassification.suppressedFallback,
  sourceTagAssignments,
},
```

- [ ] **Step 6: Run the focused test and verify pass**

Run from `apps/api`:

```bash
bunx --no-install dotenvx run -f ../../docker/.env -f .env -- bun test ../../tests/api/integration/modules/feeds/refresh/categories.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit Task 1**

Use GitButler:

```bash
but diff
but commit codex/topic-chips-source-tags -m "feat(feeds): preserve raw source tags"
```

Commit only the Task 1 files.

## Task 2: Share Canonical Category SQL Between List And Detail

**Files:**
- Create: `apps/api/src/modules/articles/read/category-labels.ts`
- Modify: `apps/api/src/modules/articles/read/list/service.ts`
- Modify: `apps/api/src/modules/articles/read/list/views.ts`
- Modify: `apps/api/src/modules/articles/read/detail.ts`
- Test: `tests/api/integration/modules/articles/read/list-tags.test.ts`
- Test: `tests/api/integration/modules/articles/read/detail-tags.test.ts`

**Interfaces:**
- Consumes: existing `feedCategoryLabelsSql` SQL body.
- Produces: `feedCategoryLabelsSql` from `apps/api/src/modules/articles/read/category-labels.ts`.
- Produces: `toFeedArticleDetailDtoForTest(row)` for focused DTO mapping tests.

- [ ] **Step 1: Add failing detail mapping test**

Create `tests/api/integration/modules/articles/read/detail-tags.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { toFeedArticleDetailDtoForTest } from "@modules/articles/read/detail";

function rawDetailRow(overrides: Partial<Parameters<typeof toFeedArticleDetailDtoForTest>[0]> = {}) {
  const base = {
    id: "item-1",
    title: "Article &amp; title",
    link: "https://example.com/article",
    summary: null,
    content: null,
    contentHtml: null,
    contentText: null,
    contentMarkdown: "Body",
    contentStatus: "ready",
    contentSource: "feed_markdown",
    extractionErrorCode: null,
    extractionErrorMessage: null,
    extractedContentHtml: null,
    extractedContentText: null,
    extractedContentStatus: "pending",
    extractedContentError: null,
    extractedContentUpdatedAt: null,
    publishedAt: new Date("2026-07-01T00:00:00.000Z"),
    feedId: "feed-1",
    feedUrl: "https://example.com/feed.xml",
    feedSiteUrl: "https://example.com",
    feedTitle: "Example Feed",
    feedFaviconUrl: null,
    isRead: false,
    isSaved: false,
    categories: ["Software Engineering", "AI &amp; ML"],
  } satisfies Parameters<typeof toFeedArticleDetailDtoForTest>[0];

  return { ...base, ...overrides };
}

describe("article detail categories", () => {
  test("returns the same canonical category labels as list rows", () => {
    const item = toFeedArticleDetailDtoForTest(rawDetailRow());
    expect(item.categories).toEqual(["Software Engineering", "AI & ML"]);
  });

  test("defaults detail categories to an empty array", () => {
    const item = toFeedArticleDetailDtoForTest(rawDetailRow({ categories: [] }));
    expect(item.categories).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the new test and verify failure**

Run from `apps/api`:

```bash
bunx --no-install dotenvx run -f ../../docker/.env -f .env -- bun test ../../tests/api/integration/modules/articles/read/detail-tags.test.ts
```

Expected: FAIL because `toFeedArticleDetailDtoForTest` does not exist.

- [ ] **Step 3: Extract shared category SQL**

Create `apps/api/src/modules/articles/read/category-labels.ts`:

```ts
import { sql } from "drizzle-orm";
import {
  categories,
  feedCategoryAssignments,
  feedItemCategoryAssignments,
  feedItems,
} from "@kyomi/db";

/**
 * Correlated subquery yielding up to two canonical category labels per feed item.
 * Precedence: explicit item, classifier item, explicit feed, classifier feed.
 */
export const feedCategoryLabelsSql = sql<string[]>`(
  SELECT COALESCE(array_agg(fc.label ORDER BY fc.source_rank, fc.label, fc.id), ARRAY[]::text[])
  FROM (
    SELECT ${categories.label} AS label, ${categories.id} AS id, min(category_sources.source_rank) AS source_rank
    FROM (
      SELECT
        ${feedItemCategoryAssignments.categoryId} AS category_id,
        CASE WHEN ${feedItemCategoryAssignments.provenance} = 'classifier' THEN 1 ELSE 0 END AS source_rank
      FROM ${feedItemCategoryAssignments}
      WHERE ${feedItemCategoryAssignments.feedItemId} = ${feedItems.id}
      UNION ALL
      SELECT
        ${feedCategoryAssignments.categoryId} AS category_id,
        CASE WHEN ${feedCategoryAssignments.provenance} = 'classifier' THEN 3 ELSE 2 END AS source_rank
      FROM ${feedCategoryAssignments}
      WHERE ${feedCategoryAssignments.feedId} = ${feedItems.feedId}
    ) AS category_sources
    INNER JOIN ${categories} ON ${categories.id} = category_sources.category_id
    GROUP BY ${categories.label}, ${categories.id}
    ORDER BY source_rank, ${categories.label}, ${categories.id}
    LIMIT 2
  ) AS fc
)`;
```

- [ ] **Step 4: Update list service to use shared SQL**

In `apps/api/src/modules/articles/read/list/service.ts`:

- Remove the local `feedCategoryLabelsSql` definition.
- Remove now-unused imports of `categories`, `feedCategoryAssignments`, and `feedItemCategoryAssignments`.
- Add:

```ts
import { feedCategoryLabelsSql } from "../category-labels";
```

In `apps/api/src/modules/articles/read/list/views.ts`, replace:

```ts
import { feedCategoryLabelsSql, listArticlesForUser } from "./service";
```

with:

```ts
import { feedCategoryLabelsSql } from "../category-labels";
import { listArticlesForUser } from "./service";
```

In `tests/api/integration/modules/articles/read/list-tags.test.ts`, import the SQL from the shared module:

```ts
import { feedCategoryLabelsSql } from "@modules/articles/read/category-labels";
```

Run the existing list tag tests:

```bash
cd apps/api && bunx --no-install dotenvx run -f ../../docker/.env -f .env -- bun test ../../tests/api/integration/modules/articles/read/list-tags.test.ts
```

Expected: PASS.

- [ ] **Step 5: Add detail DTO mapping helper**

In `apps/api/src/modules/articles/read/detail.ts`, introduce this row type and mapping helper near `getFeedArticleDetailForUser`:

```ts
type FeedArticleDetailRawRow = {
  id: string;
  title: string;
  link: string;
  summary: string | null;
  content: string | null;
  contentHtml: string | null;
  contentText: string | null;
  contentMarkdown: string | null;
  contentStatus: string | null;
  contentSource: string | null;
  extractionErrorCode: string | null;
  extractionErrorMessage: string | null;
  extractedContentHtml: string | null;
  extractedContentText: string | null;
  extractedContentStatus: string | null;
  extractedContentError: string | null;
  extractedContentUpdatedAt: Date | null;
  publishedAt: Date;
  feedId: string;
  feedUrl: string | null;
  feedSiteUrl: string | null;
  feedTitle: string;
  feedFaviconUrl: string | null;
  isRead: boolean;
  isSaved: boolean;
  categories: string[];
};
```

Move the existing return-object logic into:

```ts
function toFeedArticleDetailDto(r: FeedArticleDetailRawRow): ArticleDetailDto {
  const extractedStatus = (r.extractedContentStatus as ExtractedContentStatus) ?? "pending";
  const readerOriginal = buildStoredReaderContent({
    articleType: "feed",
    title: decodeText(r.title),
    summary: decodeNullableText(r.summary),
    contentBaseUrl: r.link,
    legacyContent: decodeNullableText(r.content),
    contentHtml: r.contentHtml,
    contentText: decodeNullableText(r.contentText),
    contentMarkdown: r.contentMarkdown,
    contentStatus: (r.contentStatus as ArticleDetailDto["contentStatus"]) ?? "pending",
    contentSource: (r.contentSource as ArticleDetailDto["contentSource"]) ?? "link_only",
    extractionErrorCode: r.extractionErrorCode,
    extractionErrorMessage: r.extractionErrorMessage,
  });
  const readerExtracted = buildExtractedReaderViewFromDb({
    articleType: "feed",
    title: decodeText(r.title),
    summary: decodeNullableText(r.summary),
    contentBaseUrl: r.link,
    extractedContentHtml: r.extractedContentHtml,
    extractedContentText: r.extractedContentText ? decodeNullableText(r.extractedContentText) : null,
    extractedContentStatus: extractedStatus,
  });
  const reader = buildArticleReaderDto({
    readerOriginal,
    readerExtracted,
    extractedContentStatus: extractedStatus,
    extractedContentError: r.extractedContentError,
    extractedContentUpdatedAt: r.extractedContentUpdatedAt?.toISOString() ?? null,
  });

  return {
    id: r.id,
    title: decodeText(r.title),
    link: r.link,
    summary: decodeNullableText(r.summary),
    contentHtml: r.contentHtml,
    contentText: decodeNullableText(r.contentText),
    contentMarkdown: r.contentMarkdown,
    contentStatus: (r.contentStatus as ArticleDetailDto["contentStatus"]) ?? "pending",
    contentSource: (r.contentSource as ArticleDetailDto["contentSource"]) ?? "link_only",
    extractionErrorCode: r.extractionErrorCode,
    extractionErrorMessage: r.extractionErrorMessage,
    publishedAt: r.publishedAt.toISOString(),
    feedId: r.feedId,
    feedUrl: r.feedUrl,
    feedSiteUrl: r.feedSiteUrl,
    feedTitle: decodeText(r.feedTitle),
    feedFaviconUrl: r.feedFaviconUrl,
    isRead: r.isRead,
    isSaved: Boolean(r.isSaved),
    articleType: "feed",
    categories: r.categories.map((label) => decodeText(label)),
    reader,
  };
}

export const toFeedArticleDetailDtoForTest = toFeedArticleDetailDto;
```

- [ ] **Step 6: Select categories in detail query**

In `apps/api/src/modules/articles/read/detail.ts`, import shared SQL:

```ts
import { feedCategoryLabelsSql } from "./category-labels";
```

Add to the detail query select:

```ts
categories: feedCategoryLabelsSql,
```

Replace the inline return object with:

```ts
return toFeedArticleDetailDto(r);
```

- [ ] **Step 7: Run focused detail/list tests**

Run from `apps/api`:

```bash
bunx --no-install dotenvx run -f ../../docker/.env -f .env -- bun test ../../tests/api/integration/modules/articles/read/detail-tags.test.ts ../../tests/api/integration/modules/articles/read/list-tags.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit Task 2**

Use GitButler:

```bash
but diff
but commit codex/topic-chips-source-tags -m "fix(articles): return topic chips in article detail"
```

Commit only the Task 2 files.

## Task 3: Render Reader Topic Chips

**Files:**
- Modify: `apps/web/src/modules/reader/components/article/index.tsx`
- Test: `tests/web/integration/src/modules/reader/components/article/category-chips.test.tsx`

**Interfaces:**
- Consumes: `ArticleDetailDto.categories`.
- Reuses: `Categories` from `@modules/feeds/components/item/categories`.
- Produces: reader header chip row matching list item chip semantics.

- [ ] **Step 1: Add failing reader chip test**

Create `tests/web/integration/src/modules/reader/components/article/category-chips.test.tsx`.

The test should render `Article` with `categories: ["Software Engineering", "AI & ML"]`, mock `@kyomi/reader/web` to avoid rendering real article HTML, and assert both chips are visible.

Use this assertion body:

```ts
expect(screen.getByText("Software Engineering")).toBeTruthy();
expect(screen.getByText("AI & ML")).toBeTruthy();
```

Add a second test with `categories: []` and assert no chip text is rendered.

- [ ] **Step 2: Run the new web test and verify failure**

Run:

```bash
cd tests && bunx vitest run --config web/vitest.config.ts web/integration/src/modules/reader/components/article/category-chips.test.tsx
```

Expected: FAIL because the reader header does not render categories.

- [ ] **Step 3: Render categories in the reader header**

In `apps/web/src/modules/reader/components/article/index.tsx`, add:

```ts
import { Categories } from "@modules/feeds/components/item/categories";
```

Inside `ReaderArticleHeader`, after the title block, add:

```tsx
      <Categories
        categories={item.categories}
        fontSizePx={sourceLabelFontSizePx}
        className="not-prose"
      />
```

Do not add copy that explains topics or raw tags in the UI.

- [ ] **Step 4: Run reader and feed chip tests**

Run:

```bash
cd tests && bunx vitest run --config web/vitest.config.ts web/integration/src/modules/reader/components/article/category-chips.test.tsx web/integration/src/modules/feeds/components/item/feed-item-tag-chips.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit Task 3**

Use GitButler:

```bash
but diff
but commit codex/topic-chips-source-tags -m "feat(reader): show article topic chips"
```

Commit only the Task 3 files.

## Task 4: Verify The End-To-End Contract

**Files:**
- Modify only if checks reveal a defect.

**Interfaces:**
- Consumes: outputs from Tasks 1-3.
- Produces: verified topic/tag contract.

- [ ] **Step 1: Run focused API tests**

Run from `apps/api`:

```bash
bunx --no-install dotenvx run -f ../../docker/.env -f .env -- bun test ../../tests/api/integration/modules/feeds/refresh/categories.test.ts ../../tests/api/integration/modules/articles/read/detail-tags.test.ts ../../tests/api/integration/modules/articles/read/list-tags.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run focused web tests**

Run:

```bash
cd tests && bunx vitest run --config web/vitest.config.ts web/integration/src/modules/reader/components/article/category-chips.test.tsx web/integration/src/modules/feeds/components/item/feed-item-tag-chips.test.tsx
```

Expected: PASS.

- [ ] **Step 3: Run typechecks**

Run:

```bash
bun run --cwd tests typecheck
bun run typecheck:app
```

Expected: PASS.

- [ ] **Step 4: Run formatting check**

Run:

```bash
bun run fmt:check
git diff --check
```

Expected: PASS.

- [ ] **Step 5: Manual product check**

Open the inbox and verify:

- Mixed-feed item with a confident item topic shows 1-2 chips in the list.
- Opening that article shows the same chips in reader detail.
- An item with no confident canonical topic shows no chip.
- Raw labels such as dates or internal sections do not appear as chips.

- [ ] **Step 6: Commit verification fixes only if needed**

If verification required code changes, commit with GitButler:

```bash
but diff
but commit codex/topic-chips-source-tags -m "test(topics): verify source tag and chip contract"
```

## Test Coverage Diagram

```text
INGESTION
RSS/Atom/JSON item categoryLabels
  ├── [TEST] syncParsedFeedCategories()
  │     ├── mapped label -> canonical category assignment -> visible chip
  │     └── unmapped label -> dropped from category dictionary
  └── [NEW TEST] syncParsedFeedItemTags()
        ├── raw mapped label -> raw tag row
        ├── raw unmapped label -> raw tag row
        ├── duplicate slug -> first label wins
        └── empty/no labels -> stale feed raw tags deleted

READ API
feedCategoryLabelsSql
  ├── [TEST] list item categories
  └── [NEW TEST] detail categories use same SQL + decode path

WEB
Article list item
  └── [TEST] renders up to two canonical chips
Reader article header
  └── [NEW TEST] renders the same canonical chips

RAW TAGS
feed_item_tag_assignments
  ├── [NEW TEST] written during refresh
  └── [NOT EXPOSED] no list/reader DTO field in this plan
```

## Failure Modes

- **Publisher emits spammy raw labels:** raw tags are capped at 20 per item and never shown as chips.
- **Publisher changes tags for an existing item:** refresh deletes/replaces `provenance = "feed"` tag rows for refreshed items.
- **Raw label slug collides:** first label per item/slug wins during normalization; later refresh can update label through upsert.
- **Detail query drifts from list query:** shared `feedCategoryLabelsSql` prevents parallel SQL copies.
- **Reader chip row causes visual overflow:** existing `Categories` component truncates and caps chips at two.
- **Historical items lack raw tags:** accepted limitation; raw tags are captured on future refreshes only.

## Worktree Parallelization

Sequential implementation, no parallelization opportunity. The work touches one ingestion path, one article read contract, and one reader display path that depend on each other.

## Plan-Tune Refinements Applied

- No extra user question is needed; the product direction is explicit.
- Defaults locked: raw tags are stored, not shown; canonical categories remain the only visible topic chips.
- Correction affordance is deferred because it is a user-feedback product loop, not required to fix the tagging contract.

## Engineering Review Refinements Applied

- Reuse `feed_item_tag_assignments`; no migration.
- Keep raw tags out of `categories` to protect the canonical topic dictionary.
- Extract category SQL before using it in detail, avoiding copy/paste drift.
- Add tests at ingestion, API mapping, and reader rendering layers.
- Keep scope small enough for one branch and one verification pass.

## Implementation Tasks

- [ ] **T1 (P1, human: ~2h / CC: ~20min)** — worker ingestion — Persist raw source tags from parsed item labels.
  - Surfaced by: product validity review — raw publisher labels are currently discarded after canonicalization.
  - Files: `packages/worker/src/services/feed/tags.ts`, `packages/worker/src/services/feed/refresh.ts`, `packages/worker/src/services/feed/types.ts`, `tests/api/integration/modules/feeds/refresh/categories.test.ts`
  - Verify: focused feed refresh categories test passes.
- [ ] **T2 (P1, human: ~90min / CC: ~15min)** — API article reads — Return canonical categories from article detail using the same SQL as list rows.
  - Surfaced by: engineering review — `detail.ts` currently hardcodes `categories: []`.
- Files: `apps/api/src/modules/articles/read/category-labels.ts`, `apps/api/src/modules/articles/read/list/service.ts`, `apps/api/src/modules/articles/read/list/views.ts`, `apps/api/src/modules/articles/read/detail.ts`, `tests/api/integration/modules/articles/read/detail-tags.test.ts`, `tests/api/integration/modules/articles/read/list-tags.test.ts`
  - Verify: focused list/detail tag tests pass.
- [ ] **T3 (P2, human: ~45min / CC: ~10min)** — reader UI — Render canonical topic chips in reader detail.
  - Surfaced by: product consistency review — list and reader should show the same chips.
  - Files: `apps/web/src/modules/reader/components/article/index.tsx`, `tests/web/integration/src/modules/reader/components/article/category-chips.test.tsx`
  - Verify: focused reader/feed chip tests pass.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | skipped | Product scope supplied directly by user; no separate CEO review requested for this plan. |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | skipped | Not run; plan is based on direct repo inspection. |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAR | Reuse existing tag table, no migration, shared SQL for list/detail, tests added across ingestion/API/UI. |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | skipped | UI change reuses existing chip component and style. |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | skipped | No developer-facing workflow change. |

- **VERDICT:** ENG CLEARED — ready to implement.

NO UNRESOLVED DECISIONS
