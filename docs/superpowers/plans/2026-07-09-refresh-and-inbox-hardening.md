# Refresh and Inbox Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make feed refresh delivery idempotent across worker reclaims, make refresh state promptly visible in the inbox, and bound the startup and persisted-cache cost of an account with many feeds and folders.

**Architecture:** Postgres remains the source of truth for a feed's refresh lifecycle; Redis Streams deliver work at-least-once. A monotonically increasing `refreshGeneration` fences every worker so a reclaimed or stale job cannot become the active writer. The inbox stops eagerly fetching every possible tab/feed/folder, polls the lightweight feed-status query at an explicit foreground cadence, and persists only a bounded first-page cache.

**Tech Stack:** Bun, TypeScript, Drizzle/Postgres, Redis Streams/ioredis, TanStack Query, IndexedDB, Vitest, `bun test`.

## Global Constraints

- Keep `apps/api/src/modules/feeds/refresh/routes.ts` a thin delegator; lifecycle policy lives in `enqueue.ts`, `refresh-scheduler.ts`, and `packages/worker`.
- Redis Streams provide at-least-once delivery, not exactly-once delivery. The Postgres generation fence is the exactly-one-active-writer guarantee.
- Preserve existing feed-item idempotency (`feed_id` + canonical URL) and do not add a second ingestion pipeline.
- Do not add `maxPages` to the current forward-only infinite query. TanStack Query removes the oldest page when a next page is added; without a scroll-anchor/window adapter, that can move the virtualized list under the reader.
- Keep background status polling disabled: only a mounted, foreground inbox polls feed lifecycle state.
- Use `bunx`, not `npx`. Use GitButler (`but`) for checkpoint commits; do not stage or commit the unrelated dirty workspace changes.
- Migration files are generated with `bun run db:generate`; do not hand-number a Drizzle migration.

---

## Audit Baseline and Scope

### What already exists

- `apps/api/src/app/jobs/refresh-scheduler.ts` atomically selects due feeds with `FOR UPDATE SKIP LOCKED`, marks them `queued`, and recovers stale `queued`/`running` rows.
- `packages/worker/src/services/queue/job.ts` separates feed-refresh and OPML streams, retries/dead-letters atomically, and acknowledges only after `onJob` completes.
- `packages/worker/src/services/feed/refresh.ts` upserts feed items idempotently, but its initial and terminal feed-state updates match only `feeds.id`.
- `apps/web/src/modules/inbox/page.tsx` already fetches the active list. Its later effect additionally prefetches every tab, followed feed, and folder through `prefetchInboxSwitchTargets`.
- `apps/web/src/lib/query/cache.ts` already validates hydrated list pages, but serializes every successful hot inbox query and every infinite-query page for 24 hours.

### In scope

1. A fenced, coalesced refresh lifecycle that survives duplicate Redis delivery, `XAUTOCLAIM`, manual clicks, scheduler recovery, and publish ambiguity.
2. Foreground refresh-status visibility within 30 seconds when idle and 2.5 seconds while any followed feed is active.
3. One active-list prefetch at route load, no startup fan-out, and bounded persisted inbox data.
4. Regression tests for the production failure modes above.

### Explicitly not in scope

- Replacing Kyomi's read-time RSS inbox with Facebook/X/Reddit-style fan-out-on-write, ranking, recommendations, or per-user timeline materialization. That changes the product model and needs a separate product/design decision.
- Feed-item retention, partitioning, or deletion. Retention must first define whether Kyomi is an archive and what users may expect to remain available.
- In-memory infinite-scroll windowing. This needs an anchor-preserving virtual-list design; it must not be hidden behind `maxPages`.
- The asynchronous article-extraction work already on `chore/perf-updates`. That lowers refresh duration, but it does not replace lifecycle fencing; rebase/merge it independently after this plan's tests pass.

### Target data flow

```text
manual request / scheduler
            |
            v
Postgres: status=queued, generation=N+1
            |
            +--> Redis message { feedId, generation: N+1 }
                         |
                 at-least-once delivery
                         |
                         v
worker: UPDATE ... WHERE status='queued' AND generation=N+1
      | success                         | 0 rows
      v                                 v
  active writer                     ACK as superseded
      |
      +--> all terminal writes WHERE generation=N+1
      |
      +--> idle / failed

If Redis publish reports an error after accepting the message, the queued generation remains
durable. A later scheduler recovery re-publishes a newer generation; either generation has
only one active writer.
```

### Refresh state machine

```text
idle|failed -- claim generation N --> queued(N)
queued(N) -- worker conditional claim --> running(N)
running(N) -- success --> idle(N)
running(N) -- terminal feed error --> failed(N)
queued/running(N) -- lease recovery --> queued(N+1)

Any terminal update for N after N+1 exists affects zero rows and is logged as superseded.
```

## File Structure

This is deliberately two independently shippable tracks. Do not combine their commits: the API/worker lifecycle is a correctness change; the inbox work is a browser-cache/freshness change.

| Track | Files | Responsibility |
| --- | --- | --- |
| Refresh fencing | `packages/db/src/schema/feeds.ts`, generated `packages/db/drizzle/*`, `apps/api/src/modules/feeds/refresh/enqueue.ts`, `apps/api/src/app/jobs/refresh-scheduler.ts`, `packages/worker/src/services/queue/job.ts`, `apps/api/src/app/jobs/run-worker.ts`, `packages/worker/src/services/feed/refresh.ts` | One active worker and safe recovery for a generation. |
| Inbox load/freshness | `apps/web/src/modules/inbox/queries/options.ts`, `apps/web/src/modules/inbox/page.tsx`, `apps/web/src/modules/inbox/hooks/use-polling.ts`, `apps/web/src/lib/query/cache.ts` | Bounded tab startup/persistence and status-driven invalidation. |
| Tests | Existing API refresh/queue suites; `tests/web/integration/src/modules/inbox/queries/options.test.ts`; new cache persistence test | Lock the lifecycle, polling, and persistence contracts. |

---

## Track A — Fence Feed Refresh Delivery

### Task 1: Add a durable generation to the feed lifecycle

**Files:**
- Modify: `packages/db/src/schema/feeds.ts`
- Create: generated migration and snapshot under `packages/db/drizzle/` and `packages/db/drizzle/meta/`
- Test: `tests/api/integration/app/jobs/refresh-scheduler.test.ts`

**Interfaces:**
- Produces `feeds.refreshGeneration: integer`, non-null with database default `0`.
- Produces `ClaimedFeedRefresh = { feedId: string; reason: FeedRefreshScheduleReason; generation: number }`.

- [ ] **Step 1: Write the failing scheduler-source assertion.**

  Add an assertion that the scheduler's claim SQL increments and returns `refresh_generation`:

  ```ts
  expect(source).toContain("refresh_generation = feeds.refresh_generation + 1");
  expect(source).toContain('feeds.refresh_generation AS "generation"');
  ```

- [ ] **Step 2: Run the focused test and confirm it fails.**

  Run:

  ```bash
  bun run --cwd tests test:api:integration -- app/jobs/refresh-scheduler.test.ts
  ```

  Expected: the new assertion fails because no generation is present.

- [ ] **Step 3: Declare and generate the column.**

  In the lifecycle block of `feeds`, add:

  ```ts
  refreshGeneration: integer("refresh_generation").notNull().default(0),
  ```

  Generate the migration rather than creating SQL by hand:

  ```bash
  bun run db:generate
  ```

  Confirm the generated SQL adds `refresh_generation integer DEFAULT 0 NOT NULL` and the generated snapshot contains the same non-null default.

- [ ] **Step 4: Extend the scheduler's atomic claim result.**

  Change the SQL update and `RETURNING` list to:

  ```sql
  UPDATE feeds
  SET refresh_status = 'queued',
      refresh_generation = feeds.refresh_generation + 1,
      last_refresh_error = NULL,
      updated_at = ${input.now}
  FROM claimed
  WHERE feeds.id = claimed.id
  RETURNING feeds.id AS "feedId",
            claimed.reason AS reason,
            feeds.refresh_generation AS "generation";
  ```

  Change `ClaimedFeedRefresh` to include `generation: number` so downstream publishers cannot omit it.

- [ ] **Step 5: Re-run the focused test and type-check the schema.**

  Run:

  ```bash
  bun run --cwd tests test:api:integration -- app/jobs/refresh-scheduler.test.ts
  bunx --no-install tsgo -p packages/db/tsconfig.json --noEmit
  ```

  Expected: both commands exit `0`. Run the repository drift check only in Task 7, after the generated migration is part of the selected checkpoint.

### Task 2: Atomically coalesce manual and scheduled enqueue claims

**Files:**
- Modify: `apps/api/src/modules/feeds/refresh/enqueue.ts`
- Modify: `apps/api/src/app/jobs/refresh-scheduler.ts`
- Modify: `packages/worker/src/services/queue/job.ts`
- Modify: `apps/api/src/app/jobs/run-worker.ts`
- Test: `tests/api/integration/app/jobs/refresh-scheduler.test.ts`
- Test: `tests/api/integration/modules/queue/job-routing.test.ts`

**Interfaces:**
- `FeedRefreshJob["payload"]` becomes:

  ```ts
  { feedId: string; userId: string; reason?: string; generation?: number }
  ```

  `generation` remains optional only to consume already-pending pre-deploy messages; every new API/scheduler message must carry it.
- `enqueueFeedRefresh(...)` returns `{ jobId: string; generation?: number; coalesced: boolean; deliveryPending: boolean }`. A coalesced request intentionally has no newly claimed generation.
- `enqueueBatchFeedRefresh(...)` returns `{ accepted: true; count: number; coalescedCount: number; deliveryPendingCount: number }`.

- [ ] **Step 1: Write failing job parsing and scheduler-publish tests.**

  Add a queue test that parses `generation: 7`, and add a scheduler assertion that the published payload contains `generation: feed.generation`.

  ```ts
  expect(parseJob({ type: "feed.refresh", payload: JSON.stringify({
    feedId: "feed-1", userId: "user-1", generation: 7,
  }) }).payload.generation).toBe(7);
  ```

  Also assert a non-integer or negative generation throws `Invalid feed.refresh payload`.

- [ ] **Step 2: Run tests and confirm they fail.**

  Run:

  ```bash
  bun run --cwd tests test:api:integration -- modules/queue/job-routing.test.ts app/jobs/refresh-scheduler.test.ts
  ```

  Expected: the parsed job has no generation and scheduler payload assertions fail.

- [ ] **Step 3: Make the generation part of the producer/consumer contract.**

  In `parseFeedRefreshJob`, validate the optional compatibility field exactly once:

  ```ts
  const generation = parsedPayload.generation;
  if (generation !== undefined && (!Number.isInteger(generation) || generation < 0)) {
    throw new Error("Invalid feed.refresh payload");
  }
  ```

  Include it in the parsed payload. In `publishClaimedFeedRefreshes`, publish `generation: feed.generation`.

  In `run-worker.ts`, pass `refreshGeneration: job.payload.generation` into `runFeedRefresh` and pass a feed-stream-specific `pendingMinIdleMs: env.FEED_REFRESH_RUNNING_LEASE_MS` to `consumeJobs`. Leave OPML on the queue's normal recovery policy.

- [ ] **Step 4: Claim before publishing in `enqueue.ts`.**

  Add `and`, `notInArray`, and `sql` to the `drizzle-orm` import, then add a private helper that performs one conditional update and returns its new generation:

  ```ts
  async function claimManualFeedRefresh(database: DB, feedId: string) {
    const [claim] = await database
      .update(feeds)
      .set({
        refreshStatus: "queued",
        refreshGeneration: sql`${feeds.refreshGeneration} + 1`,
        lastRefreshError: null,
        updatedAt: new Date(),
      })
      .where(and(eq(feeds.id, feedId), notInArray(feeds.refreshStatus, ["queued", "running"])))
      .returning({ generation: feeds.refreshGeneration });
    return claim ?? null;
  }
  ```

  If it returns `null`, return `coalesced: true`, `deliveryPending: false`, and no generation without publishing a second job. If it returns a claim, publish exactly that `generation`. A publish error returns the claimed generation with `deliveryPending: true`; the route continues returning `202` because Postgres has accepted durable work even though delivery is deferred.

  If publish throws, **do not reset the row to idle**. Log `queue.job.delivery_pending` and return `deliveryPending` to the caller; the scheduler's queued-lease recovery is then the durable retry. Apply the same claim-first, publish-second behavior to batch refreshes.

- [ ] **Step 5: Stop scheduler recovery from losing ambiguous deliveries.**

  Remove `releaseUnpublishedFeedRefreshClaims`. When scheduler publication fails, retain the queued row and its generation. Its existing stale-queued recovery produces generation `N + 1`; an old `N` message will be fenced at the worker.

  Do not change the queue lease lower bound (60 seconds) or running lease policy in this task.

- [ ] **Step 6: Re-run focused tests.**

  Run:

  ```bash
  bun run --cwd tests test:api:integration -- modules/queue/job-routing.test.ts app/jobs/refresh-scheduler.test.ts
  ```

  Expected: parsing accepts a valid generation, rejects malformed values, and all scheduler tests exit `0`.

### Task 3: Fence the worker's lifecycle writes and make stale work a successful no-op

**Files:**
- Modify: `packages/worker/src/services/feed/refresh.ts`
- Modify: `packages/worker/src/services/feed/types.ts`
- Modify: `apps/api/src/app/jobs/run-worker.ts`
- Test: `tests/api/integration/app/jobs/feed-refresh-errors.test.ts`
- Test: `tests/api/integration/modules/feeds/refresh/html-autodiscovery.test.ts`

**Interfaces:**
- `runFeedRefresh` options add `refreshGeneration?: number`.
- `FeedRefreshResult` adds `skipped?: "superseded" | "not_queued"` for `ok: true` results.
- Private `claimFeedRefresh(...)` returns `{ generation: number } | null`.
- Every write that changes refresh lifecycle fields uses `WHERE feeds.id = feedId AND feeds.refreshGeneration = generation`.

- [ ] **Step 1: Add failing lifecycle-fence tests.**

  Extend the fake database capture used by the existing refresh tests to assert two cases:

  ```ts
  test("does not fetch when its queued generation was superseded", async () => {
    // conditional claim returns no row
    const result = await runFeedRefresh(fake as never, "feed-1", undefined, {
      refreshGeneration: 3,
    });
    expect(result).toMatchObject({ ok: true, skipped: "superseded", itemCount: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("terminal state updates include the claimed generation", async () => {
    // complete one successful refresh with generation 3
    expect(capturedWhereClauses).toContainEqual(expect.stringContaining("refresh_generation"));
  });
  ```

  Keep the existing parse/discovery assertions; this change must not alter ingestion behavior after a successful claim.

- [ ] **Step 2: Run the two suites and confirm the new tests fail.**

  Run:

  ```bash
  bun run --cwd tests test:api:integration -- app/jobs/feed-refresh-errors.test.ts modules/feeds/refresh/html-autodiscovery.test.ts
  ```

  Expected: current code sets `running` by `id` and calls the fetcher even when it should be superseded.

- [ ] **Step 3: Claim before reading or fetching.**

  Replace the unconditional initial `UPDATE feeds ... WHERE id` with a private conditional claim:

  ```ts
  async function claimFeedRefresh(
    database: FeedIngestDatabase,
    feedId: string,
    expectedGeneration: number | undefined,
  ): Promise<{ generation: number } | null> {
    const predicate = expectedGeneration === undefined
      ? and(eq(feeds.id, feedId), eq(feeds.refreshStatus, "queued"))
      : and(
          eq(feeds.id, feedId),
          eq(feeds.refreshStatus, "queued"),
          eq(feeds.refreshGeneration, expectedGeneration),
        );
    const [claimed] = await database
      .update(feeds)
      .set({ refreshStatus: "running", lastRefreshStartedAt: new Date(), lastRefreshError: null })
      .where(predicate)
      .returning({ generation: feeds.refreshGeneration });
    return claimed ?? null;
  }
  ```

  Call it before selecting the feed. A missing claim returns `{ ok: true, itemCount: 0, skipped: expectedGeneration === undefined ? "not_queued" : "superseded" }` and never invokes network, classifier, enrichment, or search work.

- [ ] **Step 4: Fence every terminal and recovery update.**

  Start the outer `try/catch` only after `claimFeedRefresh` succeeds. A database error while attempting the conditional claim must propagate to the queue retry path, not mark a feed failed without owning a generation.

  Pass the claimed generation into the existing permanent-error helper and all success/failure/not-modified/HTML-autodiscovery terminal updates. Their predicates must use:

  ```ts
  .where(and(eq(feeds.id, feedId), eq(feeds.refreshGeneration, generation)))
  ```

  If an update returns no row, log `feed.refresh.superseded` with `feedId`, `generation`, and the attempted terminal state. Do not throw and do not overwrite a newer generation.

- [ ] **Step 5: Keep worker acknowledgements and logs truthful.**

  In `handleWorkerJob`, include `skipped: result.skipped ?? null` in the completed log event. A skipped job remains a successful `onJob` completion, so `processMessage` acknowledges it instead of retrying it.

- [ ] **Step 6: Run focused tests and type checks.**

  Run:

  ```bash
  bun run --cwd tests test:api:integration -- app/jobs/feed-refresh-errors.test.ts modules/feeds/refresh/html-autodiscovery.test.ts modules/queue/job-routing.test.ts app/jobs/refresh-scheduler.test.ts
  bun run typecheck:app
  ```

  Expected: all targeted tests and typecheck exit `0`.

- [ ] **Step 7: Commit Track A with GitButler.**

  Inspect only this track's changes with `but diff`, then commit the selected schema, migration, API, worker, and test hunks to a dedicated `chore/feed-refresh-fencing` branch with message:

  ```text
  fix(feeds): fence duplicate refresh execution
  ```

  Do not include the pre-existing reader/sidebar changes shown in the workspace.

---

## Track B — Bound Inbox Prefetch, Hydration, and Freshness

### Task 4: Replace all-scope startup prefetch with explicit active-query prefetch

**Files:**
- Modify: `apps/web/src/modules/inbox/page.tsx`
- Modify: `apps/web/src/modules/inbox/queries/options.ts`
- Test: `tests/web/integration/src/modules/inbox/queries/options.test.ts`

**Interfaces:**
- Remove `getInboxSwitchTargetScopes`, `InboxSwitchTargetScope`, and `prefetchInboxSwitchTargets`.
- Retain `prefetchInboxHotQueries(queryClient, activeScope)`: the route loader's active list plus sidebar summary remains the only blocking preload.

- [ ] **Step 1: Replace the fan-out tests with a negative contract.**

  Replace the direct named imports with a namespace import so the test can assert the bulk API disappears. Delete the tests asserting every filter/feed/folder is preloaded. Add:

  ```ts
  import * as inboxQueryOptions from "@modules/inbox/queries/options";

  test("does not export bulk switch-target prefetch", () => {
    expect(inboxQueryOptions).not.toHaveProperty("prefetchInboxSwitchTargets");
    expect(inboxQueryOptions).not.toHaveProperty("getInboxSwitchTargetScopes");
  });

  test("hot prefetch requests only the active inbox list and sidebar summary", async () => {
    await inboxQueryOptions.prefetchInboxHotQueries(queryClient as never, {
      filter: "all", feedId: "feed-1", timezoneOffsetMinutes: 300,
    });
    expect(prefetchInfiniteQueryCalls).toHaveLength(1);
    expect(prefetchQueryCalls).toHaveLength(1);
  });
  ```

- [ ] **Step 2: Run the web test and confirm it fails until production callers are removed.**

  Run:

  ```bash
  bun run --cwd tests test:web:integration -- modules/inbox/queries/options.test.ts
  ```

  Expected: the negative export assertions fail because both bulk helpers still exist.

- [ ] **Step 3: Remove all-scope construction and the page effect.**

  Delete `getInboxSwitchTargetScopes`, its target-only types/helpers, and `prefetchInboxSwitchTargets` from `options.ts`. In `page.tsx`, delete the import and the `useEffect` that passes `followedFeedsData` and `foldersData` to the helper.

  Do not add a hover-prefetch replacement in this change. A normal query on deliberate tab/feed navigation is bounded and correct; an intent predictor needs measured latency evidence before it is introduced.

- [ ] **Step 4: Re-run the focused web test.**

  Run:

  ```bash
  bun run --cwd tests test:web:integration -- modules/inbox/queries/options.test.ts
  ```

  Expected: exit `0`, with one infinite-query prefetch and one sidebar-summary prefetch in the hot-preload test.

### Task 5: Poll feed lifecycle state at a bounded foreground cadence

**Files:**
- Modify: `apps/web/src/modules/inbox/queries/options.ts`
- Modify: `apps/web/src/modules/inbox/page.tsx`
- Modify: `apps/web/src/modules/inbox/hooks/use-polling.ts`
- Test: `tests/web/integration/src/modules/inbox/queries/options.test.ts`

**Interfaces:**
- Export `IDLE_FEED_REFRESH_POLL_INTERVAL_MS = 30_000`.
- Export `getFeedRefreshPollInterval(feeds): 2_500 | 30_000`.
- `usePolling` becomes transition invalidation only; it owns no `setInterval`.

- [ ] **Step 1: Add polling-policy tests.**

  Add:

  ```ts
  expect(getFeedRefreshPollInterval([{ refreshStatus: "idle" }])).toBe(30_000);
  expect(getFeedRefreshPollInterval([{ refreshStatus: "queued" }])).toBe(2_500);
  expect(getFeedRefreshPollInterval([{ refreshStatus: "running" }])).toBe(2_500);
  ```

- [ ] **Step 2: Run the focused test and confirm it fails.**

  Run:

  ```bash
  bun run --cwd tests test:web:integration -- modules/inbox/queries/options.test.ts
  ```

  Expected: `getFeedRefreshPollInterval` is not exported.

- [ ] **Step 3: Define the policy once and wire it into the followed-feeds query.**

  In `options.ts`:

  ```ts
  export const IDLE_FEED_REFRESH_POLL_INTERVAL_MS = 30_000;

  export function getFeedRefreshPollInterval(
    feeds: readonly { refreshStatus?: string | null }[] | null | undefined,
  ) {
    return hasActiveFeedRefresh(feeds)
      ? ACTIVE_FEED_REFRESH_POLL_INTERVAL_MS
      : IDLE_FEED_REFRESH_POLL_INTERVAL_MS;
  }
  ```

  In `page.tsx`, add to the existing `useQuery` for `followedFeedsQueryKey()` (keep the cast local because the query callback's state data is typed as `unknown`):

  ```ts
  refetchInterval: (query) =>
    getFeedRefreshPollInterval(
      query.state.data as Awaited<ReturnType<typeof listFollowedFeeds>> | undefined,
    ),
  refetchIntervalInBackground: false,
  ```

  Keep `staleTime` unchanged: the interval is an explicit foreground freshness policy, not a signal to make unrelated metadata stale.

- [ ] **Step 4: Collapse `usePolling` to state transitions.**

  Remove `window.setInterval` and the `ACTIVE_FEED_REFRESH_POLL_INTERVAL_MS` import. On either transition into active or from active to idle/failed, invalidate exactly:

  ```ts
  ["inbox", "items"]
  ["sidebar", "inbox-summary"]
  ```

  Do not invalidate `followedFeedsQueryKey()` from this hook; TanStack Query owns that query's cadence now. This prevents an invalidate/refetch loop.

- [ ] **Step 5: Re-run the focused web test.**

  Run:

  ```bash
  bun run --cwd tests test:web:integration -- modules/inbox/queries/options.test.ts
  ```

  Expected: exit `0`, including 30-second idle and 2.5-second active assertions.

### Task 6: Persist a bounded, versioned hot cache without changing the live infinite list

**Files:**
- Modify: `apps/web/src/lib/query/cache.ts`
- Create: `tests/web/integration/src/lib/query/cache.test.ts`

**Interfaces:**
- Export `prepareHotCacheState(state: DehydratedState): DehydratedState` for direct deterministic tests.
- Set `HOT_CACHE_KEY` to `kyomi:hot-query-cache:v2`, retain `HOT_CACHE_LEGACY_KEY = "kyomi:hot-query-cache:v1"` only for one-time deletion.
- Persist at most 8 inbox-list query scopes, one first page per list scope, and 20 item-detail queries; retain existing folder/feed/sidebar hot-query behavior.

- [ ] **Step 1: Write deterministic persistence-shape tests.**

  Construct a `DehydratedState` with ten successful `['inbox', 'items', ...]` queries, each containing two pages, and 22 item-detail queries. Assert:

  ```ts
  const compacted = prepareHotCacheState(state);
  const listQueries = compacted.queries.filter((query) => query.queryKey[1] === "items");
  expect(listQueries).toHaveLength(8);
  expect(listQueries.every((query) => (query.state.data as InfiniteData<InboxListPage>).pages).toHaveLength(1));
  expect(compacted.queries.filter((query) => query.queryKey[1] === "item-detail")).toHaveLength(20);
  ```

  Add a second test proving the retained page is page 0 (the newest initial cursor page) and that invalid page data is excluded rather than persisted.

- [ ] **Step 2: Run it and confirm it fails.**

  Run:

  ```bash
  bun run --cwd tests test:web:integration -- lib/query/cache.test.ts
  ```

  Expected: the new module or export does not exist and the current dehydrated state is unbounded.

- [ ] **Step 3: Compact dehydrated state before IndexedDB writes.**

  Import `type DehydratedState` and add narrow helpers that:

  1. retain only the newest eight `['inbox', 'items', ...]` queries by `state.dataUpdatedAt`;
  2. replace each retained valid `InfiniteData<InboxListPage>` with `pages: [pages[0]]` and `pageParams: [pageParams[0]]`;
  3. retain only the newest 20 `['inbox', 'item-detail', ...]` queries;
  4. leave feeds, folders, sidebar summary, and view-count queries unchanged.

  Name the existing dehydration predicate `isSuccessfulHotQuery` and use that function immediately after `dehydrate(...)`:

  ```ts
  const dehydrated = dehydrate(queryClient, { shouldDehydrateQuery: isSuccessfulHotQuery });
  const state = prepareHotCacheState(dehydrated);
  await writeHotCache({ savedAt: Date.now(), state });
  ```

  Change `removeHotCache` to accept a cache key, then read/write only `HOT_CACHE_KEY` while `hydrateHotQueryCache` also calls `removeHotCache(HOT_CACHE_LEGACY_KEY)`. This actively deletes the old unbounded snapshot rather than merely making it unreachable. Keep `dropCorruptInboxItemQueries` as defence in depth after hydration.

- [ ] **Step 4: Run cache and inbox tests.**

  Run:

  ```bash
  bun run --cwd tests test:web:integration -- lib/query/cache.test.ts modules/inbox/queries/options.test.ts
  ```

  Expected: exit `0`; the tests prove cache bounds without changing live in-memory infinite pagination.

- [ ] **Step 5: Commit Track B with GitButler.**

  Inspect only this track's changes with `but diff`, then commit the selected inbox/cache/test hunks to `chore/inbox-cache-bounds` with message:

  ```text
  perf(inbox): bound refresh prefetch and cache hydration
  ```

---

## End-to-End Validation and Rollout

### Task 7: Validate contracts and deploy safely

**Files:**
- Modify only if a test exposes a real defect in the files named above; do not broaden scope.

- [ ] **Step 1: Run the combined targeted test set.**

  Run:

  ```bash
  bun run --cwd tests test:api:integration -- app/jobs/refresh-scheduler.test.ts app/jobs/feed-refresh-errors.test.ts modules/feeds/refresh/html-autodiscovery.test.ts modules/queue/job-routing.test.ts
  bun run --cwd tests test:web:integration -- modules/inbox/queries/options.test.ts lib/query/cache.test.ts
  ```

  Expected: all selected tests exit `0`.

- [ ] **Step 2: Run static validation.**

  Run:

  ```bash
  bun run typecheck:app
  bun run fmt:check
  bun run check:boundaries
  bun scripts/ci/drizzle-drift.ts
  ```

  Expected: each command exits `0`. If the direct Vitest command again fails at module initialization with `z.enum` undefined, reproduce with `bun run ci:test:web` before treating it as a product regression; record it as a test-harness blocker rather than weakening the inbox assertions.

- [ ] **Step 3: Verify staging behavior with two workers.**

  1. Enqueue a manual refresh for one subscribed feed and retain the resulting generation in logs.
  2. Simulate a second delivery of the same stream message while the first worker is still running.
  3. Verify exactly one `worker.job.feed_refresh.completed` is non-skipped, the other includes `skipped: "superseded"` or `"not_queued"`, and feed state ends `idle`/`failed` for the newest generation.
  4. Stop Redis briefly during a manual enqueue. Verify the feed remains `queued`, then scheduler recovery republishes it after the configured queued lease.
  5. Load an account with many feeds/folders. Verify Network shows one active inbox-list preload at initial route load, not one request per switch target.
  6. With the inbox open and no refresh active, verify one followed-feeds request every 30 seconds; start a refresh and verify 2.5-second polling until it completes; verify no polling while the tab is backgrounded.

- [ ] **Step 4: Roll out in order and monitor.**

  1. Apply the database migration before API/worker code.
  2. Deploy API and worker together so new producers include `generation`; optional parsing keeps outstanding old messages safe.
  3. Watch for `feed.refresh.superseded`, `queue.job.delivery_pending`, scheduler stale-claim counts, and refresh p95 duration for one queued-lease window.
  4. Deploy the web track independently. Compare initial inbox request count, IndexedDB snapshot size, hydration duration, and tab-switch latency before/after.

  Rollback rule: roll back web independently. For backend, leave the additive `refresh_generation` column in place, roll back API/worker together, and let queued work drain; do not delete or rewrite lifecycle rows.

---

## Follow-on Decision Gates

These are intentionally not implementation tasks in this change.

1. **True long-session infinite-feed windowing:** instrument page count, heap growth, and scroll anchor behavior; then choose an anchor-preserving bidirectional window before enabling `maxPages`.
2. **Archive retention/partitioning:** decide retention promises, per-source/item deletion semantics, and restore/export expectations before writing destructive maintenance jobs.
3. **Social-timeline architecture:** only if product requirements call for ranking/personalization. Evaluate fan-out-on-read versus hybrid materialization using target followers/feed, write rate, and freshness SLOs. Current RSS read-time joins are the right simpler architecture until those requirements exist.

## GSTACK REVIEW REPORT

**Review target:** this implementation plan, selected by the user under plan review scope B.

| Review area | Result | Refinement incorporated |
| --- | --- | --- |
| Architecture | Pass with a required fence | Chose a boring integer generation over a new outbox service or Redis lock. It protects duplicate delivery, stale recovery, and old worker terminal writes without a new operational dependency. |
| Code quality | Pass | Lifecycle transitions are centralized around one conditional claim; the plan explicitly removes the duplicate all-target prefetch API rather than leaving a dead alternate path. |
| Tests | Pass with regression requirements | Adds claim/no-fetch, stale-terminal-write, malformed-generation, delivery-pending, no-fan-out, polling, and persisted-page-cap coverage. Existing targeted API tests passed in the audit; the direct web test's `z.enum` initialization failure is called out as a harness check, not ignored. |
| Performance | Pass | Retains cursor semantics and live in-memory list behavior, removes O(feeds + folders) startup requests, bounds persistent hydration, and avoids `maxPages`' unanchored-page eviction footgun. |

**Failure modes accounted for:** Redis publish ambiguity leaves a durable queued claim; duplicate/reclaimed messages skip; a stale worker cannot overwrite a newer generation; scheduler recovery reissues a newer generation; background tabs do not poll; corrupt/old cached pages are not restored.

**Scope decision:** The implementation is split into two independently deployable tracks. The social-feed, retention, and in-memory windowing work is explicitly deferred because each needs a separate product or UX decision rather than being an implementation detail of refresh.
