# OPML Import Rollout

The durable OPML import control plane (Postgres-backed `opml_imports`/`opml_import_items`, ID-only Redis wakeups) ships alongside the legacy Redis-only pipeline (`task-store.ts`, `opml.import`/`opml.import.feed` jobs) until the legacy path is proven drained. This runbook covers the two-phase deploy, the 24-hour observation window, and the gate that must pass before legacy code is deleted.

See [`docs/superpowers/plans/2026-07-15-durable-opml-import-control-plane.md`](superpowers/plans/2026-07-15-durable-opml-import-control-plane.md) for the full design; this doc is the operational checklist for Task 10 Steps 5-7 of that plan.

## Before you deploy

Run the full functional and capacity gate and confirm every command exits 0:

```bash
bun run --cwd tests test:api:integration -- modules/opml/parse.test.ts modules/opml/fetch-url.test.ts modules/opml/store.test.ts modules/opml/queue-jobs.test.ts modules/opml/jobs.test.ts modules/opml/retry.test.ts modules/opml/routes.test.ts modules/opml/recovery.test.ts app/jobs/import-dispatcher.test.ts modules/feeds/subscription/mutations.test.ts
bun run --cwd tests test:web:integration -- src/modules/feeds/opml.test.ts
bun run typecheck:app
bun run fmt:check
bun run lint
bun scripts/ci/drizzle-drift.ts

RUN_OPML_CAPACITY=true bun run --cwd tests test:api:integration -- modules/opml/capacity.test.ts
bun run scripts/bench/import-capacity.ts -- --feeds 1000 --known-ratio 1
bun run scripts/bench/import-capacity.ts -- --feeds 5000 --known-ratio 0.8
bun run scripts/bench/import-capacity.ts -- --feeds 10000 --known-ratio 0.5
bun run scripts/bench/import-capacity.ts -- --feeds 50000 --known-ratio 0
bun run scripts/bench/import-capacity.ts -- --feeds 50000 --known-ratio 1
```

Expected on the benchmark's JSON output: 50K parse + materialize under 90s, `peakRssBytes` under 768 MiB, 50K all-known reaches a terminal import state within 5 minutes, and `counterMismatch: false` on every run. `scripts/bench/import-capacity.ts` runs against whatever Postgres its env points at and cleans up its own rows on exit — do not point it at a database with a live refresh scheduler under load, since the scheduler will pick up the benchmark's synthetic feeds and contend with its own cleanup delete.

## Phase A: ship the durable path alongside the legacy one

Deploy in this order. Each step should be independently verifiable before moving to the next.

1. **Apply the additive schema migration.** `opml_imports` and `opml_import_items` are new tables; nothing existing is altered or dropped. Safe to apply ahead of any application deploy.
2. **Deploy workers that understand both legacy and new job types.** The worker must route `opml.import` / `opml.import.feed` (legacy, Redis-only) and `opml.import.prepare` / `opml.import.item` (new, ID-only wakeups over Postgres-backed state) to their respective handlers.
3. **Deploy the scheduler with OPML reconciliation.** `runImportDispatcherLoop` must be running in the scheduler process (dispatch every 1s, reconciliation every 30s, retention piggybacked every 24h) — confirm via scheduler startup logs (`import.dispatcher.started`).
4. **Deploy API producers/readers using Postgres.** New imports go through `enqueueOpmlImport` (creates an `opml_imports` row, publishes an ID-only `opml.import.prepare` wakeup) instead of the legacy Redis task store.
5. **Verify.** Create a real import through the deployed API and confirm: a row appears in `opml_imports`, the only new Redis payload is `{importId}` (never raw XML/URLs/titles), and the import reaches `completed`/`failed` through the new pipeline end to end.

### Rollback (Phase A)

Roll back application code only; do not drop the additive tables. Legacy consumers stay deployed through the observation window, so in-flight legacy messages keep draining regardless of whether Phase A's application code is rolled back. Durable rows created by the new path remain available for the corrected deployment — nothing is lost by a Phase A rollback.

## Observe for at least one 24-hour legacy Redis TTL window

`OPML_TASK_TTL_SEC` is 24 hours — that is the minimum meaningful observation window, since it's how long a legacy task's Redis state survives. Track:

| Signal                                                                                                                              | Where                                                                                     | What it tells you                                                                                                  |
| ----------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Import status transition counts (`accepted`, `parsing`, `dispatching`, `running`, `cancelling`, `completed`, `failed`, `cancelled`) | `opml_imports.status`                                                                     | Whether imports are actually completing, not stuck.                                                                |
| Preparation wakeup age and republish count                                                                                          | `opml_imports.prepare_wakeup_at`; `opml.import.reconcile.prepare_republish_failed` logs   | Whether the reconciler is having to compensate for lost Redis wakeups.                                             |
| Pending/leased/processing counts and oldest age                                                                                     | `opml_import_items.status`, `available_at`, `lease_expires_at`                            | Whether the dispatcher is keeping up or backing up.                                                                |
| Attempts histogram, permanent vs. retryable failures                                                                                | `opml_import_items.attempts`, `error_code`                                                | Whether retry/backoff is behaving as designed.                                                                     |
| Dispatcher claims per import and per tick                                                                                           | `runImportDispatcherTick` stats / logs                                                    | Whether fair-dispatch bounds (`IMPORT_DISPATCH_MAX_IMPORTS`, `_PER_IMPORT`, `_TOTAL`) are being hit under real load. |
| Import duration by size and known-feed ratio                                                                                        | `opml_imports.started_at`/`completed_at`, `total_items`                                   | Whether real-world imports match benchmark expectations.                                                           |
| Source XML bytes retained                                                                                                           | `opml_imports.source_xml IS NOT NULL` count                                               | Should shrink to ~0 outside brief in-flight windows — `sourceXml` is cleared on finalize.                          |
| Counter reconciliation mismatches                                                                                                   | Compare `opml_import_items` terminal-status counts against parent `opml_imports` counters | Any mismatch is a bug; do not proceed to the drain gate if found.                                                  |
| Legacy `jobs:opml` lag, pending count, reclaim count, dead letters                                                                  | `redis-cli XINFO GROUPS jobs:opml`, `XPENDING jobs:opml kyomi-workers`                    | Directly feeds the drain gate below.                                                                               |

## Verify the legacy drain gate

The cleanup deployment (Step 7, deleting legacy code) is allowed **only when all of the following are true**:

1. At least 24 hours have passed since the last deploy of a legacy producer (anything still calling the old `opml.import`/`opml.import.feed` enqueue path).
2. `redis-cli XINFO GROUPS jobs:opml` reports lag `0` for the `kyomi-workers` consumer group.
3. `redis-cli XPENDING jobs:opml kyomi-workers` reports `0` pending entries.
4. No dead-letter entry from the observation window has type `opml.import` or `opml.import.feed`.
5. Postgres has no active import whose source of truth is still Redis (i.e. no legacy task-store state is the only record of an in-progress import).

```bash
redis-cli XINFO GROUPS jobs:opml
redis-cli XPENDING jobs:opml kyomi-workers
```

If any condition is false, **do not delete legacy code**. Keep the compatibility path deployed and repeat the gate after the next observation window — this is not a one-shot check, it's a repeatable gate you re-run until it passes.

## Remove legacy Redis task state after the drain

Only after every drain-gate condition above holds:

1. Delete `apps/api/src/modules/opml/task-store.ts`.
2. Remove the legacy `opml.import` and `opml.import.feed` job types, parsers, and handlers from `packages/worker/src/services/queue/job.ts` and `apps/api/src/app/jobs/run-worker.ts`.
3. Remove their tests.
4. Keep `opml.import.prepare` and `opml.import.item` — those are the durable path, not legacy.
5. Run the complete functional gate again (the same command block as "Before you deploy" above).

Confirm the removal is complete:

```bash
rg 'initializeOpmlTask|getOpmlTaskOwner|OPML_TASK_TTL_SEC|type: "opml\.import"|type: "opml\.import\.feed"' apps/api/src packages/worker/src
```

Expected: no production matches (test fixtures and this doc aside). The new prepare/item tests must still pass.

### Rollback (cleanup deployment)

Rollback is the previous application image only. Do not roll back or drop the durable schema — `opml_imports`/`opml_import_items` are permanent once the legacy path is gone.
