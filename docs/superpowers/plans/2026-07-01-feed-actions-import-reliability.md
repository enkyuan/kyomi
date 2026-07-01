# Feed Actions And Import Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make inbox article actions honest and durable, make broken-article reporting a real dialog-backed submission, make OPML imports populate new feeds, and prevent blocked HTML pages from masquerading as empty feeds.

**Architecture:** Keep UI behavior thin and push durable state into the article API and database. OPML import should reuse the existing feed-subscription refresh enqueue path instead of inventing a second refresh path. Feed refresh should fail loudly on unexpected HTML at ingestion time so the UI shows a refresh problem instead of a clean empty feed.

**Tech Stack:** Bun, Elysia, Drizzle/Postgres, TanStack React Start server functions, React 19, Vitest, Bun test, Base UI via `@kyomi/ui`, `@kyomi/worker` feed ingestion.

## Global Constraints

- Do not edit this plan while executing it; advance checkbox status only.
- Preserve the app shell sidebar position and existing inbox layout behavior.
- Prefer existing Kyomi module boundaries and concrete imports; avoid feeds/inbox/sidebar barrel cycles.
- Use `@kyomi/ui` primitives for dialogs, fields, forms, buttons, and toasts.
- Use Tailwind utility classes for small frontend styling changes.
- Keep `apps/api/src/modules/feeds/routes.ts` thin; feed refresh enqueue remains under `apps/api/src/modules/feeds/refresh/`.
- Normal app runtime/setup must not require Poetry or catalog sync.
- Use `bunx`, not `npx`, for one-off CLI tooling.
- Database migrations must be explicit and must update `packages/db/drizzle/meta/_journal.json`.

---

## Investigation Summary

The feedback points are connected but not the same bug:

1. `Not interested` currently calls `updateItem({ isRead: true }, true)` in `apps/web/src/modules/feeds/components/item/toolbar.tsx`. That only marks the item read and optimistically removes it from the current cache. In `filter=all&feedId=...`, read articles still belong in the list, so a refetch can bring the item back.
2. `Report broken article` currently copies a plaintext report to the clipboard in `apps/web/src/modules/feeds/components/item/toolbar.tsx`. It does not open a dialog and does not persist a report.
3. OPML import toasts start with `timeout: 0`. Promise success will eventually use the provider timeout, but the completion toast is not explicit and can look stuck.
4. OPML import feed jobs call `createOrSubscribeToFeed(...)` and record success, but they do not enqueue a feed refresh. New subscriptions created from OPML can therefore show zero items until some later scheduler/manual refresh touches them.
5. Feed refresh treats HTML as a successful feed with `items: []`. If a network policy or remote service redirects RSS to a block/landing HTML page, the worker updates the feed metadata, marks refresh success, and inserts nothing.

## What Already Exists

- `apps/api/src/modules/feeds/subscription/routes.ts` already enqueues `enqueueFeedRefresh(db, feedId, userId, "subscription_created", logger)` after a new subscription. OPML import should reuse that.
- `packages/worker/src/services/feed/refresh.ts` already marks refresh failures with `refreshStatus = "failed"` and stores `lastRefreshError`. The HTML-response fix should throw before successful metadata update.
- `packages/ui/src/feedback-dialog.tsx` and `apps/web/src/modules/settings/components/feedback/index.tsx` already establish the local dialog/form style for feedback-like input.
- `apps/web/src/modules/inbox/hooks/use-inbox-data.ts` already has an optimistic mutation path with `removeFromList`; `Not interested` can reuse it once the API patch is durable.
- Existing tests already cover the relevant surfaces: article read/write/list tests, OPML route/job tests, worker parse tests, item toolbar tests, and sources dialog OPML tests.

## NOT in Scope

- A visible "Hidden articles" management page: useful later, but not required to make `Not interested` durable.
- Email, Slack, or external support integration for broken-article reports: persistence in the app database is enough for this fix.
- Feed autodiscovery during worker refresh: discovery can keep accepting website URLs, but refresh of a stored feed URL must not treat HTML as success.
- Reworking the OPML import progress model: the current Redis task-store can stay.
- Changing the screenshot layout or adding new empty-state copy: this plan fixes the data path that produced the empty Engineering at Meta feed.

## File Structure

- Create `packages/db/drizzle/0025_article_reports_and_hidden_state.sql`: database migration for hidden state and report persistence.
- Modify `packages/db/drizzle/meta/_journal.json`: register migration `0025_article_reports_and_hidden_state`.
- Modify `packages/db/src/schema/articles.ts`: add `hiddenAt` on `feedItemUserState` and add `articleReports`.
- Modify `apps/api/src/modules/articles/types.ts`: accept `isHidden` in article update inputs.
- Modify `apps/api/src/modules/articles/schemas.ts`: validate `isHidden` and broken report request body.
- Modify `apps/api/src/modules/articles/write/update.ts`: write and clear hidden state.
- Create `apps/api/src/modules/articles/write/reports.ts`: report lookup/access check and insert service.
- Modify `apps/api/src/modules/articles/write/routes.ts`: add `POST /articles/:articleId/reports/broken`.
- Modify `apps/api/src/modules/articles/read/dedupe.ts`, `list.ts`, `counts.ts`, and `views-merged.ts`: exclude hidden feed items from list/count views.
- Modify `apps/web/src/lib/schemas.ts`: add reusable message response schema if not already present.
- Modify `apps/web/src/modules/inbox/services/api.ts`: add `isHidden` to update patch and add `reportBrokenArticle`.
- Modify `apps/web/src/modules/inbox/hooks/use-inbox-data.ts`: allow `isHidden` optimistic patches.
- Create `apps/web/src/modules/feeds/components/item/broken-article-report-dialog.tsx`: dialog UI and submission state.
- Modify `apps/web/src/modules/feeds/components/item/toolbar.tsx`: render dialog, open it from menu, and call `updateItem({ isHidden: true }, true)` for `Not interested`.
- Modify `apps/api/src/modules/opml/service.ts`: enqueue refresh for newly created OPML subscriptions.
- Modify `packages/worker/src/services/feed/parse.ts`: reject HTML documents during feed parsing.
- Modify `apps/web/src/modules/feeds/components/follow/sources-dialog.tsx`: explicit promise toast success/error timeouts.
- Test files: `tests/api/integration/modules/articles/routes.test.ts`, `tests/api/integration/modules/articles/write/update-hidden-state.test.ts`, `tests/api/integration/modules/articles/read/list.test.ts`, `tests/api/integration/modules/opml/routes.test.ts`, `tests/api/integration/modules/feeds/parse-feed-document.test.ts`, `tests/web/integration/modules/feeds/item-toolbar.test.tsx`, `tests/web/integration/modules/feeds/sources-dialog.test.tsx`.

## Data Flow

```
Not interested
  toolbar menu
    -> useInboxItemStateMutation({ isHidden: true }, removeFromList: true)
      -> POST server fn updateInboxItemState
        -> PUT /api/v1/articles/:id
          -> feed_item_user_state.hidden_at = now()
            -> list/count queries add hidden_at IS NULL
              -> refetch cannot bring the article back

Broken report
  toolbar menu
    -> BrokenArticleReportDialog
      -> reportBrokenArticle server fn
        -> POST /api/v1/articles/:id/reports/broken
          -> createBrokenArticleReport
            -> access check for feed item or clip
            -> article_reports insert with article metadata snapshot

OPML import
  opml.import.feed job
    -> createOrSubscribeToFeed
      -> if newSubscription
        -> enqueueFeedRefresh(..., "subscription_created")
      -> recordOpmlTaskSuccess
        -> worker feed.refresh job inserts items

Blocked feed HTML
  fetchFeedDocument returns ok + text/html body
    -> parseFeedDocument sees <html> or <!doctype html>
      -> throw Unsupported feed format: received HTML document
        -> runFeedRefresh catch marks feed refresh failed
          -> no metadata overwrite, no false successful zero-item feed
```

## Failure Modes

- Hidden state migration not applied: API typecheck may pass but runtime PUT fails on missing column. Covered by migration registration and article update/list tests.
- Hiding an item only updates one cache page: mutation invalidates `["inbox", "items"]`, `["inbox", "view-count"]`, detail, and sidebar summary after optimistic removal. Covered by existing mutation path and toolbar test.
- Report submit double-click creates duplicate reports: acceptable for now; the UI disables submit while pending. Covered by dialog test.
- Report endpoint accepts an inaccessible article id: service must 404 unless the current user owns the clip or subscribes to the feed. Covered by API route test.
- OPML import refresh enqueue fails because Redis is down: existing `subscription_created` enqueue path logs a warning and returns empty job id, then import success still records subscription. Covered by service behavior reuse.
- HTML rejection breaks JSON/RSS/Atom feeds: parse tests keep JSON/RSS/Atom coverage and add only the HTML rejection case.
- Toast completion never dismisses: explicit success/error timeout options make final-state duration deterministic. Covered by sources dialog test.

## Worktree Parallelization

| Step | Modules touched | Depends on |
|------|-----------------|------------|
| Database contract | `packages/db`, article API types | - |
| Article API hidden/report | `apps/api/src/modules/articles` | Database contract |
| Inbox UI actions/dialog | `apps/web/src/modules/inbox`, `apps/web/src/modules/feeds` | Article API hidden/report |
| OPML refresh enqueue | `apps/api/src/modules/opml`, feeds refresh | - |
| Worker HTML rejection | `packages/worker` | - |
| OPML toast timing | `apps/web/src/modules/feeds/components/follow` | - |
| Final verification | whole repo | all tasks |

Parallel lanes:

- Lane A: Database contract -> Article API hidden/report -> Inbox UI actions/dialog.
- Lane B: OPML refresh enqueue.
- Lane C: Worker HTML rejection.
- Lane D: OPML toast timing.

Execution order: launch B, C, and D in parallel. Start A first if a single implementer is doing the work because later UI/API tasks depend on the database contract. Merge all lanes, then run final verification.

Conflict flags: Lane A and D both touch `apps/web/src/modules/feeds`, but different subdirectories. Coordinate if parallel worktrees are used.

## Implementation Tasks

### Task 1: Database Contract For Hidden State And Reports

**Files:**
- Create: `packages/db/drizzle/0025_article_reports_and_hidden_state.sql`
- Modify: `packages/db/drizzle/meta/_journal.json`
- Modify: `packages/db/src/schema/articles.ts`

**Interfaces:**
- Produces: `feedItemUserState.hiddenAt: Date | null`
- Produces: `articleReports` Drizzle table with `id`, `userId`, `articleId`, `articleType`, `feedItemId`, `clipId`, `reason`, `details`, `articleTitle`, `articleUrl`, `feedTitle`, `feedUrl`, `createdAt`
- Consumes: existing `users`, `feedItems`, and `articleClips` schema exports

- [ ] **Step 1: Write the migration**

Create `packages/db/drizzle/0025_article_reports_and_hidden_state.sql` with:

```sql
ALTER TABLE "feed_item_user_state" ADD COLUMN "hidden_at" timestamp;

CREATE INDEX "feed_item_user_state_hidden_idx"
  ON "feed_item_user_state" ("user_id", "hidden_at", "feed_item_id")
  WHERE "hidden_at" IS NOT NULL;

CREATE TABLE "article_reports" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "article_id" text NOT NULL,
  "article_type" text NOT NULL,
  "feed_item_id" text,
  "clip_id" text,
  "reason" text NOT NULL,
  "details" text,
  "article_title" text NOT NULL,
  "article_url" text NOT NULL,
  "feed_title" text,
  "feed_url" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "article_reports"
  ADD CONSTRAINT "article_reports_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "article_reports"
  ADD CONSTRAINT "article_reports_feed_item_id_feed_items_id_fk"
  FOREIGN KEY ("feed_item_id") REFERENCES "feed_items"("id") ON DELETE set null ON UPDATE no action;

ALTER TABLE "article_reports"
  ADD CONSTRAINT "article_reports_clip_id_article_clips_id_fk"
  FOREIGN KEY ("clip_id") REFERENCES "article_clips"("id") ON DELETE set null ON UPDATE no action;

CREATE INDEX "article_reports_user_created_idx"
  ON "article_reports" ("user_id", "created_at" DESC);

CREATE INDEX "article_reports_article_created_idx"
  ON "article_reports" ("article_id", "created_at" DESC);
```

- [ ] **Step 2: Register the migration**

Append this entry to `packages/db/drizzle/meta/_journal.json` after index 24:

```json
{
  "idx": 25,
  "version": "7",
  "when": 1782878760000,
  "tag": "0025_article_reports_and_hidden_state",
  "breakpoints": true
}
```

- [ ] **Step 3: Update Drizzle schema**

In `packages/db/src/schema/articles.ts`, add `hiddenAt` to `feedItemUserState`, then add `articleReports` after the existing `articleClips` table so both referenced tables are declared before the report table:

```ts
export const feedItemUserState = pgTable(
  "feed_item_user_state",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    feedItemId: text("feed_item_id")
      .notNull()
      .references(() => feedItems.id, { onDelete: "cascade" }),
    readOverride: boolean("read_override"),
    isSaved: boolean("is_saved").notNull().default(false),
    lastViewedAt: timestamp("last_viewed_at"),
    hiddenAt: timestamp("hidden_at"),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.feedItemId] }),
    index("feed_item_user_state_viewed_idx")
      .on(table.userId, table.lastViewedAt.desc(), table.feedItemId.desc())
      .where(sql`${table.lastViewedAt} IS NOT NULL`),
    index("feed_item_user_state_saved_idx")
      .on(table.userId, table.isSaved, table.feedItemId)
      .where(sql`${table.isSaved} IS TRUE`),
    index("feed_item_user_state_hidden_idx")
      .on(table.userId, table.hiddenAt, table.feedItemId)
      .where(sql`${table.hiddenAt} IS NOT NULL`),
  ],
);

// Keep the existing articleClips table definition here unchanged.
// Add articleReports below articleClips so feedItems and articleClips both exist.
export const articleReports = pgTable(
  "article_reports",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    articleId: text("article_id").notNull(),
    articleType: text("article_type").notNull(),
    feedItemId: text("feed_item_id").references(() => feedItems.id, { onDelete: "set null" }),
    clipId: text("clip_id").references(() => articleClips.id, { onDelete: "set null" }),
    reason: text("reason").notNull(),
    details: text("details"),
    articleTitle: text("article_title").notNull(),
    articleUrl: text("article_url").notNull(),
    feedTitle: text("feed_title"),
    feedUrl: text("feed_url"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("article_reports_user_created_idx").on(table.userId, table.createdAt.desc()),
    index("article_reports_article_created_idx").on(table.articleId, table.createdAt.desc()),
  ],
);
```

- [ ] **Step 4: Run schema smoke check**

Run:

```bash
bun run --cwd apps/api typecheck
```

Expected: may fail later because API does not yet know `articleReports`; no Drizzle syntax errors from `packages/db/src/schema/articles.ts`.

- [ ] **Step 5: Commit**

```bash
git add packages/db/drizzle/0025_article_reports_and_hidden_state.sql packages/db/drizzle/meta/_journal.json packages/db/src/schema/articles.ts
git commit -m "feat: add article hidden state and reports schema"
```

### Task 2: Article API Hidden State And Broken Report Endpoint

**Files:**
- Modify: `apps/api/src/modules/articles/types.ts`
- Modify: `apps/api/src/modules/articles/schemas.ts`
- Modify: `apps/api/src/modules/articles/write/update.ts`
- Create: `apps/api/src/modules/articles/write/reports.ts`
- Modify: `apps/api/src/modules/articles/write/routes.ts`
- Modify: `apps/api/src/modules/articles/read/dedupe.ts`
- Modify: `apps/api/src/modules/articles/read/list.ts`
- Modify: `apps/api/src/modules/articles/read/counts.ts`
- Modify: `apps/api/src/modules/articles/read/views-merged.ts`
- Test: `tests/api/integration/modules/articles/routes.test.ts`
- Test: `tests/api/integration/modules/articles/write/update-hidden-state.test.ts`
- Test: `tests/api/integration/modules/articles/read/list.test.ts`

**Interfaces:**
- Consumes: `feedItemUserState.hiddenAt` and `articleReports` from Task 1
- Produces: `ArticleUpdateBody.isHidden?: boolean`
- Produces: `createBrokenArticleReport(database, userId, articleId, body): Promise<void>`
- Produces: API route `POST /api/v1/articles/:articleId/reports/broken`

- [ ] **Step 1: Write failing API tests**

Update `tests/api/integration/modules/articles/routes.test.ts` so the expected route list includes the new endpoint between article view and article update:

```ts
expect(routes.map((route) => `${route.method} ${route.path}`)).toEqual([
  "get /articles/views/all",
  "get /articles/views/today",
  "get /articles/views/recently-read",
  "get /articles/views/read-later",
  "get /articles/counts",
  "get /articles/unread-counts",
  "get /articles/check-saved",
  "get /articles/saved",
  "get /articles",
  "get /articles/clips",
  "get /articles/write/clips",
  "get /articles/:articleId",
  "post /articles/:articleId/extract-full-text",
  "post /articles/:articleId/summarize",
  "post /articles/:articleId/translate",
  "post /articles",
  "post /articles/:articleId/view",
  "post /articles/:articleId/reports/broken",
  "put /articles/:articleId",
]);
```

Extend the existing write-route schema test in the same file:

```ts
const reportRoute = routes.find(
  (route) => route.method === "post" && route.path === "/articles/:articleId/reports/broken",
);

expect(reportRoute).toBeDefined();
expect((reportRoute?.options as Record<string, unknown>).params).toBeDefined();
expect((reportRoute?.options as Record<string, unknown>).body).toBeDefined();
expect((reportRoute?.options as Record<string, unknown>).response).toBeDefined();
```

Create `tests/api/integration/modules/articles/write/update-hidden-state.test.ts`:

```ts
import { describe, expect, mock, test } from "bun:test";
import { updateArticleForUser } from "@modules/articles/write/update";

function createFakeDb(existingState?: { hiddenAt: Date | null }) {
  let selectCall = 0;
  const onConflictDoUpdate = mock(() => Promise.resolve());
  const values = mock(() => ({ onConflictDoUpdate }));

  return {
    values,
    onConflictDoUpdate,
    db: {
      select: mock(() => {
        selectCall += 1;
        if (selectCall === 1) {
          return {
            from: () => ({
              where: () => ({
                limit: () => Promise.resolve([{ id: "article-1" }]),
              }),
            }),
          };
        }
        return {
          from: () => ({
            where: () => ({
              limit: () =>
                Promise.resolve(
                  existingState ? [{ readOverride: null, isSaved: false, ...existingState }] : [],
                ),
            }),
          }),
        };
      }),
      insert: mock(() => ({ values })),
    },
  };
}

describe("updateArticleForUser hidden state", () => {
  test("sets hiddenAt when isHidden is true", async () => {
    const fake = createFakeDb();

    await updateArticleForUser(fake.db as never, "user-1", "article-1", { isHidden: true });

    expect(fake.values.mock.calls[0]?.[0].hiddenAt).toBeInstanceOf(Date);
    expect(fake.onConflictDoUpdate.mock.calls[0]?.[0].set.hiddenAt).toBeInstanceOf(Date);
  });

  test("clears hiddenAt when isHidden is false", async () => {
    const fake = createFakeDb({ hiddenAt: new Date("2026-07-01T00:00:00.000Z") });

    await updateArticleForUser(fake.db as never, "user-1", "article-1", { isHidden: false });

    expect(fake.values.mock.calls[0]?.[0].hiddenAt).toBeNull();
    expect(fake.onConflictDoUpdate.mock.calls[0]?.[0].set.hiddenAt).toBeNull();
  });
});
```

Add a list regression test to `tests/api/integration/modules/articles/read/list.test.ts` after Step 5 adds `filterVisibleArticleRowsForTest`:

```ts
test("excludes hidden feed rows before pagination", () => {
  const rows = [
    row({ id: "visible", title: "Visible", hiddenAt: null }),
    row({ id: "hidden", title: "Hidden", hiddenAt: new Date("2026-07-01T00:00:00.000Z") }),
  ];

  expect(filterVisibleArticleRowsForTest(rows).map((candidate) => candidate.id)).toEqual([
    "visible",
  ]);
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
cd apps/api && bunx dotenvx run -f ../../docker/.env -f .env -- bun test ../../tests/api/integration/modules/articles/routes.test.ts ../../tests/api/integration/modules/articles/write/update-hidden-state.test.ts ../../tests/api/integration/modules/articles/read/list.test.ts
```

Expected: FAIL because the report route is absent, `isHidden` is not in the update type, and hidden filtering is not implemented in API query paths.

- [ ] **Step 3: Add API schemas and types**

In `apps/api/src/modules/articles/types.ts`, add:

```ts
export type ArticleUpdateBody = {
  isRead?: boolean | null;
  isSaved?: boolean;
  isHidden?: boolean;
  contentHtml?: string | null;
  contentText?: string | null;
  contentMarkdown?: string | null;
  contentStatus?: ArticleStoredContentDto["contentStatus"] | null;
  contentSource?: ArticleStoredContentDto["contentSource"] | null;
  extractionErrorCode?: string | null;
  extractionErrorMessage?: string | null;
};

export type BrokenArticleReportBody = {
  reason?: "broken_article" | "missing_content" | "wrong_content" | "feed_error";
  details?: string | null;
};
```

In `apps/api/src/modules/articles/schemas.ts`, extend update and add report body:

```ts
export const updateArticleBodySchema = t.Object({
  isRead: t.Optional(t.Union([t.Boolean(), t.Null()])),
  isSaved: t.Optional(t.Boolean()),
  isHidden: t.Optional(t.Boolean()),
  title: t.Optional(t.String()),
  note: t.Optional(t.Union([t.String(), t.Null()])),
  contentHtml: t.Optional(t.Union([t.String(), t.Null()])),
  contentText: t.Optional(t.Union([t.String(), t.Null()])),
  contentMarkdown: t.Optional(t.Union([t.String(), t.Null()])),
  contentStatus: t.Optional(
    t.Union([
      t.Literal("ready"),
      t.Literal("partial"),
      t.Literal("failed"),
      t.Literal("pending"),
      t.Null(),
    ]),
  ),
  contentSource: t.Optional(
    t.Union([
      t.Literal("feed_html"),
      t.Literal("feed_markdown"),
      t.Literal("feed_summary"),
      t.Literal("extracted_html"),
      t.Literal("text_fallback"),
      t.Literal("link_only"),
      t.Null(),
    ]),
  ),
  extractionErrorCode: t.Optional(t.Union([t.String(), t.Null()])),
  extractionErrorMessage: t.Optional(t.Union([t.String(), t.Null()])),
});

export const brokenArticleReportBodySchema = t.Object({
  reason: t.Optional(
    t.Union([
      t.Literal("broken_article"),
      t.Literal("missing_content"),
      t.Literal("wrong_content"),
      t.Literal("feed_error"),
    ]),
  ),
  details: t.Optional(t.Union([t.String({ maxLength: 4000 }), t.Null()])),
});
```

- [ ] **Step 4: Implement hidden state updates**

In `apps/api/src/modules/articles/write/update.ts`, include hidden state in both the empty-update guard and the upsert:

```ts
const hasHidden = Object.hasOwn(body, "isHidden");

if (!hasRead && !hasSaved && !hasHidden && !hasContentFields) {
  throw new AppError("No updatable fields provided", { status: 400, code: "EMPTY_UPDATE" });
}

if (hasRead || hasSaved || hasHidden) {
  const existing = await database
    .select({
      readOverride: feedItemUserState.readOverride,
      isSaved: feedItemUserState.isSaved,
      hiddenAt: feedItemUserState.hiddenAt,
    })
    .from(feedItemUserState)
    .where(and(eq(feedItemUserState.userId, userId), eq(feedItemUserState.feedItemId, articleId)))
    .limit(1);

  const prev = existing[0];
  const readOverride = hasRead ? body.isRead! : (prev?.readOverride ?? null);
  const isSaved = hasSaved ? body.isSaved! : (prev?.isSaved ?? false);
  const hiddenAt = hasHidden ? (body.isHidden ? now : null) : (prev?.hiddenAt ?? null);

  await database
    .insert(feedItemUserState)
    .values({
      userId,
      feedItemId: articleId,
      readOverride,
      isSaved,
      hiddenAt,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [feedItemUserState.userId, feedItemUserState.feedItemId],
      set: {
        readOverride,
        isSaved,
        hiddenAt,
        updatedAt: now,
      },
    });
}
```

In `updateArticleOrClipForUser`, only pass `isHidden` to feed articles. If a clip receives `isHidden`, throw a 400 because clip hiding is not part of this request:

```ts
if (clipRows[0]) {
  if (Object.hasOwn(raw, "isHidden")) {
    throw new AppError("Clips cannot be hidden from feed views", {
      status: 400,
      code: "CLIP_HIDE_UNSUPPORTED",
    });
  }
  // existing clip update mapping stays here
}

if (Object.hasOwn(raw, "isHidden")) {
  feedBody.isHidden = raw.isHidden as boolean;
}
```

- [ ] **Step 5: Exclude hidden feed items from read paths**

In `apps/api/src/modules/articles/read/dedupe.ts`, add `hiddenAt` to `ArticleListRawRow`:

```ts
export type ArticleListRawRow = {
  id: string;
  title: string;
  canonicalUrl: string;
  link: string;
  summary: string | null;
  publishedAt: Date;
  feedId: string;
  feedUrl: string | null;
  feedSiteUrl: string | null;
  feedTitle: string;
  feedFaviconUrl: string | null;
  isRead: boolean;
  isSaved: boolean;
  hiddenAt: Date | null;
};
```

In `apps/api/src/modules/articles/read/list.ts`, add helpers and use the visible-row helper before pagination:

```ts
function pushHiddenFilter(filters: SQL[]): void {
  filters.push(sql`${feedItemUserState.hiddenAt} IS NULL`);
}

function filterVisibleArticleRows(rows: ArticleListRawRow[]): ArticleListRawRow[] {
  return rows.filter((row) => row.hiddenAt == null);
}

export const filterVisibleArticleRowsForTest = filterVisibleArticleRows;
```

Update `paginateRows`:

```ts
function paginateRows(rows: ArticleListRawRow[], limit: number, sort: ArticleSort) {
  const visibleRows = filterVisibleArticleRows(rows);
  const dedupedRows = collapseObviousDuplicates(visibleRows).sort((left, right) =>
    compareArticleRowsForSort(left, right, sort),
  );
  if (dedupedRows.length !== visibleRows.length) {
    logger.warn("articles.list_time_dedupe.collapsed", {
      rawCount: visibleRows.length,
      dedupedCount: dedupedRows.length,
      collapsedCount: visibleRows.length - dedupedRows.length,
    });
  }
  const hasMore = dedupedRows.length > limit;
  const page = hasMore ? dedupedRows.slice(0, limit) : dedupedRows;
  const nextCursor =
    hasMore && page.length > 0 ? encodeCompositeCursor(page[page.length - 1]!, sort) : null;
  return { hasMore, page, nextCursor };
}
```

In the `listArticleRows` and `listGlobalArticleRows` selects, include:

```ts
hiddenAt: feedItemUserState.hiddenAt,
```

Call the SQL filter after saved/read filters in `listArticleRows` and `listGlobalArticleRows`:

```ts
pushReadSavedFilters(filters, opts);
pushHiddenFilter(filters);
```

```ts
pushGlobalReadSavedFilters(filters, opts);
pushHiddenFilter(filters);
```

In `apps/api/src/modules/articles/read/counts.ts`, add `sql`${feedItemUserState.hiddenAt} IS NULL`` to feed item counts, unread counts, saved counts, and per-feed unread counts. Do not apply this to `articleClips`.

In `apps/api/src/modules/articles/read/views-merged.ts`, add `sql`${feedItemUserState.hiddenAt} IS NULL`` to the custom recently-viewed feed row query and any other direct feed item query that bypasses `listArticlesForUser`.

- [ ] **Step 6: Implement report service**

Create `apps/api/src/modules/articles/write/reports.ts`:

```ts
import type { db } from "@adapters/db/client";
import { articleClips, articleReports, feedItems, feedSubscriptions, feeds } from "@kyomi/db";
import { and, eq } from "drizzle-orm";
import { AppError } from "@shared/errors/app";
import type { BrokenArticleReportBody } from "../types";

type DB = typeof db;

function normalizeDetails(details: string | null | undefined): string | null {
  const trimmed = details?.trim();
  return trimmed ? trimmed.slice(0, 4000) : null;
}

export async function createBrokenArticleReport(
  database: DB,
  userId: string,
  articleId: string,
  body: BrokenArticleReportBody,
): Promise<void> {
  const [clip] = await database
    .select({
      id: articleClips.id,
      title: articleClips.title,
      url: articleClips.url,
    })
    .from(articleClips)
    .where(and(eq(articleClips.id, articleId), eq(articleClips.userId, userId)))
    .limit(1);

  if (clip) {
    await database.insert(articleReports).values({
      id: crypto.randomUUID(),
      userId,
      articleId,
      articleType: "clip",
      clipId: clip.id,
      reason: body.reason ?? "broken_article",
      details: normalizeDetails(body.details),
      articleTitle: clip.title,
      articleUrl: clip.url,
      feedTitle: null,
      feedUrl: null,
    });
    return;
  }

  const [feedArticle] = await database
    .select({
      id: feedItems.id,
      title: feedItems.title,
      url: feedItems.link,
      feedTitle: feeds.title,
      feedUrl: feeds.url,
    })
    .from(feedItems)
    .innerJoin(feeds, eq(feedItems.feedId, feeds.id))
    .innerJoin(
      feedSubscriptions,
      and(eq(feedSubscriptions.feedId, feedItems.feedId), eq(feedSubscriptions.userId, userId)),
    )
    .where(eq(feedItems.id, articleId))
    .limit(1);

  if (!feedArticle) {
    throw new AppError("Article not found", { status: 404, code: "ARTICLE_NOT_FOUND" });
  }

  await database.insert(articleReports).values({
    id: crypto.randomUUID(),
    userId,
    articleId,
    articleType: "feed",
    feedItemId: feedArticle.id,
    reason: body.reason ?? "broken_article",
    details: normalizeDetails(body.details),
    articleTitle: feedArticle.title,
    articleUrl: feedArticle.url,
    feedTitle: feedArticle.feedTitle,
    feedUrl: feedArticle.feedUrl,
  });
}
```

- [ ] **Step 7: Add report route**

In `apps/api/src/modules/articles/write/routes.ts`, import `brokenArticleReportBodySchema` and `createBrokenArticleReport`, then add this route before `.put("/articles/:articleId", ...)`:

```ts
.post(
  "/articles/:articleId/reports/broken",
  async (context) => {
    const { body, db, params, userId } = v1HandlerContext<
      {
        reason?: "broken_article" | "missing_content" | "wrong_content" | "feed_error";
        details?: string | null;
      },
      Record<string, unknown>,
      { articleId: string }
    >(context);
    await createBrokenArticleReport(db, userId, params.articleId, body);
    return { message: "Broken article report submitted" };
  },
  {
    params: articleIdParamsSchema,
    body: brokenArticleReportBodySchema,
    response: { 200: messageResponseSchema },
  },
)
```

- [ ] **Step 8: Run focused tests**

Run:

```bash
cd apps/api && bunx dotenvx run -f ../../docker/.env -f .env -- bun test ../../tests/api/integration/modules/articles/routes.test.ts ../../tests/api/integration/modules/articles/write/update-hidden-state.test.ts ../../tests/api/integration/modules/articles/read/list.test.ts ../../tests/api/integration/modules/articles/read/counts.test.ts ../../tests/api/integration/modules/articles/read/views-merged.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/modules/articles tests/api/integration/modules/articles
git commit -m "feat: persist hidden articles and broken reports"
```

### Task 3: Inbox UI Actions And Broken Article Dialog

**Files:**
- Modify: `apps/web/src/lib/schemas.ts`
- Modify: `apps/web/src/modules/inbox/services/api.ts`
- Modify: `apps/web/src/modules/inbox/hooks/use-inbox-data.ts`
- Create: `apps/web/src/modules/feeds/components/item/broken-article-report-dialog.tsx`
- Modify: `apps/web/src/modules/feeds/components/item/toolbar.tsx`
- Test: `tests/web/integration/modules/feeds/item-toolbar.test.tsx`

**Interfaces:**
- Consumes: `PUT /api/v1/articles/:articleId` with `isHidden`
- Consumes: `POST /api/v1/articles/:articleId/reports/broken`
- Produces: `reportBrokenArticle({ data: { itemId, reason, details } })`
- Produces: dialog with textarea, cancel, submit, pending state, and toast feedback

- [ ] **Step 1: Write failing toolbar tests**

Extend `tests/web/integration/modules/feeds/item-toolbar.test.tsx`:

```ts
const { mutateMock, reportBrokenArticleMock } = vi.hoisted(() => ({
  mutateMock: vi.fn(),
  reportBrokenArticleMock: vi.fn(),
}));

vi.mock("@modules/inbox/services/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@modules/inbox/services/api")>()),
  reportBrokenArticle: reportBrokenArticleMock,
}));
```

Add tests:

```ts
test("marks an item hidden when Not interested is clicked", () => {
  renderItem();

  fireEvent.click(screen.getByRole("button", { name: "More" }));
  fireEvent.click(screen.getByRole("menuitem", { name: "Not interested" }));

  expect(mutateMock).toHaveBeenCalledWith({
    itemId: item.id,
    patch: { isHidden: true },
    removeFromList: true,
  });
});

test("opens a broken article report dialog from the more menu", () => {
  renderItem();

  fireEvent.click(screen.getByRole("button", { name: "More" }));
  fireEvent.click(screen.getByRole("menuitem", { name: "Report broken article" }));

  expect(screen.getByRole("dialog", { name: "Report broken article" })).toBeTruthy();
  expect(screen.getByText("Toolbar click regression")).toBeTruthy();
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
bun run --cwd tests test:web:integration -- web/integration/modules/feeds/item-toolbar.test.tsx
```

Expected: FAIL because the mutation still uses `isRead` and no report dialog exists.

- [ ] **Step 3: Add frontend schema/server function support**

In `apps/web/src/lib/schemas.ts`, export:

```ts
export const messageResponseSchema = z.object({
  message: z.string(),
});
```

In `apps/web/src/modules/inbox/services/api.ts`, update types:

```ts
export type UpdateInboxItemStateInput = {
  itemId: string;
  isRead?: boolean | null;
  isSaved?: boolean;
  isHidden?: boolean;
};

export type ReportBrokenArticleInput = {
  itemId: string;
  reason?: "broken_article" | "missing_content" | "wrong_content" | "feed_error";
  details?: string | null;
};
```

Extend `updateInboxItemState` body mapping:

```ts
if (Object.hasOwn(data, "isHidden")) {
  body.isHidden = data.isHidden;
}
```

Add the server function:

```ts
export const reportBrokenArticle = createServerFn({ method: "POST" })
  .inputValidator((input: ReportBrokenArticleInput) => input)
  .handler(async ({ data }): Promise<{ message: string }> => {
    const headers = getRequestHeaders();
    const forwarded = buildForwardHeaders(headers);
    forwarded.set("content-type", "application/json");

    return apiJson<{ message: string }>(`/api/v1/articles/${data.itemId}/reports/broken`, {
      method: "POST",
      headers: forwarded,
      body: JSON.stringify({
        reason: data.reason ?? "broken_article",
        details: data.details ?? null,
      }),
    });
  });
```

In `apps/web/src/modules/inbox/hooks/use-inbox-data.ts`, update:

```ts
export type InboxItemPatch = Partial<Pick<InboxItem, "isRead" | "isSaved">> & {
  isHidden?: boolean;
};
```

- [ ] **Step 4: Create the dialog component**

Create `apps/web/src/modules/feeds/components/item/broken-article-report-dialog.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Button } from "@kyomi/ui/button";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@kyomi/ui/dialog";
import { Field } from "@kyomi/ui/field";
import { Form } from "@kyomi/ui/form";
import { Textarea } from "@kyomi/ui/textarea";
import { toastManager } from "@kyomi/ui/toast";
import { reportBrokenArticle, type InboxItem } from "@modules/inbox/services/api";

export function BrokenArticleReportDialog({
  item,
  open,
  onOpenChange,
}: {
  item: InboxItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [details, setDetails] = useState("");
  const [isPending, setIsPending] = useState(false);

  const submit = async () => {
    setIsPending(true);
    try {
      await reportBrokenArticle({
        data: {
          itemId: item.id,
          reason: "broken_article",
          details,
        },
      });
      setDetails("");
      onOpenChange(false);
      toastManager.add({
        title: "Report sent",
        description: "Thanks. This article is marked for review.",
        timeout: 3000,
      });
    } catch {
      toastManager.add({
        title: "Report failed",
        description: "Try again in a moment.",
        timeout: 7000,
      });
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Report broken article</DialogTitle>
          <DialogDescription>{item.title}</DialogDescription>
        </DialogHeader>
        <Form
          className="contents"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <DialogPanel>
            <Field>
              <Textarea
                className="max-h-56 [&_textarea]:max-h-56 [&_textarea]:resize-y"
                placeholder="What looks broken?"
                size="lg"
                value={details}
                onChange={(event) => setDetails(event.target.value)}
              />
            </Field>
          </DialogPanel>
          <DialogFooter>
            <DialogClose render={<Button variant="ghost" />} disabled={isPending}>
              Cancel
            </DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Sending..." : "Send"}
            </Button>
          </DialogFooter>
        </Form>
      </DialogPopup>
    </Dialog>
  );
}
```

- [ ] **Step 5: Wire toolbar actions**

In `apps/web/src/modules/feeds/components/item/toolbar.tsx`, import `useState` and the dialog:

```tsx
import { useState } from "react";
import { BrokenArticleReportDialog } from "./broken-article-report-dialog";
```

Update `ItemInlineToolbar`:

```tsx
export function ItemInlineToolbar({ item, className }: { item: InboxItem; className?: string }) {
  const [reportOpen, setReportOpen] = useState(false);
  const toolbar = useToolbarModel({
    item,
    onReportBrokenArticle: () => setReportOpen(true),
  });

  return (
    <>
      <Toolbar
        {...toolbar.toolbarProps}
        className={cn("border-0 bg-transparent p-0 text-muted-foreground shadow-none", className)}
      />
      <BrokenArticleReportDialog item={item} open={reportOpen} onOpenChange={setReportOpen} />
    </>
  );
}
```

Update `useToolbarModel` signature and actions:

```tsx
export function useToolbarModel({
  item,
  onReportBrokenArticle,
}: {
  item: InboxItem;
  onReportBrokenArticle?: () => void;
}): ToolbarModel {
  const updateItemMutation = useInboxItemStateMutation();

  const updateItem = (patch: InboxItemPatch, removeFromList = false) => {
    updateItemMutation.mutate({ itemId: item.id, patch, removeFromList });
  };

  return {
    toolbarProps: {
      isSaved: item.isSaved,
      onCopyLink: () => {
        void copyTextToClipboard(item.link).catch(() => undefined);
      },
      onHide: () => updateItem({ isHidden: true }, true),
      onOpenSource: () => {
        window.open(item.link, "_blank", "noopener,noreferrer");
      },
      onReportBrokenArticle: () => {
        onReportBrokenArticle?.();
      },
      onShareArticle: () => {
        void shareArticle(item).catch(() => undefined);
      },
      onToggleSaved: () => updateItem({ isSaved: !item.isSaved }),
    },
  };
}
```

Remove `buildBrokenArticleReport` after no call sites remain.

- [ ] **Step 6: Run focused tests**

Run:

```bash
bun run --cwd tests test:web:integration -- web/integration/modules/feeds/item-toolbar.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib/schemas.ts apps/web/src/modules/inbox/services/api.ts apps/web/src/modules/inbox/hooks/use-inbox-data.ts apps/web/src/modules/feeds/components/item tests/web/integration/modules/feeds/item-toolbar.test.tsx
git commit -m "feat: add durable inbox item reports"
```

### Task 4: OPML Imports Enqueue First Refresh

**Files:**
- Modify: `apps/api/src/modules/opml/service.ts`
- Test: `tests/api/integration/modules/opml/routes.test.ts` or create `tests/api/integration/modules/opml/service.test.ts` if route-level mocks are awkward

**Interfaces:**
- Consumes: `enqueueFeedRefresh(database, feedId, userId, "subscription_created", logger)`
- Produces: new OPML subscriptions move to refresh queue immediately after import feed job success

- [ ] **Step 1: Write failing service test**

Create `tests/api/integration/modules/opml/service.test.ts`:

```ts
import { describe, expect, test, mock } from "bun:test";

const createOrSubscribeToFeedMock = mock(async () => ({
  feedId: "feed-1",
  subscriptionId: "sub-1",
  newFeed: true,
  newSubscription: true,
}));
const enqueueFeedRefreshMock = mock(async () => ({ jobId: "job-1" }));
const recordOpmlTaskSuccessMock = mock(async () => undefined);

mock.module("@modules/feeds/subscription/service", () => ({
  createOrSubscribeToFeed: createOrSubscribeToFeedMock,
}));
mock.module("@modules/feeds/refresh/service", () => ({
  enqueueFeedRefresh: enqueueFeedRefreshMock,
}));
mock.module("@modules/opml/task-store", () => ({
  isOpmlTaskCancelled: mock(async () => false),
  recordOpmlTaskSuccess: recordOpmlTaskSuccessMock,
  recordOpmlTaskFailure: mock(async () => undefined),
}));

describe("runOpmlImportFeedJob", () => {
  test("enqueues a first refresh for newly imported subscriptions", async () => {
    const { runOpmlImportFeedJob } = await import("@modules/opml/service");
    const logger = { info: mock(() => undefined), warn: mock(() => undefined), error: mock(() => undefined) };

    await runOpmlImportFeedJob({} as never, {
      taskId: "task-1",
      userId: "user-1",
      url: "https://example.com/feed.xml",
      title: "Example",
      folderId: null,
    }, logger);

    expect(enqueueFeedRefreshMock).toHaveBeenCalledWith(
      {},
      "feed-1",
      "user-1",
      "subscription_created",
      logger,
    );
    expect(recordOpmlTaskSuccessMock).toHaveBeenCalledWith("task-1", {
      alreadySubscribed: false,
    });
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
cd apps/api && bunx dotenvx run -f ../../docker/.env -f .env -- bun test ../../tests/api/integration/modules/opml/service.test.ts
```

Expected: FAIL because `enqueueFeedRefresh` is not called.

- [ ] **Step 3: Implement enqueue reuse**

In `apps/api/src/modules/opml/service.ts`, import:

```ts
import { enqueueFeedRefresh } from "@modules/feeds/refresh/service";
```

Update `runOpmlImportFeedJob` after `createOrSubscribeToFeed`:

```ts
const result = await createOrSubscribeToFeed(database, userId, url, {
  folderId: folderId ?? null,
  customTitle: title ?? null,
});

if (result.newSubscription) {
  await enqueueFeedRefresh(database, result.feedId, userId, "subscription_created", logger);
}

await recordOpmlTaskSuccess(taskId, {
  alreadySubscribed: !result.newSubscription,
});
```

- [ ] **Step 4: Run focused OPML tests**

Run:

```bash
cd apps/api && bunx dotenvx run -f ../../docker/.env -f .env -- bun test ../../tests/api/integration/modules/opml/service.test.ts ../../tests/api/integration/modules/opml/routes.test.ts ../../tests/api/integration/modules/opml/queue-jobs.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/opml/service.ts tests/api/integration/modules/opml/service.test.ts
git commit -m "fix: refresh feeds imported from opml"
```

### Task 5: Reject HTML During Feed Refresh Parsing

**Files:**
- Modify: `packages/worker/src/services/feed/parse.ts`
- Test: `tests/api/integration/modules/feeds/parse-feed-document.test.ts`

**Interfaces:**
- Consumes: existing `runFeedRefresh` catch block that marks refresh failure
- Produces: `parseFeedDocument` throws `Unsupported feed format: received HTML document` for HTML bodies

- [ ] **Step 1: Write failing parser test**

Add to `tests/api/integration/modules/feeds/parse-feed-document.test.ts`:

```ts
test("rejects HTML documents instead of treating them as empty feeds", () => {
  expect(() =>
    parseFeedDocument(
      `<!doctype html><html><head><title>Access denied</title></head><body>Blocked</body></html>`,
      "feed-1",
      "https://engineering.fb.com/feed/",
    ),
  ).toThrow("Unsupported feed format: received HTML document");
});
```

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
cd apps/api && bunx dotenvx run -f ../../docker/.env -f .env -- bun test ../../tests/api/integration/modules/feeds/parse-feed-document.test.ts
```

Expected: FAIL because HTML currently returns metadata with `items: []`.

- [ ] **Step 3: Implement rejection**

In `packages/worker/src/services/feed/parse.ts`, replace the HTML branch:

```ts
if (lower.startsWith("<html") || lower.startsWith("<!doctype html")) {
  throw new Error("Unsupported feed format: received HTML document");
}
```

Remove the now-unused `decodeHtmlEntities` import if it has no remaining call sites.

- [ ] **Step 4: Run focused feed tests**

Run:

```bash
cd apps/api && bunx dotenvx run -f ../../docker/.env -f .env -- bun test ../../tests/api/integration/modules/feeds/parse-feed-document.test.ts ../../tests/api/integration/app/jobs/feed-refresh-errors.test.ts
```

Expected: PASS. If `feed-refresh-errors.test.ts` has no HTML case, add one that stubs `fetch` to return `ok: true`, `content-type: text/html`, and an HTML body, then asserts `runFeedRefresh` returns `ok: false` and the feed row has `refreshStatus: "failed"`.

- [ ] **Step 5: Commit**

```bash
git add packages/worker/src/services/feed/parse.ts tests/api/integration/modules/feeds/parse-feed-document.test.ts tests/api/integration/app/jobs/feed-refresh-errors.test.ts
git commit -m "fix: reject html feed refresh responses"
```

### Task 6: Explicit OPML Import Toast Completion Timeouts

**Files:**
- Modify: `apps/web/src/modules/feeds/components/follow/sources-dialog.tsx`
- Test: `tests/web/integration/modules/feeds/sources-dialog.test.tsx`

**Interfaces:**
- Produces: loading toast remains indefinite while polling
- Produces: success toast timeout is `3000`
- Produces: error toast timeout is `7000`

- [ ] **Step 1: Write failing toast timeout test**

Extend the existing final-status assertion in `tests/web/integration/modules/feeds/sources-dialog.test.tsx`:

```ts
const [, toastOptions] = mocks.toastPromise.mock.calls[0] as [
  Promise<unknown>,
  {
    loading: { timeout: number };
    success: (status: OpmlImportStatusDto) => { title: string; description: ReactNode; timeout: number };
    error: (error: unknown) => { title: string; description: string; timeout: number };
  },
];

expect(toastOptions.loading.timeout).toBe(0);
expect(toastOptions.success(finalStatus).timeout).toBe(3000);
expect(toastOptions.error(new Error("failed")).timeout).toBe(7000);
```

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
bun run --cwd tests test:web:integration -- web/integration/modules/feeds/sources-dialog.test.tsx
```

Expected: FAIL because success/error functions do not return explicit timeout values.

- [ ] **Step 3: Add explicit timeout values**

In `apps/web/src/modules/feeds/components/follow/sources-dialog.tsx`, keep loading at `timeout: 0`, and update promise options:

```ts
success: (status) => ({
  title: `Imported ${status.summary.completed} of ${status.summary.totalUrls} feeds`,
  description: formatOpmlImportSummary(status.summary),
  timeout: 3000,
}),
error: () => ({
  title: "Import failed",
  description: "Could not import feeds from this OPML URL.",
  timeout: 7000,
}),
```

If the file already has different title/description helpers, preserve the existing copy and add only the `timeout` fields.

- [ ] **Step 4: Run focused test**

Run:

```bash
bun run --cwd tests test:web:integration -- web/integration/modules/feeds/sources-dialog.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/modules/feeds/components/follow/sources-dialog.tsx tests/web/integration/modules/feeds/sources-dialog.test.tsx
git commit -m "fix: bound opml import completion toasts"
```

### Task 7: Final Verification And Manual QA

**Files:**
- Verify all files changed in Tasks 1-6

**Interfaces:**
- Consumes: all prior tasks
- Produces: verified behavior for the three page feedback items and empty-feed root cause

- [ ] **Step 1: Run API integration tests**

Run:

```bash
cd apps/api && bunx dotenvx run -f ../../docker/.env -f .env -- bun test ../../tests/api/integration/modules/articles ../../tests/api/integration/modules/opml ../../tests/api/integration/modules/feeds ../../tests/api/integration/app/jobs/feed-refresh-errors.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run web integration tests**

Run:

```bash
bun run --cwd tests test:web:integration -- web/integration/modules/feeds/item-toolbar.test.tsx web/integration/modules/feeds/sources-dialog.test.tsx
```

Expected: PASS.

- [ ] **Step 3: Run typechecks**

Run:

```bash
bun run --cwd apps/api typecheck
bun run --cwd apps/web typecheck
bun run typecheck
```

Expected: PASS.

- [ ] **Step 4: Run migration locally**

Run:

```bash
bun run db:migrate
```

Expected: migration `0025_article_reports_and_hidden_state` applies once with no drift errors.

- [ ] **Step 5: Manual browser QA**

Start the app if needed:

```bash
bun run dev
```

Open `http://localhost:3000/inbox?filter=all`.

Manual checks:

- Open an article row's More menu, click `Not interested`, verify the row disappears and does not return after refresh.
- Open an article row's More menu, click `Report broken article`, verify a dialog opens, submit details, and verify a success toast appears.
- Import an OPML URL with at least one new feed, verify the progress toast completes and dismisses after the success timeout.
- Open an OPML-imported feed after its refresh job runs, verify new items appear when the feed is reachable.
- Force or simulate an HTML body for a feed refresh, verify the feed marks refresh failed instead of showing as a successful empty feed.

- [ ] **Step 6: Commit final test fixes if needed**

```bash
git status --short
git add <only intentional files from this plan>
git commit -m "test: cover feed actions and import reliability"
```

If there are no extra changes after verification, skip this commit.

## Test Coverage Diagram

```
CODE PATHS                                                  USER FLOWS
[+] article hidden state                                    [+] Not interested
  |- [GAP->Task2] PUT /articles/:id isHidden true             |- [GAP->Task3] Menu click hides row durably
  |- [GAP->Task2] list excludes hidden rows                   |- [GAP->Task7] Browser refresh does not restore row
  |- [GAP->Task2] counts exclude hidden rows
  `- [GAP->Task2] saved/read views exclude hidden rows

[+] broken article reports                                  [+] Report broken article
  |- [GAP->Task2] route registration                          |- [GAP->Task3] Menu opens dialog
  |- [GAP->Task2] feed article access check                   |- [GAP->Task3] Submit disables button and posts
  |- [GAP->Task2] clip access check                           `- [GAP->Task3] Success/failure toast visible
  `- [GAP->Task2] article_reports insert

[+] OPML import refresh                                     [+] OPML URL import
  |- [GAP->Task4] new subscription enqueues refresh            |- [GAP->Task6] Loading toast persists during polling
  `- [GAP->Task4] existing subscription skips refresh          |- [GAP->Task6] Success toast has finite timeout
                                                                 `- [GAP->Task7] Imported reachable feed gets items

[+] feed parser                                             [+] Blocked feed response
  |- [TESTED] RSS parser entity expansion                     |- [GAP->Task5] HTML body marks refresh failed
  |- [TESTED] relative channel links                          `- [GAP->Task7] Empty state no longer claims success
  `- [GAP->Task5] HTML body throws

COVERAGE AFTER PLAN: 16/16 planned paths covered.
QUALITY TARGET: behavior + edge/error coverage for all P1/P2 paths.
```

## Review Refinements Applied

- Architecture: chose durable `hidden_at` state instead of renaming the menu item or relying on read state. This closes the refetch bug and preserves the intended label.
- Architecture: chose database-backed reports instead of clipboard-only reporting. This makes "Report broken article" auditable and gives future support tooling a source of truth.
- Architecture: reused `enqueueFeedRefresh` from normal subscription flow for OPML imports. This keeps queue semantics in one place.
- Code quality: rejected a custom OPML refresh queue path because the existing feed refresh service already handles subscription-created failures as warnings.
- Tests: added regression coverage for every observed user-facing issue, including the worker HTML parsing path that explains the Engineering at Meta empty feed symptom.
- Performance: hidden-state filters use the existing user-state join and primary key; no broad scan or new N+1 query is introduced.
- Plan tune: avoided new question gates because the user already chose the complete approach; the plan documents exact implementation decisions instead of asking redundant scope questions.

## Review Completion Summary

- Step 0: Scope Challenge - scope accepted as-is because all four issues share the same feed actions/import reliability surface.
- Architecture Review: 4 issues found and folded into tasks.
- Code Quality Review: 2 issues found and folded into tasks.
- Test Review: diagram produced, 16 gaps identified, all mapped to tasks.
- Performance Review: 0 unresolved performance issues.
- NOT in scope: written.
- What already exists: written.
- Task-list updates: 0 items proposed; no deferred work is needed to fix this report.
- Failure modes: 0 silent critical gaps remain after planned tests.
- Outside voice: skipped; the user requested `plan-eng-review` and `plan-tune`, not a cross-model review.
- Parallelization: 4 lanes, 3 parallel after database/API dependency is understood.
- Lake Score: 4/4 recommendations choose the complete option.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | not run | Not required for targeted reliability fixes |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | not run | Not requested |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | clear | 6 issues, 0 critical gaps, all folded into tasks |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | not run | Dialog follows existing feedback/settings UI primitives |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | not run | Not required |

- **VERDICT:** ENG CLEARED - ready to implement.
NO UNRESOLVED DECISIONS
