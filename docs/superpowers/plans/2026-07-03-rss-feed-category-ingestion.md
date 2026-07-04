# RSS Feed Category Ingestion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make category chips work for normally followed RSS/Atom feeds, not only catalog-imported feeds.

**Architecture:** Feed parsing extracts feed-level and item-level category labels from RSS and Atom metadata. Feed refresh persists those labels with `provenance = "feed"` into the existing category and assignment tables, syncing only feed-provenance rows so catalog assignments remain untouched. Article list queries return up to two labels with item-level categories first, then feed-level categories.

**Tech Stack:** Bun, TypeScript, fast-xml-parser, Drizzle ORM, Postgres, existing `@kyomi/db` schema.

## Global Constraints

- Do not add a database migration. Existing `categories`, `feed_category_assignments`, and `feed_item_category_assignments` already support this.
- Preserve catalog provenance. Do not delete or overwrite `provenance = "catalog"` assignments.
- Bound parser output to avoid malicious feeds creating unbounded category writes.
- Use `bunx` rather than `npx` for one-off CLI tooling.
- Use GitButler for version-control write operations.

---

## Assessment Of Claude's Response

Claude's core claim is correct: the PR currently renders category chips only when `feed_category_assignments` already contains rows, and the normal worker refresh path only writes `feed_items`. Verified code:

- `scripts/catalog/import.ts` has `assignCatalogCategory()` and writes `feed_category_assignments` with `provenance: "catalog"`.
- `packages/worker/src/services/feed/refresh.ts` parses feeds, updates `feeds`, and upserts `feedItems`, but writes no category rows.
- `apps/api/src/modules/articles/read/list/service.ts` exposes chip labels through `feedCategoryLabelsSql`, which reads only feed-level category assignments.

Claude's proposed option 1 is the right base, but it is incomplete if it only handles channel-level categories. RSS and Atom often place categories on individual items. The complete implementation should support both:

```
fetch feed
  |
  v
parse RSS/Atom
  |-- channel/feed categories ----------.
  |                                      v
  |                              feed_category_assignments
  |
  '-- item categories per entry --------.
                                         v
                                 feed_item_category_assignments

article list SQL
  |
  '-- item categories first, feed categories fallback -> DTO -> existing chips
```

## What Already Exists

- `packages/db/src/schema/sources.ts` already defines the category dictionary and both feed-level and item-level assignment tables.
- `apps/api/src/modules/articles/read/list/service.ts` already joins category labels into article rows without N+1 queries.
- `apps/web/src/modules/feeds/components/item/tag-chip-row.tsx` already renders up to two category chips plus overflow.
- `apps/api/src/modules/catalog/import.ts` already has the correct slug normalization behavior, but the function lives in the catalog API module instead of a shared package.

## NOT In Scope

- AI tagging: separate roadmap work behind `FEATURE_AI_ARTICLE_INTELLIGENCE`.
- Category search filters: search metadata already has roadmap notes, but the user asked for chips from followed feeds.
- OPML backfill: future refreshes will populate categories; a separate backfill job can refresh existing feeds.
- UI redesign: chip rendering already exists and should remain unchanged.

## Task 1: Share Category Slug Normalization

**Files:**
- Create: `packages/db/src/categories.ts`
- Modify: `packages/db/src/index.ts`
- Modify: `apps/api/src/modules/catalog/import.ts`
- Test: `tests/api/integration/scripts/import-catalog-feeds.test.ts`

**Interfaces:**
- Produces: `toCategorySlug(label: string): string`
- Consumes: existing catalog import tests and worker category assignment code.

- [ ] **Step 1: Move slug normalization into `@kyomi/db`**

Create `packages/db/src/categories.ts`:

```ts
/**
 * Normalize a category label to a lowercase ASCII slug per the schema invariant. Labels with
 * no ASCII alphanumerics fall back to deterministic hex so non-Latin categories still dedupe.
 */
export function toCategorySlug(label: string): string {
  const asciiSlug = label
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (asciiSlug) return asciiSlug;

  const normalized = label.normalize("NFKC").trim().toLowerCase();
  if (!/[\p{L}\p{N}]/u.test(normalized)) return "";

  const hex = Array.from(normalized)
    .map((char) => char.codePointAt(0)!.toString(16))
    .join("-");
  return `u-${hex}`;
}
```

Update `packages/db/src/index.ts`:

```ts
export * from "./schema";
export * from "./better-auth";
export * from "./categories";
```

- [ ] **Step 2: Re-export through catalog import**

Modify `apps/api/src/modules/catalog/import.ts`:

```ts
import { toCategorySlug } from "@kyomi/db";
export { toCategorySlug };
```

Remove the local `toCategorySlug` implementation from that file.

- [ ] **Step 3: Verify catalog slug tests still pass**

Run:

```bash
bun test tests/api/integration/scripts/import-catalog-feeds.test.ts
```

Expected: all tests pass, including non-Latin fallback.

## Task 2: Parse Feed And Item Category Labels

**Files:**
- Modify: `packages/worker/src/services/feed/types.ts`
- Modify: `packages/worker/src/services/feed/parse.ts`
- Test: `tests/api/integration/modules/feeds/refresh/parse-feed-document.test.ts`

**Interfaces:**
- Produces: `ParsedFeedDocument.metadata.categoryLabels: string[]`
- Produces: `ParsedFeedItem.categoryLabels: string[]`

- [ ] **Step 1: Extend parser types**

Add `categoryLabels` to `FeedMetadata` and `ParsedFeedItem`.

- [ ] **Step 2: Add bounded category extraction helpers**

Add helpers in `parse.ts`:

```ts
const MAX_CATEGORY_LABELS_PER_SCOPE = 20;
const MAX_CATEGORY_LABEL_LENGTH = 120;

function normalizeCategoryLabel(value: string): string | null {
  const normalized = stripTags(value).replace(/\s+/g, " ").trim();
  if (!normalized) return null;
  return normalized.length > MAX_CATEGORY_LABEL_LENGTH
    ? normalized.slice(0, MAX_CATEGORY_LABEL_LENGTH).trim()
    : normalized;
}

function collectCategoryLabels(value: unknown, labels: string[]): void {
  for (const candidate of toArray(value)) {
    if (typeof candidate === "string") {
      const label = normalizeCategoryLabel(candidate);
      if (label) labels.push(label);
      continue;
    }
    if (!candidate || typeof candidate !== "object") continue;
    const record = candidate as Record<string, unknown>;
    for (const key of ["#text", "@_text", "@_term", "@_label"]) {
      const raw = record[key];
      if (typeof raw === "string") {
        const label = normalizeCategoryLabel(raw);
        if (label) labels.push(label);
      }
    }
    collectCategoryLabels(record["itunes:category"], labels);
    collectCategoryLabels(record.category, labels);
  }
}

function categoryLabelsFrom(...values: unknown[]): string[] {
  const labels: string[] = [];
  for (const value of values) collectCategoryLabels(value, labels);
  const seen = new Set<string>();
  return labels.filter((label) => {
    const key = label.toLocaleLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, MAX_CATEGORY_LABELS_PER_SCOPE);
}
```

- [ ] **Step 3: Wire RSS and Atom categories**

RSS feed metadata:

```ts
categoryLabels: categoryLabelsFrom(channel.category, channel["itunes:category"]),
```

RSS items:

```ts
categoryLabels: categoryLabelsFrom(record.category, record["itunes:category"]),
```

Atom feed metadata:

```ts
categoryLabels: categoryLabelsFrom(feed.category),
```

Atom entries:

```ts
categoryLabels: categoryLabelsFrom(record.category),
```

- [ ] **Step 4: Add parser tests**

Add tests asserting:

```ts
expect(parsed.metadata.categoryLabels).toEqual(["Technology", "Podcasts"]);
expect(parsed.items[0]?.categoryLabels).toEqual(["JavaScript", "Programming"]);
expect(parsed.items[1]?.categoryLabels).toEqual([]);
```

Also add an Atom test:

```ts
expect(parsed.metadata.categoryLabels).toEqual(["Engineering"]);
expect(parsed.items[0]?.categoryLabels).toEqual(["AI"]);
```

## Task 3: Persist Feed-Provenance Category Assignments

**Files:**
- Create: `packages/worker/src/services/feed/categories.ts`
- Modify: `packages/worker/src/services/feed/refresh.ts`
- Test: `tests/api/integration/modules/feeds/refresh/categories.test.ts`

**Interfaces:**
- Consumes: `ParsedFeedDocument.metadata.categoryLabels`
- Consumes: `ParsedFeedItem.categoryLabels`
- Produces: synced rows in `feed_category_assignments` and `feed_item_category_assignments`

- [ ] **Step 1: Add category assignment helper**

Create `packages/worker/src/services/feed/categories.ts` with:

```ts
import { and, eq, inArray } from "drizzle-orm";
import {
  categories,
  feedCategoryAssignments,
  feedItemCategoryAssignments,
  toCategorySlug,
} from "@kyomi/db";
import type { FeedIngestDatabase, ParsedFeedItem } from "./types";

type CategoryAssignmentDatabase = Pick<FeedIngestDatabase, "delete" | "insert">;

type CategoryRecord = {
  slug: string;
  label: string;
};

function normalizeRecords(labels: string[]): CategoryRecord[] {
  const bySlug = new Map<string, CategoryRecord>();
  for (const label of labels) {
    const trimmed = label.trim();
    const slug = toCategorySlug(trimmed);
    if (!slug || bySlug.has(slug)) continue;
    bySlug.set(slug, { slug, label: trimmed });
  }
  return Array.from(bySlug.values());
}

async function upsertCategories(
  database: CategoryAssignmentDatabase,
  records: CategoryRecord[],
  now: Date,
): Promise<Map<string, string>> {
  if (records.length === 0) return new Map();
  const rows = await database
    .insert(categories)
    .values(records.map((record) => ({
      id: crypto.randomUUID(),
      slug: record.slug,
      label: record.label,
      provenance: "feed",
      createdAt: now,
      updatedAt: now,
    })))
    .onConflictDoUpdate({
      target: categories.slug,
      set: { updatedAt: now },
    })
    .returning({ id: categories.id, slug: categories.slug });
  return new Map(rows.map((row) => [row.slug, row.id]));
}

export async function syncParsedFeedCategories(
  database: CategoryAssignmentDatabase,
  input: { feedId: string; feedLabels: string[]; items: ParsedFeedItem[] },
  now: Date,
): Promise<void> {
  const itemIds = input.items.map((item) => item.id);
  await database
    .delete(feedCategoryAssignments)
    .where(and(eq(feedCategoryAssignments.feedId, input.feedId), eq(feedCategoryAssignments.provenance, "feed")));

  if (itemIds.length > 0) {
    await database
      .delete(feedItemCategoryAssignments)
      .where(and(inArray(feedItemCategoryAssignments.feedItemId, itemIds), eq(feedItemCategoryAssignments.provenance, "feed")));
  }

  const allRecords = normalizeRecords([
    ...input.feedLabels,
    ...input.items.flatMap((item) => item.categoryLabels),
  ]);
  const categoryIdsBySlug = await upsertCategories(database, allRecords, now);

  const feedRecords = normalizeRecords(input.feedLabels);
  if (feedRecords.length > 0) {
    await database.insert(feedCategoryAssignments).values(feedRecords.flatMap((record) => {
      const categoryId = categoryIdsBySlug.get(record.slug);
      return categoryId ? [{
        id: crypto.randomUUID(),
        feedId: input.feedId,
        categoryId,
        provenance: "feed",
        createdAt: now,
        updatedAt: now,
      }] : [];
    }));
  }

  const itemAssignments = input.items.flatMap((item) =>
    normalizeRecords(item.categoryLabels).flatMap((record) => {
      const categoryId = categoryIdsBySlug.get(record.slug);
      return categoryId ? [{
        id: crypto.randomUUID(),
        feedItemId: item.id,
        categoryId,
        provenance: "feed",
        createdAt: now,
        updatedAt: now,
      }] : [];
    }),
  );
  if (itemAssignments.length > 0) {
    await database.insert(feedItemCategoryAssignments).values(itemAssignments);
  }
}
```

Implementation may use `onConflictDoUpdate` on assignment inserts if Drizzle requires conflict handling for repeated refreshes. Because the helper deletes current feed-provenance rows first, conflicts should be rare, but conflict handling is safe.

- [ ] **Step 2: Call helper inside refresh transaction**

In `packages/worker/src/services/feed/refresh.ts`, after `feedItems` upsert inside the transaction:

```ts
await syncParsedFeedCategories(
  tx,
  {
    feedId: feed.id,
    feedLabels: parsed.metadata.categoryLabels,
    items,
  },
  now,
);
```

Call the helper even when `items.length === 0` so channel-level categories persist for empty feeds.

- [ ] **Step 3: Add persistence tests**

Create `tests/api/integration/modules/feeds/refresh/categories.test.ts` with a fake refresh DB and global fetch. Assert:

```ts
expect(result.ok).toBe(true);
expect(fake.categories.map((row) => row.label)).toEqual([
  "Technology",
  "Programming",
  "JavaScript",
]);
expect(fake.feedCategoryAssignments).toHaveLength(1);
expect(fake.feedItemCategoryAssignments).toHaveLength(2);
expect(fake.deletes).toContain("feed_category_assignments");
expect(fake.deletes).toContain("feed_item_category_assignments");
```

## Task 4: Return Item Categories Before Feed Categories

**Files:**
- Modify: `apps/api/src/modules/articles/read/list/service.ts`
- Modify: `apps/api/src/modules/articles/types.ts`
- Test: `tests/api/integration/modules/articles/read/list-tags.test.ts`

**Interfaces:**
- Produces: DTO `categories` remains `string[]`, now sourced from item categories first and feed categories second.

- [ ] **Step 1: Extend category label SQL**

Import `feedItemCategoryAssignments` and update `feedCategoryLabelsSql` to union item-level and feed-level category IDs:

```ts
export const feedCategoryLabelsSql = sql<string[]>`(
  SELECT COALESCE(array_agg(ac.label ORDER BY ac.source_rank, ac.label, ac.id), ARRAY[]::text[])
  FROM (
    SELECT ${categories.label} AS label, ${categories.id} AS id, min(source_rank) AS source_rank
    FROM (
      SELECT ${feedItemCategoryAssignments.categoryId} AS category_id, 0 AS source_rank
      FROM ${feedItemCategoryAssignments}
      WHERE ${feedItemCategoryAssignments.feedItemId} = ${feedItems.id}
      UNION ALL
      SELECT ${feedCategoryAssignments.categoryId} AS category_id, 1 AS source_rank
      FROM ${feedCategoryAssignments}
      WHERE ${feedCategoryAssignments.feedId} = ${feedItems.feedId}
    ) AS assignments
    INNER JOIN ${categories} ON ${categories.id} = assignments.category_id
    GROUP BY ${categories.label}, ${categories.id}
    ORDER BY source_rank, ${categories.label}, ${categories.id}
    LIMIT 2
  ) AS ac
)`;
```

- [ ] **Step 2: Update DTO comment**

Change the `ArticleListItemDto.categories` comment to:

```ts
/** Category labels for footer chips, item-level first and feed-level fallback, capped by SQL. */
```

- [ ] **Step 3: Add SQL shape test**

Add a test that `feedCategoryLabelsSql.getSQL()` contains both `feed_item_category_assignments` and `feed_category_assignments` so future edits cannot silently regress to feed-only labels.

## Task 5: Focused Verification And Commit

**Files:**
- All files above.

- [ ] **Step 1: Run focused tests**

```bash
bun test tests/api/integration/modules/feeds/refresh/parse-feed-document.test.ts
bun test tests/api/integration/modules/feeds/refresh/categories.test.ts
bun test tests/api/integration/modules/articles/read/list-tags.test.ts
bun test tests/api/integration/scripts/import-catalog-feeds.test.ts
```

- [ ] **Step 2: Run package typecheck when focused tests pass**

```bash
bun run typecheck:app
```

- [ ] **Step 3: Commit and push**

Use GitButler:

```bash
but diff
but commit feat/feed-metadata -m "feat(feeds): ingest rss category metadata" --changes <ids>
but push feat/feed-metadata
```

## Eng Review Report

### Step 0 Scope Challenge

Scope accepted with one expansion: item-level categories are included because the schema already exists and RSS feeds often put categories on items. This avoids a second incomplete implementation.

### Architecture Review

No new infrastructure. The change reuses existing schema and the existing single-query DTO path. Production failure scenario: a feed emits thousands of categories. Parser limits categories per scope, and persistence de-dupes by slug before writing.

### Code Quality Review

One DRY issue found and fixed in the plan: move `toCategorySlug()` out of the catalog API module so catalog import and worker ingestion use the same slug rules.

### Test Review

```
CODE PATHS                                               USER FLOWS
[+] parseFeedDocument()                                  [+] Followed RSS feed refresh
  |-- [GAP] RSS channel category extraction                |-- [GAP] chips appear from channel categories
  |-- [GAP] RSS item category extraction                   |-- [GAP] chips appear from item categories
  |-- [GAP] Atom feed/entry category extraction            '-- [GAP] stale feed-provenance rows are replaced
  '-- [TESTED] entity expansion guard remains

[+] runFeedRefresh()
  |-- [GAP] sync feed-provenance feed assignments
  |-- [GAP] sync feed-provenance item assignments
  '-- [TESTED] failure path remains unchanged

[+] article list category SQL
  |-- [GAP] item-level category first
  '-- [TESTED] DTO decodes labels and schema includes categories
```

Coverage target: all new parser branches, persistence branches, and SQL shape changes get focused tests.

### Performance Review

No N+1 query added to article list. Refresh-time category writes are bounded and batched by unique slug. Deleting only `provenance = "feed"` rows keeps stale feed-derived metadata accurate without touching catalog assignments.

### Failure Modes

- Feed category is empty or punctuation-only: slug is empty, assignment is skipped, test covered by existing slug tests.
- Feed changes categories after a prior refresh: feed-provenance rows are deleted and replaced, persistence test covers deletion.
- Item and feed share the same category: SQL groups by category ID and returns the item-level category first without duplicate chips.
- Feed has no categories: helper deletes stale feed-provenance rows and writes nothing.

### Worktree Parallelization

Sequential implementation, no parallelization opportunity. Parser, persistence, and API SQL touch connected modules and should land together.

## Implementation Tasks

- [ ] **T1 (P1, human: ~45m / CC: ~10m)** — worker parser — Extract RSS and Atom feed/item category labels.
  - Surfaced by: Architecture Review — worker did not parse category metadata.
  - Files: `packages/worker/src/services/feed/parse.ts`, `packages/worker/src/services/feed/types.ts`
  - Verify: `bun test tests/api/integration/modules/feeds/refresh/parse-feed-document.test.ts`
- [ ] **T2 (P1, human: ~60m / CC: ~15m)** — worker refresh — Persist feed-provenance feed and item category assignments.
  - Surfaced by: Architecture Review — worker did not write category assignments.
  - Files: `packages/worker/src/services/feed/categories.ts`, `packages/worker/src/services/feed/refresh.ts`
  - Verify: `bun test tests/api/integration/modules/feeds/refresh/categories.test.ts`
- [ ] **T3 (P1, human: ~30m / CC: ~10m)** — article API — Return item categories before feed-level fallbacks.
  - Surfaced by: Test Review — existing SQL only reads feed-level assignments.
  - Files: `apps/api/src/modules/articles/read/list/service.ts`, `apps/api/src/modules/articles/types.ts`
  - Verify: `bun test tests/api/integration/modules/articles/read/list-tags.test.ts`
- [ ] **T4 (P2, human: ~20m / CC: ~5m)** — shared utility — Share category slug normalization between catalog import and worker ingestion.
  - Surfaced by: Code Quality Review — duplicate slug logic would create drift.
  - Files: `packages/db/src/categories.ts`, `packages/db/src/index.ts`, `apps/api/src/modules/catalog/import.ts`
  - Verify: `bun test tests/api/integration/scripts/import-catalog-feeds.test.ts`

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | not run | Not needed for backend completion of existing roadmap task |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | skipped | User requested immediate implementation after local eng review |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAR | 4 issues folded into plan, 0 critical gaps |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | skipped | Existing UI chip rendering remains unchanged |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | skipped | No developer-facing flow changed |

- **VERDICT:** ENG CLEARED — ready to implement.
NO UNRESOLVED DECISIONS
