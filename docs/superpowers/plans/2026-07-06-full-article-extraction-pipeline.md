# Full Article Extraction Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a staged ingestion pipeline where feed items become visible in the main reader only after durable full-article extraction succeeds, without rewriting the whole backend.

**Architecture:** Keep the Bun/Elysia API, feed refresh scheduler, auth, read APIs, and category/classification code in TypeScript. Add a Go `article-extractor` service that consumes a dedicated Redis Stream, claims extraction work from Postgres, fetches article pages with per-host concurrency, extracts readable HTML/text, persists `extracted_content_*`, and hands full-text classification back to the existing TypeScript worker. Use feature flags so the pipeline can run in shadow mode before the reader visibility gate is enabled.

**Tech Stack:** Bun 1.3.14, Elysia 1.4.x, Drizzle/PostgreSQL 18, Redis Streams, Go 1.24+, `github.com/redis/go-redis/v9`, `github.com/jackc/pgx/v5`, `golang.org/x/net/html`, `codeberg.org/readeck/go-readability/v2`, `github.com/microcosm-cc/bluemonday`.

## Global Constraints

- Do not rewrite `apps/api` or the feed poller into Go; Go is scoped to the extraction worker.
- Keep `packages/worker` as the queue-contract and feed-ingestion package; do not make it import `apps/api`.
- Keep reader-facing `extracted_content_status` values as `pending | ready | failed` so existing API schemas stay stable.
- Add separate workflow status columns for queued/running/retryable/permanent extraction states instead of overloading reader DTO status.
- Main reader visibility is gated by a feature flag first, then by `extraction_workflow_status = 'ready'` when the flag is enabled.
- Do not discard large HTML only because it exceeds the current 3 MiB DOM limit; stream-tokenize and select candidate article regions before returning `too_large_no_candidate`.
- Preserve the existing SSRF/outbound URL safety posture: only `http`/`https`, safe redirects, DNS/private-network blocking, redirect host validation, total timeout, per-host concurrency.
- Queue processing is at-least-once; every extraction and classification write must be idempotent.
- Keep sanitizer parity with `@kyomi/worker/sanitization`; any Go sanitizer policy must be covered by fixture-based drift tests.
- Use GitButler for implementation commits in this repo, following `type(scope): summary` messages.

---

## What Already Exists

- `apps/api/src/app/jobs/refresh-scheduler.ts` claims due feeds with `FOR UPDATE SKIP LOCKED`, publishes `feed.refresh`, and respects queued-job backpressure.
- `apps/api/src/app/jobs/run-worker.ts` consumes Redis Streams, handles `feed.refresh` and OPML jobs, and logs job duration/attempts.
- `packages/worker/src/services/feed/refresh.ts` fetches/parses feeds, upserts `feed_items`, shallow-enriches at most five inserted items, classifies feed/item text, syncs categories, and syncs feed metadata to Meili.
- `packages/db/src/schema/articles.ts` already has feed-provided content fields (`content_*`, `content_status`) and reader extraction artifact fields (`extracted_content_html`, `extracted_content_text`, `extracted_content_status`, `extracted_content_error`, `extracted_content_updated_at`).
- `apps/api/src/modules/articles/reader/extraction/readability.ts` performs on-demand extraction with `@mozilla/readability` and `linkedom`.
- `apps/api/src/modules/articles/reader/content/sanitize.ts` wraps `@kyomi/worker/sanitization` with asset URL resolution, carousel cleanup, metadata trimming, and text conversion.
- `packages/worker/src/sanitization/article-html.ts` owns the allowlist policy used by the current reader sanitizer.
- `apps/api/src/modules/articles/read/list/query.ts`, `apps/api/src/modules/articles/read/counts.ts`, and `apps/api/src/modules/articles/read/detail.ts` are the key read paths that must honor the visibility gate.

## Research Notes

- Mozilla Readability expects a DOM document and exposes options such as `maxElemsToParse`, `nbTopCandidates`, and `charThreshold`; it explicitly does not sanitize output and recommends a sanitizer for untrusted content. Source: https://github.com/mozilla/readability
- Go's `golang.org/x/net/html` package provides an HTML5 tokenizer over an `io.Reader`, which is the right primitive for scanning very large HTML without building a complete DOM first. Source: https://pkg.go.dev/golang.org/x/net/html
- `github.com/go-shiori/go-readability` is deprecated in favor of `codeberg.org/readeck/go-readability/v2`; the old package documents `FromReader`, parser limits, and compatibility goals with Mozilla Readability. Source: https://pkg.go.dev/github.com/go-shiori/go-readability
- `bluemonday` supports custom allowlist policies and ships safe defaults, but the Kyomi policy must be modeled explicitly because article rendering currently allows a narrower reader-safe subset than broad UGC HTML. Source: https://github.com/microcosm-cc/bluemonday
- PostgreSQL documents `SKIP LOCKED` as useful for queue-like multi-consumer tables while warning it produces an inconsistent general-purpose view. Source: https://www.postgresql.org/docs/current/sql-select.html
- Redis Streams support consumer groups and abandoned-work claiming (`XAUTOCLAIM`), matching the existing worker recovery approach. Source: https://redis.io/docs/latest/develop/data-types/streams/

## Scope Decisions

Accepted:
- Add staged extraction state to `feed_items`.
- Add Redis job contracts for `article.extract` and `article.classify`.
- Add a Go extraction service, Docker service, tests, and runbook.
- Add large-HTML streaming candidate extraction before DOM/readability parsing.
- Add reader-list/count/detail visibility gating behind `ARTICLE_EXTRACTION_VISIBILITY_GATE_ENABLED`.
- Add a retry/backoff scheduler for extraction jobs.
- Keep full-text category classification in the TypeScript worker using existing embedding/category helpers.

Deferred:
- Rewriting feed parsing into Go. The current feed poller is already performant and has broad TypeScript tests.
- Rewriting auth, article read APIs, OPML import, catalog sync, or scheduler into Go.
- Replacing the on-demand clip extraction UX with the Go service. This plan only migrates feed-item ingestion extraction; clip extraction can be routed through the same worker after feed ingestion is stable.
- Building a user-facing failed-extraction inbox. Failure states will be queryable from DB/logs first.
- Robots.txt enforcement. This plan keeps polite host limits and safe-fetch controls; robots policy needs a product decision because it can hide publisher content permanently.

## Architecture Diagram

```text
RSS/Atom/JSON feed
      |
      v
apps/api scheduler -- feed.refresh --> Bun worker
      |                              packages/worker feed refresh
      |                              - fetch feed
      |                              - parse items
      |                              - upsert feed_items as extraction_workflow_status='pending'
      |                              - return extraction candidates
      |                                      |
      |                                      v
      |                         Redis stream jobs:article-extraction
      |                                      |
      v                                      v
extraction scheduler --------------> Go article-extractor
  - retries pending/retryable          - per-host + global concurrency
  - SKIP LOCKED claims                 - safe redirects + byte/time limits
  - publishes article.extract          - stream candidate extraction for large HTML
                                       - readability + sanitizer
                                       - persist extracted_content_* and workflow ready/failed
                                       - publish article.classify
                                                |
                                                v
                                      Bun worker classification
                                      - reclassifyExtractedFeedItem
                                      - sync category rows
                                                |
                                                v
                                      Reader list/count/detail
                                      - flag off: current visibility
                                      - flag on: only extraction_workflow_status='ready'
```

## File Map

### TypeScript Orchestration

- Modify `packages/db/src/schema/articles.ts`: add extraction workflow and classification tracking columns/indexes.
- Create `packages/db/drizzle/0035_article_extraction_pipeline.sql`: DB migration for new columns and partial indexes.
- Modify `apps/api/src/config/env/runtime.ts`: add pipeline, scheduler, and visibility-gate env vars.
- Modify `apps/api/.env.example`: document the new env vars.
- Modify `packages/worker/src/services/queue/job.ts`: add `ARTICLE_EXTRACTION_JOBS_STREAM_KEY`, `ARTICLE_CLASSIFICATION_JOBS_STREAM_KEY`, `article.extract`, and `article.classify`.
- Modify `tests/api/integration/modules/queue/job-routing.test.ts`: assert new queue routing and parsing.
- Modify `packages/worker/src/services/feed/types.ts`: return extraction candidates from feed refresh.
- Modify `packages/worker/src/services/feed/refresh.ts`: set initial workflow state and return post-upsert candidates without publishing Redis jobs.
- Modify `apps/api/src/app/jobs/run-worker.ts`: publish `article.extract` after feed refresh and consume `article.classify`.
- Create `apps/api/src/app/jobs/extraction-scheduler.ts`: claim due extraction work and publish `article.extract`.
- Modify `apps/api/src/app/jobs/refresh-scheduler.ts`: invoke extraction scheduler tick from the scheduler loop.
- Create `apps/api/src/modules/articles/read/extraction-visibility.ts`: one helper for the list/count/detail visibility SQL.
- Modify `apps/api/src/modules/articles/read/list/query.ts`: apply visibility helper to list and cursor lookup paths.
- Modify `apps/api/src/modules/articles/read/counts.ts`: apply visibility helper to counts.
- Modify `apps/api/src/modules/articles/read/detail.ts`: apply visibility helper when gate is enabled.
- Modify `apps/api/src/modules/articles/reader/extraction/workflow.ts`: keep on-demand extraction compatible with workflow fields.
- Create `tests/api/integration/app/jobs/extraction-scheduler.test.ts`: scheduler claim/backpressure tests.
- Create `tests/api/integration/modules/feeds/refresh/extraction-candidates.test.ts`: feed refresh candidate-return tests.
- Create `tests/api/integration/modules/articles/read/extraction-visibility.test.ts`: list/count/detail visibility tests.
- Create `tests/api/integration/modules/articles/reader/extraction-workflow-status.test.ts`: on-demand extraction compatibility tests.

### Go Extractor

- Create `services/article-extractor/go.mod`: Go module and dependencies.
- Create `services/article-extractor/cmd/extractor/main.go`: service entrypoint and signal handling.
- Create `services/article-extractor/internal/config/config.go`: env parsing and defaults.
- Create `services/article-extractor/internal/queue/redis.go`: Redis Streams consumer, ack/dead-letter, and classification publish.
- Create `services/article-extractor/internal/store/postgres.go`: claim/update extraction rows idempotently.
- Create `services/article-extractor/internal/hostlimit/hostlimit.go`: per-host semaphore manager.
- Create `services/article-extractor/internal/fetch/fetch.go`: safe HTTP client, redirects, byte/time limits.
- Create `services/article-extractor/internal/htmlcandidate/candidate.go`: streaming candidate selection for large HTML.
- Create `services/article-extractor/internal/extract/readability.go`: readability adapter and word/paragraph validation.
- Create `services/article-extractor/internal/sanitize/policy.go`: Kyomi article sanitizer policy modeled in Go.
- Create `services/article-extractor/internal/result/classify.go`: map fetch/extraction errors to workflow statuses.
- Create `services/article-extractor/internal/logging/logging.go`: structured JSON logs.
- Create `services/article-extractor/internal/*/*_test.go`: focused Go unit tests.
- Create `services/article-extractor/testdata/*.html`: fixture pages for small article, large article, login, captcha, paywall, non-article, oversized-with-candidate, oversized-no-candidate.

### Docker, Scripts, Docs

- Modify `docker/docker-compose.yml`: add `article-extractor` service.
- Modify `package.json`: add `test:extractor` script that runs Go tests.
- Create `docs/runbooks/article-extraction-pipeline.md`: operations runbook, rollout/rollback, metrics, failure states.

## Data Model

Reader artifact fields stay as-is:

```text
feed_items.extracted_content_html        -- sanitized readable HTML for reader mode
feed_items.extracted_content_text        -- readable text for search/classification/summaries
feed_items.extracted_content_status      -- pending | ready | failed
feed_items.extracted_content_error       -- user-safe error string
feed_items.extracted_content_updated_at  -- last artifact status update
```

New workflow fields:

```text
extraction_workflow_status:
  pending | queued | running | ready | retryable_failed | permanent_failed |
  paywalled | login_required | captcha | blocked | not_article |
  unsupported_content_type | too_large_no_candidate | sanitization_failed

extraction_failure_kind:
  transient_network | permanent_http | access_control | content_quality |
  safety_policy | resource_limit | parser | sanitizer | unknown

extraction_failure_code:
  BLOCKED_URL | FETCH_TIMEOUT | FETCH_FAILED | HTTP_401 | HTTP_403 |
  HTTP_404 | HTTP_429 | NOT_HTML | LOGIN_PAGE | CAPTCHA_PAGE |
  PAYWALL_PAGE | NO_READABLE_CONTENT | TOO_LARGE_NO_CANDIDATE |
  PARSING_FAILED | SANITIZATION_FAILED | UNKNOWN
```

Visibility rule:

```text
ARTICLE_EXTRACTION_VISIBILITY_GATE_ENABLED=false:
  feed items are visible using current list/count/detail behavior.

ARTICLE_EXTRACTION_VISIBILITY_GATE_ENABLED=true:
  feed items are visible in the main reader only when
  extraction_workflow_status = 'ready'
  AND extracted_content_status = 'ready'
  AND extracted_content_html IS NOT NULL.
```

## Task 1: Add Extraction Workflow Schema

**Files:**
- Modify: `packages/db/src/schema/articles.ts`
- Create: `packages/db/drizzle/0035_article_extraction_pipeline.sql`
- Test: `tests/api/integration/db/article-extraction-pipeline-schema.test.ts`

**Interfaces:**
- Produces DB columns used by Tasks 2-10.
- Produces `feedItems.extractionWorkflowStatus`, `feedItems.extractionNextAttemptAt`, and `feedItems.extractionClassificationStatus` Drizzle fields.

- [ ] **Step 1: Write schema drift test**

Add `tests/api/integration/db/article-extraction-pipeline-schema.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { feedItems } from "@kyomi/db";

describe("article extraction pipeline schema", () => {
  test("feed_items exposes extraction workflow columns", () => {
    expect(feedItems.extractionWorkflowStatus.name).toBe("extraction_workflow_status");
    expect(feedItems.extractionAttemptCount.name).toBe("extraction_attempt_count");
    expect(feedItems.extractionNextAttemptAt.name).toBe("extraction_next_attempt_at");
    expect(feedItems.extractionClassificationStatus.name).toBe(
      "extraction_classification_status",
    );
  });
});
```

- [ ] **Step 2: Run the failing schema test**

Run:

```bash
bun run --cwd tests test:api:integration tests/api/integration/db/article-extraction-pipeline-schema.test.ts
```

Expected: FAIL because `extractionWorkflowStatus` does not exist on `feedItems`.

- [ ] **Step 3: Add Drizzle columns and indexes**

In `packages/db/src/schema/articles.ts`, extend the `feedItems` table after `extractedContentUpdatedAt`:

```ts
    extractionWorkflowStatus: text("extraction_workflow_status").notNull().default("pending"),
    extractionFailureKind: text("extraction_failure_kind"),
    extractionFailureCode: text("extraction_failure_code"),
    extractionFailureMessage: text("extraction_failure_message"),
    extractionAttemptCount: integer("extraction_attempt_count").notNull().default(0),
    extractionQueuedAt: timestamp("extraction_queued_at"),
    extractionStartedAt: timestamp("extraction_started_at"),
    extractionCompletedAt: timestamp("extraction_completed_at"),
    extractionNextAttemptAt: timestamp("extraction_next_attempt_at"),
    extractionLastWorker: text("extraction_last_worker"),
    extractionSourceUrl: text("extraction_source_url"),
    extractionSourceBytes: integer("extraction_source_bytes"),
    extractionCandidateBytes: integer("extraction_candidate_bytes"),
    extractionTruncated: boolean("extraction_truncated").notNull().default(false),
    extractionExtractorVersion: text("extraction_extractor_version"),
    extractionClassificationStatus: text("extraction_classification_status")
      .notNull()
      .default("pending"),
    extractionClassifiedAt: timestamp("extraction_classified_at"),
    extractionClassificationError: text("extraction_classification_error"),
```

Add these indexes inside the `feedItems` table index callback:

```ts
    index("feed_items_extraction_due_idx")
      .on(
        table.extractionWorkflowStatus,
        table.extractionNextAttemptAt.asc().nullsFirst(),
        table.publishedAt.desc().nullsFirst(),
        table.id,
      )
      .where(
        sql`${table.extractionWorkflowStatus} IN ('pending', 'retryable_failed', 'queued', 'running')`,
      ),
    index("feed_items_extraction_ready_idx")
      .on(table.publishedAt.desc().nullsFirst(), table.id.desc().nullsFirst())
      .where(sql`${table.extractionWorkflowStatus} = 'ready'`),
    index("feed_items_extraction_classification_due_idx")
      .on(table.extractionClassificationStatus, table.extractionCompletedAt.asc().nullsFirst())
      .where(sql`${table.extractionClassificationStatus} IN ('pending', 'retryable_failed')`),
```

- [ ] **Step 4: Add SQL migration**

Create `packages/db/drizzle/0035_article_extraction_pipeline.sql`:

```sql
ALTER TABLE "feed_items" ADD COLUMN "extraction_workflow_status" text NOT NULL DEFAULT 'pending';
ALTER TABLE "feed_items" ADD COLUMN "extraction_failure_kind" text;
ALTER TABLE "feed_items" ADD COLUMN "extraction_failure_code" text;
ALTER TABLE "feed_items" ADD COLUMN "extraction_failure_message" text;
ALTER TABLE "feed_items" ADD COLUMN "extraction_attempt_count" integer NOT NULL DEFAULT 0;
ALTER TABLE "feed_items" ADD COLUMN "extraction_queued_at" timestamp;
ALTER TABLE "feed_items" ADD COLUMN "extraction_started_at" timestamp;
ALTER TABLE "feed_items" ADD COLUMN "extraction_completed_at" timestamp;
ALTER TABLE "feed_items" ADD COLUMN "extraction_next_attempt_at" timestamp;
ALTER TABLE "feed_items" ADD COLUMN "extraction_last_worker" text;
ALTER TABLE "feed_items" ADD COLUMN "extraction_source_url" text;
ALTER TABLE "feed_items" ADD COLUMN "extraction_source_bytes" integer;
ALTER TABLE "feed_items" ADD COLUMN "extraction_candidate_bytes" integer;
ALTER TABLE "feed_items" ADD COLUMN "extraction_truncated" boolean NOT NULL DEFAULT false;
ALTER TABLE "feed_items" ADD COLUMN "extraction_extractor_version" text;
ALTER TABLE "feed_items" ADD COLUMN "extraction_classification_status" text NOT NULL DEFAULT 'pending';
ALTER TABLE "feed_items" ADD COLUMN "extraction_classified_at" timestamp;
ALTER TABLE "feed_items" ADD COLUMN "extraction_classification_error" text;

UPDATE "feed_items"
SET "extraction_workflow_status" = CASE
  WHEN "extracted_content_status" = 'ready' AND "extracted_content_html" IS NOT NULL THEN 'ready'
  WHEN "extracted_content_status" = 'failed' THEN 'permanent_failed'
  ELSE 'pending'
END,
"extraction_completed_at" = CASE
  WHEN "extracted_content_updated_at" IS NOT NULL THEN "extracted_content_updated_at"
  ELSE NULL
END;

CREATE INDEX "feed_items_extraction_due_idx"
  ON "feed_items" (
    "extraction_workflow_status",
    "extraction_next_attempt_at" ASC NULLS FIRST,
    "published_at" DESC NULLS FIRST,
    "id"
  )
  WHERE "extraction_workflow_status" IN ('pending', 'retryable_failed', 'queued', 'running');

CREATE INDEX "feed_items_extraction_ready_idx"
  ON "feed_items" ("published_at" DESC NULLS FIRST, "id" DESC NULLS FIRST)
  WHERE "extraction_workflow_status" = 'ready';

CREATE INDEX "feed_items_extraction_classification_due_idx"
  ON "feed_items" ("extraction_classification_status", "extraction_completed_at" ASC NULLS FIRST)
  WHERE "extraction_classification_status" IN ('pending', 'retryable_failed');
```

- [ ] **Step 5: Run schema tests and drift check**

Run:

```bash
bun run --cwd tests test:api:integration tests/api/integration/db/article-extraction-pipeline-schema.test.ts
bun scripts/ci/drizzle-drift.ts
```

Expected: PASS for the schema test and no drift reported.

- [ ] **Step 6: Commit**

```bash
but status
but commit enkang/extraction-pipeline-schema -m "feat(db): add article extraction workflow schema"
```

## Task 2: Add Queue Contracts and Env Flags

**Files:**
- Modify: `packages/worker/src/services/queue/job.ts`
- Modify: `tests/api/integration/modules/queue/job-routing.test.ts`
- Modify: `apps/api/src/config/env/runtime.ts`
- Modify: `apps/api/.env.example`

**Interfaces:**
- Produces `ArticleExtractionJob` consumed by the Go service.
- Produces `ArticleClassificationJob` consumed by `apps/api/src/app/jobs/run-worker.ts`.
- Produces env vars used by scheduler, publisher, reader visibility, and Go Docker config.

- [ ] **Step 1: Extend queue routing test**

Update `tests/api/integration/modules/queue/job-routing.test.ts` imports:

```ts
import {
  ARTICLE_CLASSIFICATION_JOBS_STREAM_KEY,
  ARTICLE_EXTRACTION_JOBS_STREAM_KEY,
  FEED_REFRESH_JOBS_STREAM_KEY,
  OPML_JOBS_STREAM_KEY,
  getStreamKeyForJobType,
  normalizeQueueOptions,
  parseJob,
} from "@kyomi/worker";
```

Add to the route test:

```ts
    expect(getStreamKeyForJobType("article.extract")).toBe(ARTICLE_EXTRACTION_JOBS_STREAM_KEY);
    expect(getStreamKeyForJobType("article.classify")).toBe(
      ARTICLE_CLASSIFICATION_JOBS_STREAM_KEY,
    );
```

Add parser tests:

```ts
  test("parses article extraction jobs", () => {
    expect(
      parseJob({
        type: "article.extract",
        payload: JSON.stringify({
          feedItemId: "item-1",
          feedId: "feed-1",
          url: "https://example.com/a",
          canonicalUrl: "https://example.com/a",
          reason: "new_item",
        }),
      }),
    ).toEqual({
      type: "article.extract",
      payload: {
        feedItemId: "item-1",
        feedId: "feed-1",
        url: "https://example.com/a",
        canonicalUrl: "https://example.com/a",
        reason: "new_item",
      },
    });
  });

  test("parses article classification jobs", () => {
    expect(
      parseJob({
        type: "article.classify",
        payload: JSON.stringify({
          feedItemId: "item-1",
          reason: "extraction_ready",
        }),
      }),
    ).toEqual({
      type: "article.classify",
      payload: {
        feedItemId: "item-1",
        reason: "extraction_ready",
      },
    });
  });
```

- [ ] **Step 2: Run the failing queue test**

Run:

```bash
bun run --cwd tests test:api:integration tests/api/integration/modules/queue/job-routing.test.ts
```

Expected: FAIL because new constants and job types do not exist.

- [ ] **Step 3: Add queue constants and types**

In `packages/worker/src/services/queue/job.ts`, add constants:

```ts
export const ARTICLE_EXTRACTION_JOBS_STREAM_KEY = "jobs:article-extraction";
export const ARTICLE_CLASSIFICATION_JOBS_STREAM_KEY = "jobs:article-classification";
```

Add types:

```ts
export type ArticleExtractionJob = {
  type: "article.extract";
  payload: {
    feedItemId: string;
    feedId: string;
    url: string;
    canonicalUrl: string;
    reason: "new_item" | "retry" | "backfill" | "manual";
  };
};

export type ArticleClassificationJob = {
  type: "article.classify";
  payload: {
    feedItemId: string;
    reason: "extraction_ready" | "retry" | "backfill" | "manual";
  };
};
```

Update the union:

```ts
export type Job =
  | FeedRefreshJob
  | OpmlImportJob
  | OpmlImportFeedJob
  | ArticleExtractionJob
  | ArticleClassificationJob;
```

Update `getStreamKeyForJobType`:

```ts
    case "article.extract":
      return ARTICLE_EXTRACTION_JOBS_STREAM_KEY;
    case "article.classify":
      return ARTICLE_CLASSIFICATION_JOBS_STREAM_KEY;
```

Add parser functions:

```ts
function parseArticleExtractionJob(parsedPayload: Record<string, unknown>): ArticleExtractionJob {
  const reason = parsedPayload.reason;
  if (
    typeof parsedPayload.feedItemId !== "string" ||
    typeof parsedPayload.feedId !== "string" ||
    typeof parsedPayload.url !== "string" ||
    typeof parsedPayload.canonicalUrl !== "string" ||
    !["new_item", "retry", "backfill", "manual"].includes(String(reason))
  ) {
    throw new Error("Invalid article.extract payload");
  }

  return {
    type: "article.extract",
    payload: {
      feedItemId: parsedPayload.feedItemId,
      feedId: parsedPayload.feedId,
      url: parsedPayload.url,
      canonicalUrl: parsedPayload.canonicalUrl,
      reason: reason as ArticleExtractionJob["payload"]["reason"],
    },
  };
}

function parseArticleClassificationJob(
  parsedPayload: Record<string, unknown>,
): ArticleClassificationJob {
  const reason = parsedPayload.reason;
  if (
    typeof parsedPayload.feedItemId !== "string" ||
    !["extraction_ready", "retry", "backfill", "manual"].includes(String(reason))
  ) {
    throw new Error("Invalid article.classify payload");
  }

  return {
    type: "article.classify",
    payload: {
      feedItemId: parsedPayload.feedItemId,
      reason: reason as ArticleClassificationJob["payload"]["reason"],
    },
  };
}
```

Update `parseJob`:

```ts
    case "article.extract":
      return parseArticleExtractionJob(parsedPayload);
    case "article.classify":
      return parseArticleClassificationJob(parsedPayload);
```

- [ ] **Step 4: Add API env vars**

In `apps/api/src/config/env/runtime.ts`, add server schema entries near the existing job env vars:

```ts
    ARTICLE_EXTRACTION_PIPELINE_ENABLED: booleanFromEnv.default(false),
    ARTICLE_EXTRACTION_VISIBILITY_GATE_ENABLED: booleanFromEnv.default(false),
    ARTICLE_EXTRACTION_BATCH_SIZE: z.coerce.number().int().positive().max(5_000).default(100),
    ARTICLE_EXTRACTION_MAX_QUEUED: z.coerce.number().int().positive().max(1_000_000).default(1_000),
    ARTICLE_EXTRACTION_QUEUED_LEASE_MS: z.coerce
      .number()
      .int()
      .min(60_000)
      .max(86_400_000)
      .default(900_000),
    ARTICLE_EXTRACTION_RUNNING_LEASE_MS: z.coerce
      .number()
      .int()
      .min(60_000)
      .max(86_400_000)
      .default(1_800_000),
    ARTICLE_EXTRACTION_CANDIDATES_PER_REFRESH: z.coerce
      .number()
      .int()
      .min(0)
      .max(1_000)
      .default(100),
```

Add matching `runtimeEnv` entries:

```ts
    ARTICLE_EXTRACTION_PIPELINE_ENABLED: process.env.ARTICLE_EXTRACTION_PIPELINE_ENABLED,
    ARTICLE_EXTRACTION_VISIBILITY_GATE_ENABLED:
      process.env.ARTICLE_EXTRACTION_VISIBILITY_GATE_ENABLED,
    ARTICLE_EXTRACTION_BATCH_SIZE: process.env.ARTICLE_EXTRACTION_BATCH_SIZE,
    ARTICLE_EXTRACTION_MAX_QUEUED: process.env.ARTICLE_EXTRACTION_MAX_QUEUED,
    ARTICLE_EXTRACTION_QUEUED_LEASE_MS: process.env.ARTICLE_EXTRACTION_QUEUED_LEASE_MS,
    ARTICLE_EXTRACTION_RUNNING_LEASE_MS: process.env.ARTICLE_EXTRACTION_RUNNING_LEASE_MS,
    ARTICLE_EXTRACTION_CANDIDATES_PER_REFRESH:
      process.env.ARTICLE_EXTRACTION_CANDIDATES_PER_REFRESH,
```

- [ ] **Step 5: Document env vars**

In `apps/api/.env.example`, add:

```dotenv
# Full article extraction pipeline. PIPELINE publishes/claims extraction work; VISIBILITY_GATE
# hides feed items from the main reader until extracted_content_status=ready.
# ARTICLE_EXTRACTION_PIPELINE_ENABLED=false
# ARTICLE_EXTRACTION_VISIBILITY_GATE_ENABLED=false
# ARTICLE_EXTRACTION_BATCH_SIZE=100
# ARTICLE_EXTRACTION_MAX_QUEUED=1000
# ARTICLE_EXTRACTION_QUEUED_LEASE_MS=900000
# ARTICLE_EXTRACTION_RUNNING_LEASE_MS=1800000
# ARTICLE_EXTRACTION_CANDIDATES_PER_REFRESH=100
```

- [ ] **Step 6: Run tests and typecheck**

Run:

```bash
bun run --cwd tests test:api:integration tests/api/integration/modules/queue/job-routing.test.ts
SKIP_ENV_VALIDATION=true bun run typecheck:app
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
but status
but commit enkang/extraction-queue-contract -m "feat(worker): add article extraction queue contracts"
```

## Task 3: Return Extraction Candidates From Feed Refresh

**Files:**
- Modify: `packages/worker/src/services/feed/types.ts`
- Modify: `packages/worker/src/services/feed/refresh.ts`
- Create: `tests/api/integration/modules/feeds/refresh/extraction-candidates.test.ts`

**Interfaces:**
- Produces `FeedRefreshResult.extractionCandidates`.
- Consumes Task 1 workflow columns.
- Consumes Task 2 `ARTICLE_EXTRACTION_CANDIDATES_PER_REFRESH` option in the API worker.

- [ ] **Step 1: Add failing candidate test**

Create `tests/api/integration/modules/feeds/refresh/extraction-candidates.test.ts` with a fake DB matching the pattern in existing refresh tests:

```ts
import { describe, expect, test } from "bun:test";
import { runFeedRefresh } from "@kyomi/worker";
import { createFeedRefreshFakeDb } from "./helpers";

describe("feed refresh extraction candidates", () => {
  test("returns pending extraction candidates after upserting feed items", async () => {
    const fake = createFeedRefreshFakeDb({
      feed: {
        id: "feed-1",
        url: "https://example.com/feed.xml",
        title: "Example",
      },
      feedXml: `
        <rss version="2.0">
          <channel>
            <title>Example</title>
            <link>https://example.com</link>
            <item>
              <title>Article One</title>
              <link>https://example.com/a</link>
              <guid>https://example.com/a</guid>
              <pubDate>Mon, 06 Jul 2026 12:00:00 GMT</pubDate>
            </item>
          </channel>
        </rss>
      `,
      extractionCandidateRows: [
        {
          feedItemId: "item-a",
          feedId: "feed-1",
          url: "https://example.com/a",
          canonicalUrl: "https://example.com/a",
        },
      ],
    });

    const result = await runFeedRefresh(fake as never, "feed-1", undefined, {
      enrichArticles: false,
      extractionCandidateLimit: 25,
    });

    expect(result.ok).toBe(true);
    expect(result.extractionCandidates).toEqual([
      {
        feedItemId: "item-a",
        feedId: "feed-1",
        url: "https://example.com/a",
        canonicalUrl: "https://example.com/a",
      },
    ]);
  });
});
```

Create `tests/api/integration/modules/feeds/refresh/helpers.ts` first by moving the shared fake DB builder from the smallest existing refresh test that already stubs `runFeedRefresh` dependencies. Export `createFeedRefreshFakeDb`, keep the moved test passing unchanged, and then add the new candidate test above.

- [ ] **Step 2: Run the failing candidate test**

Run:

```bash
bun run --cwd tests test:api:integration tests/api/integration/modules/feeds/refresh/extraction-candidates.test.ts
```

Expected: FAIL because `extractionCandidates` and `extractionCandidateLimit` are not implemented.

- [ ] **Step 3: Extend feed refresh result and options**

In `packages/worker/src/services/feed/types.ts`, add:

```ts
export type FeedExtractionCandidate = {
  feedItemId: string;
  feedId: string;
  url: string;
  canonicalUrl: string;
};
```

Extend `FeedRefreshResult`:

```ts
  extractionCandidates?: FeedExtractionCandidate[];
```

In `packages/worker/src/services/feed/refresh.ts`, extend `runFeedRefresh` options:

```ts
    extractionCandidateLimit?: number;
```

- [ ] **Step 4: Insert pending workflow values and return candidates**

In the feed item insert values, add:

```ts
              extractedContentStatus: "pending",
              extractionWorkflowStatus: "pending",
              extractionFailureKind: null,
              extractionFailureCode: null,
              extractionFailureMessage: null,
              extractionAttemptCount: 0,
              extractionNextAttemptAt: now,
              extractionClassificationStatus: "pending",
```

Inside the transaction, after the upsert and category syncs, select candidates into a local variable declared before the transaction:

```ts
    let extractionCandidates: FeedExtractionCandidate[] = [];
```

Use this query inside the transaction:

```ts
      const candidateLimit = Math.min(Math.max(options?.extractionCandidateLimit ?? 0, 0), 1_000);
      if (candidateLimit > 0 && items.length > 0) {
        const canonicalUrls = items.map((item) => item.canonicalUrl);
        extractionCandidates = await tx
          .select({
            feedItemId: feedItems.id,
            feedId: feedItems.feedId,
            url: feedItems.link,
            canonicalUrl: feedItems.canonicalUrl,
          })
          .from(feedItems)
          .where(
            and(
              eq(feedItems.feedId, feed.id),
              inArray(feedItems.canonicalUrl, canonicalUrls),
              sql`${feedItems.extractionWorkflowStatus} IN ('pending', 'retryable_failed')`,
              sql`(${feedItems.extractionNextAttemptAt} IS NULL OR ${feedItems.extractionNextAttemptAt} <= ${now})`,
            ),
          )
          .orderBy(desc(feedItems.publishedAt), desc(feedItems.id))
          .limit(candidateLimit);
      }
```

Add missing imports:

```ts
import { and, desc, eq, inArray, sql } from "drizzle-orm";
```

Return candidates:

```ts
      extractionCandidates,
```

- [ ] **Step 5: Run refresh candidate tests and existing refresh suite**

Run:

```bash
bun run --cwd tests test:api:integration tests/api/integration/modules/feeds/refresh/extraction-candidates.test.ts
bun run --cwd tests test:api:integration tests/api/integration/modules/feeds/refresh
SKIP_ENV_VALIDATION=true bun run typecheck:app
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
but status
but commit enkang/feed-refresh-extraction-candidates -m "feat(worker): surface article extraction candidates"
```

## Task 4: Publish Extraction and Classification Jobs in the Bun Worker

**Files:**
- Modify: `apps/api/src/app/jobs/run-worker.ts`
- Test: `tests/api/integration/app/jobs/run-worker-extraction.test.ts`

**Interfaces:**
- Consumes Task 2 queue contracts.
- Consumes Task 3 `FeedRefreshResult.extractionCandidates`.
- Produces `article.extract` jobs for the Go service.
- Consumes `article.classify` jobs after Go extraction succeeds.

- [ ] **Step 1: Write failing worker tests**

Create `tests/api/integration/app/jobs/run-worker-extraction.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { buildArticleExtractionJobsForRefreshResult } from "@app/jobs/run-worker";

describe("worker extraction job fanout", () => {
  test("builds article.extract jobs only when pipeline is enabled", () => {
    expect(
      buildArticleExtractionJobsForRefreshResult(
        {
          ok: true,
          itemCount: 1,
          extractionCandidates: [
            {
              feedItemId: "item-1",
              feedId: "feed-1",
              url: "https://example.com/a",
              canonicalUrl: "https://example.com/a",
            },
          ],
        },
        false,
      ),
    ).toEqual([]);

    expect(
      buildArticleExtractionJobsForRefreshResult(
        {
          ok: true,
          itemCount: 1,
          extractionCandidates: [
            {
              feedItemId: "item-1",
              feedId: "feed-1",
              url: "https://example.com/a",
              canonicalUrl: "https://example.com/a",
            },
          ],
        },
        true,
      ),
    ).toEqual([
      {
        type: "article.extract",
        payload: {
          feedItemId: "item-1",
          feedId: "feed-1",
          url: "https://example.com/a",
          canonicalUrl: "https://example.com/a",
          reason: "new_item",
        },
      },
    ]);
  });
});
```

- [ ] **Step 2: Run failing worker test**

Run:

```bash
bun run --cwd tests test:api:integration tests/api/integration/app/jobs/run-worker-extraction.test.ts
```

Expected: FAIL because `buildArticleExtractionJobsForRefreshResult` is not exported.

- [ ] **Step 3: Add extraction fanout helper**

In `apps/api/src/app/jobs/run-worker.ts`, add:

```ts
import { publishJob } from "@adapters/queue/publish-job";
import type { FeedRefreshResult, Job } from "@kyomi/worker";
```

Add helper:

```ts
export function buildArticleExtractionJobsForRefreshResult(
  result: FeedRefreshResult,
  enabled: boolean,
): Job[] {
  if (!enabled || !result.ok || !result.extractionCandidates?.length) {
    return [];
  }

  return result.extractionCandidates.map((candidate) => ({
    type: "article.extract" as const,
    payload: {
      feedItemId: candidate.feedItemId,
      feedId: candidate.feedId,
      url: candidate.url,
      canonicalUrl: candidate.canonicalUrl,
      reason: "new_item" as const,
    },
  }));
}
```

After successful `runFeedRefresh`, publish jobs:

```ts
      const extractionJobs = buildArticleExtractionJobsForRefreshResult(
        result,
        env.ARTICLE_EXTRACTION_PIPELINE_ENABLED,
      );
      const redis = getRedis();
      for (const extractionJob of extractionJobs) {
        await publishJob(redis, extractionJob);
      }
```

Pass candidate limit to refresh:

```ts
          extractionCandidateLimit: env.ARTICLE_EXTRACTION_CANDIDATES_PER_REFRESH,
```

- [ ] **Step 4: Add classification job handling**

Add a case in `handleWorkerJob`:

```ts
    case "article.classify": {
      const article = await getArticleDetailForUser(db, "system", job.payload.feedItemId);
      const extractedText = article.reader.extracted.content?.contentText;
      if (!extractedText) {
        logger.warn("worker.job.article_classify.skipped", {
          streamId: id,
          feedItemId: job.payload.feedItemId,
          reason: "missing_extracted_text",
        });
        return;
      }
      await reclassifyExtractedFeedItem(db, article, extractedText, {
        embeddingClassifier: env.VOYAGE_API_KEY ? { apiKey: env.VOYAGE_API_KEY } : undefined,
        logger,
      });
      logger.info("worker.job.article_classify.completed", {
        streamId: id,
        feedItemId: job.payload.feedItemId,
        reason: job.payload.reason,
        attempts,
        durationMs: Date.now() - startTime,
      });
      return;
    }
    case "article.extract": {
      throw new Error("article.extract jobs are owned by the Go article-extractor service");
    }
```

Add imports:

```ts
import { getArticleDetailForUser } from "@modules/articles/read/detail";
import { reclassifyExtractedFeedItem } from "@modules/articles/reader/extraction/workflow";
```

If `getArticleDetailForUser` cannot load with `"system"`, create a private helper in `workflow.ts`:

```ts
export async function reclassifyExtractedFeedItemById(
  database: DB,
  feedItemId: string,
  options: ExtractFullTextOptions,
): Promise<"ready" | "missing" | "skipped"> {
  const rows = await database.select().from(feedItems).where(eq(feedItems.id, feedItemId)).limit(1);
  const row = rows[0];
  if (!row?.extractedContentText) return "missing";
  await reclassifyExtractedFeedItem(
    database,
    {
      id: row.id,
      articleType: "feed",
      title: row.title,
      summary: row.summary,
      link: row.link,
      feedTitle: "",
      feedUrl: null,
      feedSiteUrl: null,
    } as ArticleDetailDto,
    row.extractedContentText,
    options,
  );
  return "ready";
}
```

Use the helper from `run-worker.ts` and update the test to assert the exported helper only. The implementation review should prefer the helper if the `"system"` user path would affect auth/visibility semantics.

- [ ] **Step 5: Run tests and typecheck**

Run:

```bash
bun run --cwd tests test:api:integration tests/api/integration/app/jobs/run-worker-extraction.test.ts
bun run --cwd tests test:api:integration tests/api/integration/modules/queue/job-routing.test.ts
SKIP_ENV_VALIDATION=true bun run typecheck:app
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
but status
but commit enkang/extraction-job-fanout -m "feat(api): publish article extraction jobs"
```

## Task 5: Add Extraction Scheduler and Backpressure

**Files:**
- Create: `apps/api/src/app/jobs/extraction-scheduler.ts`
- Modify: `apps/api/src/app/jobs/refresh-scheduler.ts`
- Create: `tests/api/integration/app/jobs/extraction-scheduler.test.ts`

**Interfaces:**
- Consumes Task 1 workflow columns.
- Consumes Task 2 env vars and queue contracts.
- Produces retry/backfill publishing independent of feed refresh.

- [ ] **Step 1: Write scheduler SQL tests**

Create `tests/api/integration/app/jobs/extraction-scheduler.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import {
  buildArticleExtractionClaimSql,
  normalizeArticleExtractionSchedulerOptions,
} from "@app/jobs/extraction-scheduler";

describe("article extraction scheduler", () => {
  test("normalizes queue bounds", () => {
    expect(normalizeArticleExtractionSchedulerOptions({ batchSize: 0 }).batchSize).toBe(1);
    expect(normalizeArticleExtractionSchedulerOptions({ batchSize: 10_000 }).batchSize).toBe(5_000);
    expect(normalizeArticleExtractionSchedulerOptions({ maxQueuedExtractionJobs: 0 }).maxQueuedExtractionJobs).toBe(1);
  });

  test("claim SQL uses skip locked and resets stale queued/running work", () => {
    const sqlText = String(
      buildArticleExtractionClaimSql({
        now: new Date("2026-07-06T12:00:00.000Z"),
        staleQueuedBefore: new Date("2026-07-06T11:45:00.000Z"),
        staleRunningBefore: new Date("2026-07-06T11:30:00.000Z"),
        limit: 25,
      }).queryChunks.join(""),
    );

    expect(sqlText).toContain("FOR UPDATE SKIP LOCKED");
    expect(sqlText).toContain("extraction_workflow_status");
    expect(sqlText).toContain("RETURNING");
  });
});
```

- [ ] **Step 2: Run failing scheduler test**

Run:

```bash
bun run --cwd tests test:api:integration tests/api/integration/app/jobs/extraction-scheduler.test.ts
```

Expected: FAIL because scheduler module does not exist.

- [ ] **Step 3: Create scheduler module**

Create `apps/api/src/app/jobs/extraction-scheduler.ts`:

```ts
import { inArray, sql } from "drizzle-orm";
import type Redis from "ioredis";
import { feedItems } from "@kyomi/db";
import { db } from "@adapters/db/client";
import { logger } from "@adapters/logger";
import { publishJob } from "@adapters/queue/publish-job";
import { env } from "@config/env";

export type ClaimedArticleExtraction = {
  feedItemId: string;
  feedId: string;
  url: string;
  canonicalUrl: string;
  reason: "retry" | "backfill";
};

export type ArticleExtractionSchedulerOptions = {
  batchSize?: number;
  maxQueuedExtractionJobs?: number;
  queuedLeaseMs?: number;
  runningLeaseMs?: number;
};

export function normalizeArticleExtractionSchedulerOptions(
  options: ArticleExtractionSchedulerOptions = {},
) {
  return {
    batchSize: Math.min(Math.max(options.batchSize ?? 100, 1), 5_000),
    maxQueuedExtractionJobs: Math.min(
      Math.max(options.maxQueuedExtractionJobs ?? 1_000, 1),
      1_000_000,
    ),
    queuedLeaseMs: Math.min(Math.max(options.queuedLeaseMs ?? 900_000, 60_000), 86_400_000),
    runningLeaseMs: Math.min(Math.max(options.runningLeaseMs ?? 1_800_000, 60_000), 86_400_000),
  };
}

export function buildArticleExtractionClaimSql(input: {
  now: Date;
  staleQueuedBefore: Date;
  staleRunningBefore: Date;
  limit: number;
}) {
  return sql<ClaimedArticleExtraction>`
    WITH due AS (
      SELECT fi.id, fi.feed_id, fi.link, fi.canonical_url,
        CASE WHEN fi.extraction_workflow_status = 'retryable_failed'
          THEN 'retry'::text
          ELSE 'backfill'::text
        END AS reason
      FROM feed_items fi
      WHERE (
        fi.extraction_workflow_status IN ('pending', 'retryable_failed')
        AND (fi.extraction_next_attempt_at IS NULL OR fi.extraction_next_attempt_at <= ${input.now})
      )
      OR (
        fi.extraction_workflow_status = 'queued'
        AND fi.extraction_queued_at <= ${input.staleQueuedBefore}
      )
      OR (
        fi.extraction_workflow_status = 'running'
        AND fi.extraction_started_at <= ${input.staleRunningBefore}
      )
      ORDER BY fi.extraction_next_attempt_at NULLS FIRST, fi.published_at DESC, fi.id
      FOR UPDATE SKIP LOCKED
      LIMIT ${input.limit}
    )
    UPDATE feed_items
    SET extraction_workflow_status = 'queued',
        extraction_queued_at = ${input.now},
        extraction_failure_kind = NULL,
        extraction_failure_code = NULL,
        extraction_failure_message = NULL,
        updated_at = ${input.now}
    FROM due
    WHERE feed_items.id = due.id
    RETURNING
      feed_items.id AS "feedItemId",
      feed_items.feed_id AS "feedId",
      feed_items.link AS "url",
      feed_items.canonical_url AS "canonicalUrl",
      due.reason AS "reason"
  `;
}
```

Add row helper, counts, publish, and tick:

```ts
function rowsFromExecute<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  if (result && typeof result === "object" && "rows" in result) {
    return (result as { rows: T[] }).rows;
  }
  return [];
}

export async function countActiveQueuedArticleExtractions(staleQueuedBefore: Date): Promise<number> {
  const result = await db.execute(sql<{ count: number }>`
    SELECT count(*)::int AS count
    FROM feed_items
    WHERE extraction_workflow_status = 'queued'
      AND extraction_queued_at > ${staleQueuedBefore}
  `);
  return rowsFromExecute<{ count: number }>(result)[0]?.count ?? 0;
}

export async function claimDueArticleExtractions(
  options: ArticleExtractionSchedulerOptions = {},
  now = new Date(),
): Promise<ClaimedArticleExtraction[]> {
  const normalized = normalizeArticleExtractionSchedulerOptions(options);
  const staleQueuedBefore = new Date(now.getTime() - normalized.queuedLeaseMs);
  const staleRunningBefore = new Date(now.getTime() - normalized.runningLeaseMs);
  const result = await db.execute(
    buildArticleExtractionClaimSql({
      now,
      staleQueuedBefore,
      staleRunningBefore,
      limit: normalized.batchSize,
    }),
  );
  return rowsFromExecute<ClaimedArticleExtraction>(result);
}

export async function releaseUnpublishedArticleExtractionClaims(feedItemIds: string[]): Promise<void> {
  if (feedItemIds.length === 0) return;
  await db
    .update(feedItems)
    .set({
      extractionWorkflowStatus: "pending",
      extractionFailureKind: "transient_network",
      extractionFailureCode: "QUEUE_PUBLISH_FAILED",
      extractionFailureMessage: "Article extraction enqueue failed",
      updatedAt: new Date(),
    })
    .where(inArray(feedItems.id, feedItemIds));
}

export async function publishClaimedArticleExtractions(
  redis: Redis,
  claimed: ClaimedArticleExtraction[],
): Promise<void> {
  const unpublishedIds: string[] = [];
  for (const item of claimed) {
    try {
      await publishJob(redis, {
        type: "article.extract",
        payload: item,
      });
    } catch (error) {
      unpublishedIds.push(item.feedItemId);
      logger.error("article_extraction.scheduler.publish_failed", {
        feedItemId: item.feedItemId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  await releaseUnpublishedArticleExtractionClaims(unpublishedIds);
}

export async function runArticleExtractionSchedulerTick(redis: Redis): Promise<void> {
  if (!env.ARTICLE_EXTRACTION_PIPELINE_ENABLED) return;
  const now = new Date();
  const options = normalizeArticleExtractionSchedulerOptions({
    batchSize: env.ARTICLE_EXTRACTION_BATCH_SIZE,
    maxQueuedExtractionJobs: env.ARTICLE_EXTRACTION_MAX_QUEUED,
    queuedLeaseMs: env.ARTICLE_EXTRACTION_QUEUED_LEASE_MS,
    runningLeaseMs: env.ARTICLE_EXTRACTION_RUNNING_LEASE_MS,
  });
  const staleQueuedBefore = new Date(now.getTime() - options.queuedLeaseMs);
  const queuedCount = await countActiveQueuedArticleExtractions(staleQueuedBefore);
  if (queuedCount >= options.maxQueuedExtractionJobs) {
    logger.info("article_extraction.scheduler.skipped_backpressure", {
      queuedCount,
      maxQueued: options.maxQueuedExtractionJobs,
    });
    return;
  }
  const claimed = await claimDueArticleExtractions({
    ...options,
    batchSize: Math.min(options.batchSize, options.maxQueuedExtractionJobs - queuedCount),
  });
  await publishClaimedArticleExtractions(redis, claimed);
  logger.info("article_extraction.scheduler.claimed", {
    claimed: claimed.length,
    queuedCount,
  });
}
```

- [ ] **Step 4: Invoke extraction scheduler from scheduler loop**

In `apps/api/src/app/jobs/refresh-scheduler.ts`, import:

```ts
import { runArticleExtractionSchedulerTick } from "./extraction-scheduler";
```

Inside the `while` loop, after `await runFeedRefreshSchedulerTick(redis);`, add:

```ts
      await runArticleExtractionSchedulerTick(redis);
```

- [ ] **Step 5: Run scheduler tests**

Run:

```bash
bun run --cwd tests test:api:integration tests/api/integration/app/jobs/extraction-scheduler.test.ts
bun run --cwd tests test:api:integration tests/api/integration/app/jobs/refresh-scheduler.test.ts
SKIP_ENV_VALIDATION=true bun run typecheck:app
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
but status
but commit enkang/article-extraction-scheduler -m "feat(api): schedule article extraction retries"
```

## Task 6: Gate Reader Visibility Behind Extraction Readiness

**Files:**
- Create: `apps/api/src/modules/articles/read/extraction-visibility.ts`
- Modify: `apps/api/src/modules/articles/read/list/query.ts`
- Modify: `apps/api/src/modules/articles/read/counts.ts`
- Modify: `apps/api/src/modules/articles/read/detail.ts`
- Create: `tests/api/integration/modules/articles/read/extraction-visibility.test.ts`

**Interfaces:**
- Consumes Task 1 workflow columns.
- Consumes Task 2 `ARTICLE_EXTRACTION_VISIBILITY_GATE_ENABLED`.
- Produces one SQL helper used consistently by list, count, and detail paths.

- [ ] **Step 1: Write visibility helper test**

Create `tests/api/integration/modules/articles/read/extraction-visibility.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import {
  shouldGateFeedItemsByExtraction,
  visibleExtractedFeedItemSql,
} from "@modules/articles/read/extraction-visibility";

describe("article extraction visibility", () => {
  test("gate helper follows explicit boolean input", () => {
    expect(shouldGateFeedItemsByExtraction(false)).toBe(false);
    expect(shouldGateFeedItemsByExtraction(true)).toBe(true);
  });

  test("ready SQL requires workflow ready, artifact ready, and html", () => {
    const sqlText = String(visibleExtractedFeedItemSql.queryChunks.join(""));
    expect(sqlText).toContain("extraction_workflow_status");
    expect(sqlText).toContain("extracted_content_status");
    expect(sqlText).toContain("extracted_content_html");
  });
});
```

- [ ] **Step 2: Run failing visibility test**

Run:

```bash
bun run --cwd tests test:api:integration tests/api/integration/modules/articles/read/extraction-visibility.test.ts
```

Expected: FAIL because helper module does not exist.

- [ ] **Step 3: Add visibility helper**

Create `apps/api/src/modules/articles/read/extraction-visibility.ts`:

```ts
import { sql, type SQL } from "drizzle-orm";
import { feedItems } from "@kyomi/db";
import { env } from "@config/env";

export const visibleExtractedFeedItemSql = sql`
  ${feedItems.extractionWorkflowStatus} = 'ready'
  AND ${feedItems.extractedContentStatus} = 'ready'
  AND ${feedItems.extractedContentHtml} IS NOT NULL
`;

export function shouldGateFeedItemsByExtraction(enabled = env.ARTICLE_EXTRACTION_VISIBILITY_GATE_ENABLED) {
  return enabled;
}

export function maybeVisibleExtractedFeedItemSql(): SQL | undefined {
  return shouldGateFeedItemsByExtraction() ? visibleExtractedFeedItemSql : undefined;
}
```

- [ ] **Step 4: Apply helper in list queries**

In `apps/api/src/modules/articles/read/list/query.ts`, import:

```ts
import { maybeVisibleExtractedFeedItemSql } from "../extraction-visibility";
```

In both `listArticleRows` and `listGlobalArticleRows`, after `pushPublishedDateFilters`, add:

```ts
  const extractionVisibilityFilter = maybeVisibleExtractedFeedItemSql();
  if (extractionVisibilityFilter) {
    filters.push(extractionVisibilityFilter);
  }
```

In `pushCursorFilter` and `pushGlobalCursorFilter`, add the same filter inside cursor lookup `.where(and(...))` calls:

```ts
        maybeVisibleExtractedFeedItemSql(),
```

- [ ] **Step 5: Apply helper in count queries**

In `apps/api/src/modules/articles/read/counts.ts`, import:

```ts
import { maybeVisibleExtractedFeedItemSql } from "./extraction-visibility";
```

At the start of count functions, create:

```ts
  const extractionVisibilityFilter = maybeVisibleExtractedFeedItemSql();
```

Add `extractionVisibilityFilter` to each feed-item `.where(and(...))` used for all/unread/saved/today/feed unread counts.

- [ ] **Step 6: Apply helper in detail query**

In `apps/api/src/modules/articles/read/detail.ts`, import:

```ts
import { maybeVisibleExtractedFeedItemSql } from "./extraction-visibility";
```

Change the feed detail `.where`:

```ts
    .where(and(eq(feedItems.id, articleId), maybeVisibleExtractedFeedItemSql()))
```

This causes direct fetches of pending feed items to return `ARTICLE_NOT_FOUND` when the gate is enabled; clips still use the existing clip detail path.

- [ ] **Step 7: Run read tests**

Run:

```bash
bun run --cwd tests test:api:integration tests/api/integration/modules/articles/read/extraction-visibility.test.ts
bun run --cwd tests test:api:integration tests/api/integration/modules/articles
SKIP_ENV_VALIDATION=true bun run typecheck:app
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
but status
but commit enkang/extraction-visibility-gate -m "feat(api): gate feed item visibility on extraction"
```

## Task 7: Scaffold the Go Article Extractor Service

**Files:**
- Create: `services/article-extractor/go.mod`
- Create: `services/article-extractor/cmd/extractor/main.go`
- Create: `services/article-extractor/internal/config/config.go`
- Create: `services/article-extractor/internal/logging/logging.go`
- Modify: `package.json`

**Interfaces:**
- Produces `config.Config` consumed by Go tasks.
- Produces executable `go run ./cmd/extractor`.

- [ ] **Step 1: Add Go module**

Create `services/article-extractor/go.mod`:

```go
module kyomi/article-extractor

go 1.24

require (
	github.com/jackc/pgx/v5 v5.7.5
	github.com/microcosm-cc/bluemonday v1.0.27
	github.com/redis/go-redis/v9 v9.16.0
	golang.org/x/net v0.56.0
)
```

Then run:

```bash
cd services/article-extractor && go get codeberg.org/readeck/go-readability/v2@latest
cd services/article-extractor && go mod tidy
```

Expected: `go.mod` and `go.sum` include `codeberg.org/readeck/go-readability/v2`. A dependency download failure is a network blocker for this task; do not silently substitute another parser because extraction parity is part of the service contract.

- [ ] **Step 2: Add config tests**

Create `services/article-extractor/internal/config/config_test.go`:

```go
package config

import "testing"

func TestLoadDefaults(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://postgres:admin@localhost:5432/kyomi")
	t.Setenv("REDIS_URL", "redis://localhost:6379")
	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}
	if cfg.StreamKey != "jobs:article-extraction" {
		t.Fatalf("StreamKey = %q", cfg.StreamKey)
	}
	if cfg.Group != "kyomi-workers" {
		t.Fatalf("Group = %q", cfg.Group)
	}
	if cfg.FetchMaxBytes != 30*1024*1024 {
		t.Fatalf("FetchMaxBytes = %d", cfg.FetchMaxBytes)
	}
	if cfg.PerHostConcurrency != 1 {
		t.Fatalf("PerHostConcurrency = %d", cfg.PerHostConcurrency)
	}
}
```

- [ ] **Step 3: Implement config**

Create `services/article-extractor/internal/config/config.go`:

```go
package config

import (
	"errors"
	"os"
	"strconv"
	"time"
)

type Config struct {
	DatabaseURL          string
	RedisURL             string
	StreamKey            string
	ClassificationStream string
	DeadLetterStream     string
	Group                string
	Consumer             string
	GlobalConcurrency    int
	PerHostConcurrency   int
	ReadCount            int64
	FetchTimeout         time.Duration
	FetchMaxBytes        int64
	DOMMaxBytes          int64
	CandidateMaxBytes    int64
	MetadataMaxBytes     int64
}

func getenv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func getenvInt64(key string, fallback int64) int64 {
	raw := os.Getenv(key)
	if raw == "" {
		return fallback
	}
	value, err := strconv.ParseInt(raw, 10, 64)
	if err != nil || value <= 0 {
		return fallback
	}
	return value
}

func getenvInt(key string, fallback int) int {
	value := int(getenvInt64(key, int64(fallback)))
	if value < 1 {
		return fallback
	}
	return value
}

func Load() (Config, error) {
	cfg := Config{
		DatabaseURL:          os.Getenv("DATABASE_URL"),
		RedisURL:             os.Getenv("REDIS_URL"),
		StreamKey:            getenv("ARTICLE_EXTRACTION_STREAM", "jobs:article-extraction"),
		ClassificationStream: getenv("ARTICLE_CLASSIFICATION_STREAM", "jobs:article-classification"),
		DeadLetterStream:     getenv("JOBS_DEAD_LETTER_STREAM", "jobs:dead-letter"),
		Group:                getenv("JOBS_CONSUMER_GROUP", "kyomi-workers"),
		Consumer:             getenv("ARTICLE_EXTRACTOR_CONSUMER", "go-extractor"),
		GlobalConcurrency:    getenvInt("ARTICLE_EXTRACTOR_GLOBAL_CONCURRENCY", 16),
		PerHostConcurrency:   getenvInt("ARTICLE_EXTRACTOR_PER_HOST_CONCURRENCY", 1),
		ReadCount:            getenvInt64("ARTICLE_EXTRACTOR_READ_COUNT", 10),
		FetchTimeout:         time.Duration(getenvInt64("ARTICLE_EXTRACTOR_FETCH_TIMEOUT_MS", 15000)) * time.Millisecond,
		FetchMaxBytes:        getenvInt64("ARTICLE_EXTRACTOR_FETCH_MAX_BYTES", 30*1024*1024),
		DOMMaxBytes:          getenvInt64("ARTICLE_EXTRACTOR_DOM_MAX_BYTES", 6*1024*1024),
		CandidateMaxBytes:    getenvInt64("ARTICLE_EXTRACTOR_CANDIDATE_MAX_BYTES", 3*1024*1024),
		MetadataMaxBytes:     getenvInt64("ARTICLE_EXTRACTOR_METADATA_MAX_BYTES", 256*1024),
	}
	if cfg.DatabaseURL == "" {
		return Config{}, errors.New("DATABASE_URL is required")
	}
	if cfg.RedisURL == "" {
		return Config{}, errors.New("REDIS_URL is required")
	}
	return cfg, nil
}
```

- [ ] **Step 4: Add logging and main**

Create `services/article-extractor/internal/logging/logging.go`:

```go
package logging

import (
	"encoding/json"
	"log"
)

func Info(event string, fields map[string]any) {
	write("info", event, fields)
}

func Error(event string, fields map[string]any) {
	write("error", event, fields)
}

func write(level, event string, fields map[string]any) {
	record := map[string]any{"level": level, "event": event}
	for key, value := range fields {
		record[key] = value
	}
	body, err := json.Marshal(record)
	if err != nil {
		log.Printf(`{"level":"error","event":"log_marshal_failed","error":%q}`, err.Error())
		return
	}
	log.Print(string(body))
}
```

Create `services/article-extractor/cmd/extractor/main.go`:

```go
package main

import (
	"context"
	"os"
	"os/signal"
	"syscall"

	"kyomi/article-extractor/internal/config"
	"kyomi/article-extractor/internal/logging"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		logging.Error("article_extractor.config_failed", map[string]any{"error": err.Error()})
		os.Exit(1)
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	logging.Info("article_extractor.started", map[string]any{
		"stream": cfg.StreamKey,
		"group":  cfg.Group,
	})
	<-ctx.Done()
	logging.Info("article_extractor.stopped", map[string]any{})
}
```

- [ ] **Step 5: Add root test script**

In `package.json`, add:

```json
"test:extractor": "cd services/article-extractor && go test ./..."
```

- [ ] **Step 6: Run Go tests**

Run:

```bash
bun run test:extractor
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
but status
but commit enkang/go-article-extractor-scaffold -m "feat(extractor): scaffold Go article extractor"
```

## Task 8: Implement Go Queue and Store Idempotency

**Files:**
- Create: `services/article-extractor/internal/queue/redis.go`
- Create: `services/article-extractor/internal/store/postgres.go`
- Create: `services/article-extractor/internal/queue/redis_test.go`
- Create: `services/article-extractor/internal/store/postgres_test.go`

**Interfaces:**
- Produces `queue.Job`, `queue.Consumer`, and `store.Store`.
- Consumes Task 2 queue payload shape.
- Updates `feed_items` from `queued` to `running`, then to ready or failure states.

- [ ] **Step 1: Add queue payload tests**

Create `services/article-extractor/internal/queue/redis_test.go`:

```go
package queue

import "testing"

func TestParseJob(t *testing.T) {
	job, err := ParseJob("123-0", map[string]string{
		"type": "article.extract",
		"payload": `{"feedItemId":"item-1","feedId":"feed-1","url":"https://example.com/a","canonicalUrl":"https://example.com/a","reason":"new_item"}`,
	})
	if err != nil {
		t.Fatalf("ParseJob() error = %v", err)
	}
	if job.FeedItemID != "item-1" || job.Reason != "new_item" {
		t.Fatalf("unexpected job: %#v", job)
	}
}

func TestParseJobRejectsWrongType(t *testing.T) {
	_, err := ParseJob("123-0", map[string]string{"type": "feed.refresh", "payload": `{}`})
	if err == nil {
		t.Fatal("expected error")
	}
}
```

- [ ] **Step 2: Implement queue parser**

Create `services/article-extractor/internal/queue/redis.go`:

```go
package queue

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/redis/go-redis/v9"
)

type Job struct {
	StreamID     string
	FeedItemID   string `json:"feedItemId"`
	FeedID       string `json:"feedId"`
	URL          string `json:"url"`
	CanonicalURL string `json:"canonicalUrl"`
	Reason       string `json:"reason"`
}

func ParseJob(id string, fields map[string]string) (Job, error) {
	if fields["type"] != "article.extract" {
		return Job{}, fmt.Errorf("unsupported job type %q", fields["type"])
	}
	var job Job
	if err := json.Unmarshal([]byte(fields["payload"]), &job); err != nil {
		return Job{}, err
	}
	if job.FeedItemID == "" || job.FeedID == "" || job.URL == "" || job.CanonicalURL == "" {
		return Job{}, errors.New("invalid article.extract payload")
	}
	job.StreamID = id
	return job, nil
}

type Client struct {
	redis                *redis.Client
	stream               string
	classificationStream string
	deadLetterStream     string
	group                string
	consumer             string
}

func NewClient(redisClient *redis.Client, stream, classificationStream, deadLetterStream, group, consumer string) Client {
	return Client{
		redis: redisClient, stream: stream, classificationStream: classificationStream,
		deadLetterStream: deadLetterStream, group: group, consumer: consumer,
	}
}

func (c Client) EnsureGroup(ctx context.Context) error {
	err := c.redis.XGroupCreateMkStream(ctx, c.stream, c.group, "0").Err()
	if err != nil && !strings.Contains(err.Error(), "BUSYGROUP") {
		return err
	}
	return nil
}

func (c Client) Ack(ctx context.Context, job Job) error {
	return c.redis.XAck(ctx, c.stream, c.group, job.StreamID).Err()
}

func (c Client) PublishClassification(ctx context.Context, feedItemID string) error {
	fields := map[string]any{
		"type":    "article.classify",
		"payload": fmt.Sprintf(`{"feedItemId":%q,"reason":"extraction_ready"}`, feedItemID),
	}
	return c.redis.XAdd(ctx, &redis.XAddArgs{
		Stream: c.classificationStream,
		MaxLen: 100000,
		Approx: true,
		Values: fields,
	}).Err()
}
```

Add missing import:

```go
	"strings"
```

- [ ] **Step 3: Add store SQL tests**

Create `services/article-extractor/internal/store/postgres_test.go`:

```go
package store

import (
	"strings"
	"testing"
)

func TestMarkRunningSQLIsIdempotent(t *testing.T) {
	sql := MarkRunningSQL()
	if !strings.Contains(sql, "WHERE id = $1") {
		t.Fatalf("missing id predicate: %s", sql)
	}
	if !strings.Contains(sql, "extraction_workflow_status IN ('queued', 'pending', 'retryable_failed')") {
		t.Fatalf("missing status guard: %s", sql)
	}
}
```

- [ ] **Step 4: Implement store methods**

Create `services/article-extractor/internal/store/postgres.go`:

```go
package store

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Store struct {
	pool *pgxpool.Pool
}

type ReadyResult struct {
	HTML             string
	Text             string
	SourceURL        string
	SourceBytes      int64
	CandidateBytes   int64
	Truncated        bool
	ExtractorVersion string
}

type FailureResult struct {
	WorkflowStatus string
	FailureKind    string
	FailureCode    string
	Message        string
	RetryAfter     *time.Time
}

func New(pool *pgxpool.Pool) Store {
	return Store{pool: pool}
}

func MarkRunningSQL() string {
	return `
UPDATE feed_items
SET extraction_workflow_status = 'running',
    extraction_started_at = NOW(),
    extraction_last_worker = $2,
    extraction_attempt_count = extraction_attempt_count + 1,
    updated_at = NOW()
WHERE id = $1
  AND extraction_workflow_status IN ('queued', 'pending', 'retryable_failed')
RETURNING id`
}

func (s Store) MarkRunning(ctx context.Context, feedItemID, worker string) (bool, error) {
	rows, err := s.pool.Query(ctx, MarkRunningSQL(), feedItemID, worker)
	if err != nil {
		return false, err
	}
	defer rows.Close()
	return rows.Next(), rows.Err()
}

func (s Store) MarkReady(ctx context.Context, feedItemID string, result ReadyResult) error {
	_, err := s.pool.Exec(ctx, `
UPDATE feed_items
SET extraction_workflow_status = 'ready',
    extraction_failure_kind = NULL,
    extraction_failure_code = NULL,
    extraction_failure_message = NULL,
    extraction_completed_at = NOW(),
    extraction_next_attempt_at = NULL,
    extraction_source_url = $2,
    extraction_source_bytes = $3,
    extraction_candidate_bytes = $4,
    extraction_truncated = $5,
    extraction_extractor_version = $6,
    extracted_content_html = $7,
    extracted_content_text = $8,
    extracted_content_status = 'ready',
    extracted_content_error = NULL,
    extracted_content_updated_at = NOW(),
    extraction_classification_status = 'pending',
    updated_at = NOW()
WHERE id = $1`, feedItemID, result.SourceURL, result.SourceBytes, result.CandidateBytes,
		result.Truncated, result.ExtractorVersion, result.HTML, result.Text)
	return err
}

func (s Store) MarkFailed(ctx context.Context, feedItemID string, result FailureResult) error {
	_, err := s.pool.Exec(ctx, `
UPDATE feed_items
SET extraction_workflow_status = $2,
    extraction_failure_kind = $3,
    extraction_failure_code = $4,
    extraction_failure_message = $5,
    extraction_next_attempt_at = $6,
    extraction_completed_at = NOW(),
    extracted_content_status = 'failed',
    extracted_content_error = $5,
    extracted_content_updated_at = NOW(),
    updated_at = NOW()
WHERE id = $1`, feedItemID, result.WorkflowStatus, result.FailureKind, result.FailureCode,
		result.Message, result.RetryAfter)
	return err
}
```

- [ ] **Step 5: Run Go tests**

Run:

```bash
bun run test:extractor
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
but status
but commit enkang/extractor-queue-store -m "feat(extractor): add queue and store contracts"
```

## Task 9: Implement Safe Fetch, Host Limits, and Large HTML Candidate Selection

**Files:**
- Create: `services/article-extractor/internal/hostlimit/hostlimit.go`
- Create: `services/article-extractor/internal/fetch/fetch.go`
- Create: `services/article-extractor/internal/htmlcandidate/candidate.go`
- Create: `services/article-extractor/internal/fetch/fetch_test.go`
- Create: `services/article-extractor/internal/htmlcandidate/candidate_test.go`
- Create: `services/article-extractor/testdata/large-article.html`
- Create: `services/article-extractor/testdata/large-no-candidate.html`

**Interfaces:**
- Produces `fetch.FetchArticle`.
- Produces `htmlcandidate.Select`.
- Guarantees large HTML gets a candidate-selection pass before failure.

- [ ] **Step 1: Add candidate selector tests**

Create `services/article-extractor/internal/htmlcandidate/candidate_test.go`:

```go
package htmlcandidate

import (
	"strings"
	"testing"
)

func TestSelectCapturesArticleFromLargeHTML(t *testing.T) {
	html := `<html><head><title>x</title></head><body>` +
		strings.Repeat(`<nav>noise</nav>`, 2000) +
		`<article class="post-content"><h1>Title</h1><p>` + strings.Repeat("word ", 120) + `</p></article>` +
		strings.Repeat(`<footer>noise</footer>`, 2000) +
		`</body></html>`
	result, err := Select(strings.NewReader(html), Limits{
		DOMMaxBytes:       128,
		CandidateMaxBytes: 4096,
		MetadataMaxBytes:  512,
	})
	if err != nil {
		t.Fatalf("Select() error = %v", err)
	}
	if !result.UsedCandidate {
		t.Fatal("expected candidate mode")
	}
	if !strings.Contains(result.HTML, "post-content") || !strings.Contains(result.HTML, "Title") {
		t.Fatalf("missing article candidate: %s", result.HTML)
	}
}

func TestSelectRejectsOversizedPageWithoutCandidate(t *testing.T) {
	html := `<html><body>` + strings.Repeat(`<div class="ad">noise</div>`, 5000) + `</body></html>`
	_, err := Select(strings.NewReader(html), Limits{
		DOMMaxBytes:       128,
		CandidateMaxBytes: 1024,
		MetadataMaxBytes:  256,
	})
	if err == nil {
		t.Fatal("expected error")
	}
	if err.Error() != "TOO_LARGE_NO_CANDIDATE" {
		t.Fatalf("error = %v", err)
	}
}
```

- [ ] **Step 2: Implement candidate selector**

Create `services/article-extractor/internal/htmlcandidate/candidate.go`:

```go
package htmlcandidate

import (
	"bytes"
	"errors"
	"io"
	"regexp"
	"strings"

	"golang.org/x/net/html"
)

type Limits struct {
	DOMMaxBytes       int64
	CandidateMaxBytes int64
	MetadataMaxBytes  int64
}

type Result struct {
	HTML          string
	SourceBytes   int64
	CandidateBytes int64
	UsedCandidate bool
	Truncated     bool
}

var positiveAttr = regexp.MustCompile(`(?i)\b(article|post|entry|story|content|main|body|prose|reader)\b`)
var negativeAttr = regexp.MustCompile(`(?i)\b(nav|footer|header|comment|related|share|social|ad|promo|sidebar|menu|subscribe)\b`)

func Select(r io.Reader, limits Limits) (Result, error) {
	var full bytes.Buffer
	limited := io.LimitReader(r, limits.DOMMaxBytes+1)
	n, err := full.ReadFrom(limited)
	if err != nil {
		return Result{}, err
	}
	if n <= limits.DOMMaxBytes {
		return Result{HTML: full.String(), SourceBytes: n, CandidateBytes: n}, nil
	}

	stream := io.MultiReader(bytes.NewReader(full.Bytes()), r)
	z := html.NewTokenizer(stream)
	var candidate bytes.Buffer
	var sourceBytes int64 = n
	depth := 0
	captureDepth := 0
	for {
		tt := z.Next()
		raw := z.Raw()
		sourceBytes += int64(len(raw))
		switch tt {
		case html.ErrorToken:
			if errors.Is(z.Err(), io.EOF) {
				if candidate.Len() == 0 {
					return Result{}, errors.New("TOO_LARGE_NO_CANDIDATE")
				}
				return Result{
					HTML:           "<html><body>" + candidate.String() + "</body></html>",
					SourceBytes:    sourceBytes,
					CandidateBytes: int64(candidate.Len()),
					UsedCandidate:  true,
				}, nil
			}
			return Result{}, z.Err()
		case html.StartTagToken:
			depth++
			token := z.Token()
			if captureDepth == 0 && isPositiveContainer(token) {
				captureDepth = depth
			}
			if captureDepth > 0 {
				if int64(candidate.Len()+len(raw)) > limits.CandidateMaxBytes {
					return Result{
						HTML:           "<html><body>" + candidate.String() + "</body></html>",
						SourceBytes:    sourceBytes,
						CandidateBytes: int64(candidate.Len()),
						UsedCandidate:  true,
						Truncated:      true,
					}, nil
				}
				candidate.Write(raw)
			}
		case html.EndTagToken:
			if captureDepth > 0 {
				candidate.Write(raw)
				if depth == captureDepth {
					captureDepth = 0
				}
			}
			if depth > 0 {
				depth--
			}
		default:
			if captureDepth > 0 {
				if int64(candidate.Len()+len(raw)) > limits.CandidateMaxBytes {
					return Result{
						HTML:           "<html><body>" + candidate.String() + "</body></html>",
						SourceBytes:    sourceBytes,
						CandidateBytes: int64(candidate.Len()),
						UsedCandidate:  true,
						Truncated:      true,
					}, nil
				}
				candidate.Write(raw)
			}
		}
	}
}

func isPositiveContainer(token html.Token) bool {
	if token.Data == "article" || token.Data == "main" {
		return true
	}
	if token.Data != "div" && token.Data != "section" {
		return false
	}
	combined := ""
	for _, attr := range token.Attr {
		if attr.Key == "class" || attr.Key == "id" || strings.HasPrefix(attr.Key, "data-") {
			combined += " " + attr.Val
		}
	}
	return positiveAttr.MatchString(combined) && !negativeAttr.MatchString(combined)
}
```

- [ ] **Step 3: Add safe fetch tests**

Create `services/article-extractor/internal/fetch/fetch_test.go`:

```go
package fetch

import "testing"

func TestReadableContentType(t *testing.T) {
	if !IsReadableContentType("text/html; charset=utf-8") {
		t.Fatal("text/html should be readable")
	}
	if IsReadableContentType("application/pdf") {
		t.Fatal("pdf should not be readable")
	}
}
```

- [ ] **Step 4: Implement fetch skeleton**

Create `services/article-extractor/internal/fetch/fetch.go`:

```go
package fetch

import (
	"context"
	"errors"
	"net/http"
	"net/url"
	"time"

	"kyomi/article-extractor/internal/htmlcandidate"
)

type Limits struct {
	Timeout           time.Duration
	FetchMaxBytes     int64
	DOMMaxBytes       int64
	CandidateMaxBytes int64
	MetadataMaxBytes  int64
}

type Result struct {
	FinalURL       string
	HTML           string
	SourceBytes    int64
	CandidateBytes int64
	Truncated      bool
}

func IsReadableContentType(contentType string) bool {
	return strings.Contains(contentType, "text/html") ||
		strings.Contains(contentType, "application/xhtml+xml") ||
		strings.Contains(contentType, "text/plain")
}

func FetchArticle(ctx context.Context, client *http.Client, rawURL string, limits Limits) (Result, error) {
	parsed, err := url.Parse(rawURL)
	if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") {
		return Result{}, errors.New("BLOCKED_URL")
	}
	ctx, cancel := context.WithTimeout(ctx, limits.Timeout)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, parsed.String(), nil)
	if err != nil {
		return Result{}, err
	}
	req.Header.Set("user-agent", "Mozilla/5.0 (compatible; KyomiFeedFetcher/1.0)")
	req.Header.Set("accept", "text/html,application/xhtml+xml;q=0.9,text/plain;q=0.8,*/*;q=0.5")
	resp, err := client.Do(req)
	if err != nil {
		return Result{}, err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return Result{}, errors.New(httpStatusCode(resp.StatusCode))
	}
	if !IsReadableContentType(resp.Header.Get("content-type")) {
		return Result{}, errors.New("NOT_HTML")
	}
	limitedBody := http.MaxBytesReader(nil, resp.Body, limits.FetchMaxBytes)
	selected, err := htmlcandidate.Select(limitedBody, htmlcandidate.Limits{
		DOMMaxBytes:       limits.DOMMaxBytes,
		CandidateMaxBytes: limits.CandidateMaxBytes,
		MetadataMaxBytes:  limits.MetadataMaxBytes,
	})
	if err != nil {
		return Result{}, err
	}
	return Result{
		FinalURL:        resp.Request.URL.String(),
		HTML:            selected.HTML,
		SourceBytes:     selected.SourceBytes,
		CandidateBytes:  selected.CandidateBytes,
		Truncated:       selected.Truncated,
	}, nil
}

func httpStatusCode(status int) string {
	switch status {
	case http.StatusUnauthorized:
		return "HTTP_401"
	case http.StatusForbidden:
		return "HTTP_403"
	case http.StatusNotFound:
		return "HTTP_404"
	case http.StatusTooManyRequests:
		return "HTTP_429"
	default:
		return "FETCH_FAILED"
	}
}
```

Add missing import:

```go
	"strings"
```

In the same task, add `services/article-extractor/internal/fetch/hosts.go` with `IsBlockedIP(ip net.IP) bool` and `ValidatePublicHost(ctx context.Context, host string) error`. Port the existing blocked ranges from `packages/worker/src/services/favicon/host-safety.ts`: localhost names, loopback, RFC1918, link-local, unique-local IPv6, and cloud metadata IP ranges. Call `ValidatePublicHost` before the first request and in `http.Client.CheckRedirect` before every redirect hop.

- [ ] **Step 5: Add host limiter**

Create `services/article-extractor/internal/hostlimit/hostlimit.go`:

```go
package hostlimit

import (
	"context"
	"net/url"
	"sync"
)

type Limiter struct {
	perHost int
	mu      sync.Mutex
	hosts   map[string]chan struct{}
}

func New(perHost int) *Limiter {
	if perHost < 1 {
		perHost = 1
	}
	return &Limiter{perHost: perHost, hosts: map[string]chan struct{}{}}
}

func (l *Limiter) Run(ctx context.Context, rawURL string, fn func(context.Context) error) error {
	parsed, err := url.Parse(rawURL)
	if err != nil {
		return err
	}
	sem := l.sem(parsed.Hostname())
	select {
	case sem <- struct{}{}:
		defer func() { <-sem }()
		return fn(ctx)
	case <-ctx.Done():
		return ctx.Err()
	}
}

func (l *Limiter) sem(host string) chan struct{} {
	l.mu.Lock()
	defer l.mu.Unlock()
	sem := l.hosts[host]
	if sem == nil {
		sem = make(chan struct{}, l.perHost)
		l.hosts[host] = sem
	}
	return sem
}
```

- [ ] **Step 6: Run Go tests**

Run:

```bash
bun run test:extractor
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
but status
but commit enkang/extractor-large-html-fetch -m "feat(extractor): stream large article HTML candidates"
```

## Task 10: Implement Readability, Sanitization, and Failure Mapping

**Files:**
- Create: `services/article-extractor/internal/extract/readability.go`
- Create: `services/article-extractor/internal/sanitize/policy.go`
- Create: `services/article-extractor/internal/result/classify.go`
- Create: `services/article-extractor/internal/extract/readability_test.go`
- Create: `services/article-extractor/internal/sanitize/policy_test.go`
- Create: `services/article-extractor/internal/result/classify_test.go`
- Create: `services/article-extractor/testdata/sanitizer-cases.json`

**Interfaces:**
- Consumes Task 9 `fetch.Result.HTML`.
- Produces sanitized HTML/text that can be written by Task 8 store.
- Produces failure states matching the data model.

- [ ] **Step 1: Add sanitizer fixture**

Create `services/article-extractor/testdata/sanitizer-cases.json`:

```json
[
  {
    "name": "drops script",
    "input": "<article><p>Hello</p><script>alert(1)</script></article>",
    "mustContain": ["<p>Hello</p>"],
    "mustNotContain": ["script", "alert"]
  },
  {
    "name": "drops javascript href",
    "input": "<p><a href=\"javascript:alert(1)\">bad</a></p>",
    "mustContain": [">bad</a>"],
    "mustNotContain": ["javascript:"]
  },
  {
    "name": "keeps article image http src",
    "input": "<figure><img src=\"https://example.com/a.jpg\" alt=\"A\"><figcaption>Cap</figcaption></figure>",
    "mustContain": ["<img", "https://example.com/a.jpg", "<figcaption>Cap</figcaption>"],
    "mustNotContain": ["onerror"]
  }
]
```

- [ ] **Step 2: Add sanitizer tests**

Create `services/article-extractor/internal/sanitize/policy_test.go`:

```go
package sanitize

import (
	"encoding/json"
	"os"
	"strings"
	"testing"
)

type sanitizerCase struct {
	Name           string   `json:"name"`
	Input          string   `json:"input"`
	MustContain    []string `json:"mustContain"`
	MustNotContain []string `json:"mustNotContain"`
}

func TestSanitizeFixtures(t *testing.T) {
	body, err := os.ReadFile("../../testdata/sanitizer-cases.json")
	if err != nil {
		t.Fatal(err)
	}
	var cases []sanitizerCase
	if err := json.Unmarshal(body, &cases); err != nil {
		t.Fatal(err)
	}
	for _, tc := range cases {
		t.Run(tc.Name, func(t *testing.T) {
			out := ArticlePolicy().Sanitize(tc.Input)
			for _, needle := range tc.MustContain {
				if !strings.Contains(out, needle) {
					t.Fatalf("missing %q in %s", needle, out)
				}
			}
			for _, needle := range tc.MustNotContain {
				if strings.Contains(out, needle) {
					t.Fatalf("unexpected %q in %s", needle, out)
				}
			}
		})
	}
}
```

- [ ] **Step 3: Implement sanitizer policy**

Create `services/article-extractor/internal/sanitize/policy.go`:

```go
package sanitize

import "github.com/microcosm-cc/bluemonday"

func ArticlePolicy() *bluemonday.Policy {
	p := bluemonday.NewPolicy()
	p.AllowStandardURLs()
	p.AllowAttrs("href").OnElements("a")
	p.AllowAttrs("src", "alt", "title").OnElements("img")
	p.AllowAttrs("datetime").OnElements("time")
	p.AllowAttrs("class").OnElements("code", "pre", "span", "div", "section", "article")
	p.AllowElements(
		"a", "abbr", "article", "aside", "b", "blockquote", "br", "caption", "cite", "code",
		"dd", "del", "details", "div", "dl", "dt", "em", "figcaption", "figure", "h1", "h2",
		"h3", "h4", "h5", "h6", "hr", "i", "img", "kbd", "li", "main", "mark", "ol", "p",
		"pre", "q", "s", "section", "small", "span", "strong", "sub", "summary", "sup",
		"table", "tbody", "td", "tfoot", "th", "thead", "time", "tr", "u", "ul",
	)
	return p
}
```

Before running the sanitizer tests, copy every tag in `ARTICLE_HTML_ALLOWED_TAGS` from `packages/worker/src/sanitization/article-html.ts` into the Go `AllowElements` list. Copy only the attributes in `ARTICLE_HTML_ALLOWED_ATTR`, then keep the Go policy narrower where the TypeScript sanitizer relies on runtime callbacks that have no direct Go equivalent. Add one fixture case for each copied non-obvious family: tables, code/pre, MathML, KaTeX spans, figures/images.

- [ ] **Step 4: Add readability tests**

Create `services/article-extractor/internal/extract/readability_test.go`:

```go
package extract

import (
	"strings"
	"testing"
)

func TestExtractArticle(t *testing.T) {
	html := `<html><body><article><h1>Title</h1><p>` + strings.Repeat("word ", 80) + `</p><p>` + strings.Repeat("more ", 80) + `</p></article></body></html>`
	result, err := Article("https://example.com/a", html)
	if err != nil {
		t.Fatalf("Article() error = %v", err)
	}
	if result.Title == "" || result.HTML == "" || len(strings.Fields(result.Text)) < 100 {
		t.Fatalf("bad result: %#v", result)
	}
}
```

- [ ] **Step 5: Implement readability adapter**

Create `services/article-extractor/internal/extract/readability.go`:

```go
package extract

import (
	"errors"
	"net/url"
	"strings"

	readability "codeberg.org/readeck/go-readability/v2"
	"kyomi/article-extractor/internal/sanitize"
)

type Result struct {
	Title         string
	Byline        string
	Excerpt       string
	SiteName      string
	Language      string
	PublishedTime string
	HTML          string
	Text          string
}

func Article(rawURL string, html string) (Result, error) {
	pageURL, err := url.Parse(rawURL)
	if err != nil {
		return Result{}, errors.New("BLOCKED_URL")
	}
	parser := readability.NewParser()
	article, err := parser.Parse(strings.NewReader(html), pageURL)
	if err != nil {
		return Result{}, errors.New("PARSING_FAILED")
	}
	clean := sanitize.ArticlePolicy().Sanitize(article.Content)
	text := strings.TrimSpace(stripText(clean))
	if len(strings.Fields(text)) < 60 || paragraphCount(text) < 2 {
		return Result{}, errors.New("NO_READABLE_CONTENT")
	}
	return Result{
		Title:    strings.TrimSpace(article.Title),
		Byline:   strings.TrimSpace(article.Byline),
		Excerpt:  strings.TrimSpace(article.Excerpt),
		SiteName: strings.TrimSpace(article.SiteName),
		Language: strings.TrimSpace(article.Language),
		HTML:     strings.TrimSpace(clean),
		Text:     text,
	}, nil
}

func paragraphCount(text string) int {
	parts := strings.Split(text, "\n\n")
	count := 0
	for _, part := range parts {
		if strings.TrimSpace(part) != "" {
			count++
		}
	}
	return count
}

func stripText(html string) string {
	replacer := strings.NewReplacer("<p>", "\n\n", "</p>", "\n\n", "<br>", "\n", "<br/>", "\n")
	noBlocks := replacer.Replace(html)
	var out strings.Builder
	inTag := false
	for _, r := range noBlocks {
		switch r {
		case '<':
			inTag = true
		case '>':
			inTag = false
		default:
			if !inTag {
				out.WriteRune(r)
			}
		}
	}
	return strings.Join(strings.Fields(out.String()), " ")
}
```

Before editing the adapter, run `cd services/article-extractor && go doc codeberg.org/readeck/go-readability/v2`. Keep the public `Article(rawURL, html string) (Result, error)` interface exactly as shown above; all package-specific API differences belong inside `services/article-extractor/internal/extract/readability.go`.

- [ ] **Step 6: Add failure classifier tests**

Create `services/article-extractor/internal/result/classify_test.go`:

```go
package result

import "testing"

func TestFailureForCode(t *testing.T) {
	got := FailureForCode("HTTP_429")
	if got.WorkflowStatus != "retryable_failed" || got.FailureKind != "transient_network" {
		t.Fatalf("HTTP_429 classified as %#v", got)
	}
	got = FailureForCode("PAYWALL_PAGE")
	if got.WorkflowStatus != "paywalled" || got.FailureKind != "access_control" {
		t.Fatalf("PAYWALL_PAGE classified as %#v", got)
	}
	got = FailureForCode("TOO_LARGE_NO_CANDIDATE")
	if got.WorkflowStatus != "too_large_no_candidate" || got.FailureKind != "resource_limit" {
		t.Fatalf("TOO_LARGE_NO_CANDIDATE classified as %#v", got)
	}
}
```

- [ ] **Step 7: Implement failure classifier**

Create `services/article-extractor/internal/result/classify.go`:

```go
package result

type Failure struct {
	WorkflowStatus string
	FailureKind    string
	FailureCode    string
	Message        string
	Retryable      bool
}

func FailureForCode(code string) Failure {
	switch code {
	case "FETCH_TIMEOUT", "FETCH_FAILED", "HTTP_429":
		return Failure{"retryable_failed", "transient_network", code, "Article extraction will retry.", true}
	case "HTTP_401", "HTTP_403", "LOGIN_PAGE":
		return Failure{"login_required", "access_control", code, "Article requires login.", false}
	case "CAPTCHA_PAGE":
		return Failure{"captcha", "access_control", code, "Article is protected by a CAPTCHA.", false}
	case "PAYWALL_PAGE":
		return Failure{"paywalled", "access_control", code, "Article appears to be paywalled.", false}
	case "BLOCKED_URL":
		return Failure{"blocked", "safety_policy", code, "Article URL is blocked by outbound safety policy.", false}
	case "NOT_HTML":
		return Failure{"unsupported_content_type", "content_quality", code, "Article is not a readable HTML document.", false}
	case "NO_READABLE_CONTENT":
		return Failure{"not_article", "content_quality", code, "No readable article body was found.", false}
	case "TOO_LARGE_NO_CANDIDATE":
		return Failure{"too_large_no_candidate", "resource_limit", code, "Article HTML was too large and no article candidate was found.", false}
	case "SANITIZATION_FAILED":
		return Failure{"sanitization_failed", "sanitizer", code, "Article HTML could not be sanitized.", false}
	default:
		return Failure{"retryable_failed", "unknown", "UNKNOWN", "Article extraction failed and will retry.", true}
	}
}
```

- [ ] **Step 8: Run Go tests**

Run:

```bash
bun run test:extractor
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
but status
but commit enkang/extractor-readability-sanitizer -m "feat(extractor): parse and sanitize readable articles"
```

## Task 11: Wire the Go Worker Loop End-to-End

**Files:**
- Modify: `services/article-extractor/cmd/extractor/main.go`
- Create: `services/article-extractor/internal/worker/worker.go`
- Create: `services/article-extractor/internal/worker/worker_test.go`

**Interfaces:**
- Consumes Tasks 8-10.
- Produces a long-running service that can process `article.extract` and publish `article.classify`.

- [ ] **Step 1: Add worker classification test**

Create `services/article-extractor/internal/worker/worker_test.go`:

```go
package worker

import (
	"testing"
	"time"
)

func TestRetryDelay(t *testing.T) {
	if RetryDelay(1) != 5*time.Minute {
		t.Fatalf("attempt 1 delay = %s", RetryDelay(1))
	}
	if RetryDelay(5) != 2*time.Hour {
		t.Fatalf("attempt 5 delay = %s", RetryDelay(5))
	}
}
```

- [ ] **Step 2: Implement worker orchestration**

Create `services/article-extractor/internal/worker/worker.go`:

```go
package worker

import (
	"context"
	"errors"
	"net/http"
	"time"

	"kyomi/article-extractor/internal/config"
	"kyomi/article-extractor/internal/extract"
	"kyomi/article-extractor/internal/fetch"
	"kyomi/article-extractor/internal/hostlimit"
	"kyomi/article-extractor/internal/logging"
	"kyomi/article-extractor/internal/queue"
	"kyomi/article-extractor/internal/result"
	"kyomi/article-extractor/internal/store"
)

const extractorVersion = "go-article-extractor/v1"

type Runner struct {
	Config config.Config
	Queue  queue.Client
	Store  store.Store
	Client *http.Client
	Hosts  *hostlimit.Limiter
}

func RetryDelay(attempt int) time.Duration {
	switch {
	case attempt <= 1:
		return 5 * time.Minute
	case attempt == 2:
		return 15 * time.Minute
	case attempt == 3:
		return 30 * time.Minute
	case attempt == 4:
		return time.Hour
	default:
		return 2 * time.Hour
	}
}

func (r Runner) Process(ctx context.Context, job queue.Job) error {
	running, err := r.Store.MarkRunning(ctx, job.FeedItemID, r.Config.Consumer)
	if err != nil || !running {
		return err
	}

	var fetchResult fetch.Result
	err = r.Hosts.Run(ctx, job.URL, func(hostCtx context.Context) error {
		var inner error
		fetchResult, inner = fetch.FetchArticle(hostCtx, r.Client, job.URL, fetch.Limits{
			Timeout:           r.Config.FetchTimeout,
			FetchMaxBytes:     r.Config.FetchMaxBytes,
			DOMMaxBytes:       r.Config.DOMMaxBytes,
			CandidateMaxBytes: r.Config.CandidateMaxBytes,
			MetadataMaxBytes:  r.Config.MetadataMaxBytes,
		})
		return inner
	})
	if err != nil {
		return r.fail(ctx, job, err)
	}

	extracted, err := extract.Article(fetchResult.FinalURL, fetchResult.HTML)
	if err != nil {
		return r.fail(ctx, job, err)
	}

	if err := r.Store.MarkReady(ctx, job.FeedItemID, store.ReadyResult{
		HTML:             extracted.HTML,
		Text:             extracted.Text,
		SourceURL:        fetchResult.FinalURL,
		SourceBytes:      fetchResult.SourceBytes,
		CandidateBytes:   fetchResult.CandidateBytes,
		Truncated:        fetchResult.Truncated,
		ExtractorVersion: extractorVersion,
	}); err != nil {
		return err
	}

	if err := r.Queue.PublishClassification(ctx, job.FeedItemID); err != nil {
		logging.Error("article_extractor.classification_publish_failed", map[string]any{
			"feedItemId": job.FeedItemID,
			"error":      err.Error(),
		})
	}
	return nil
}

func (r Runner) fail(ctx context.Context, job queue.Job, err error) error {
	code := err.Error()
	if code == "" || errors.Is(err, context.DeadlineExceeded) {
		code = "FETCH_TIMEOUT"
	}
	failure := result.FailureForCode(code)
	var retryAfter *time.Time
	if failure.Retryable {
		next := time.Now().Add(RetryDelay(1))
		retryAfter = &next
	}
	return r.Store.MarkFailed(ctx, job.FeedItemID, store.FailureResult{
		WorkflowStatus: failure.WorkflowStatus,
		FailureKind:    failure.FailureKind,
		FailureCode:    failure.FailureCode,
		Message:        failure.Message,
		RetryAfter:     retryAfter,
	})
}
```

- [ ] **Step 3: Wire main to Redis/Postgres**

Modify `services/article-extractor/cmd/extractor/main.go` to create clients and run a loop. Use `XREADGROUP` with `>` for new jobs and `XAUTOCLAIM` for abandoned jobs every loop iteration:

```go
pool, err := pgxpool.New(ctx, cfg.DatabaseURL)
if err != nil { ... }
defer pool.Close()

redisOptions, err := redis.ParseURL(cfg.RedisURL)
if err != nil { ... }
redisClient := redis.NewClient(redisOptions)
defer redisClient.Close()

queueClient := queue.NewClient(redisClient, cfg.StreamKey, cfg.ClassificationStream, cfg.DeadLetterStream, cfg.Group, cfg.Consumer)
if err := queueClient.EnsureGroup(ctx); err != nil { ... }

runner := worker.Runner{
	Config: cfg,
	Queue:  queueClient,
	Store:  store.New(pool),
	Client: &http.Client{Timeout: cfg.FetchTimeout},
	Hosts:  hostlimit.New(cfg.PerHostConcurrency),
}
```

Add imports:

```go
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
	"kyomi/article-extractor/internal/hostlimit"
	"kyomi/article-extractor/internal/queue"
	"kyomi/article-extractor/internal/store"
	"kyomi/article-extractor/internal/worker"
```

Implement `queue.Client.Read` in Task 8 before wiring main if it is not present. It should return `[]queue.Job` parsed from Redis `XReadGroup` messages, and `main` should call `runner.Process` for each job, `Ack` on success or after durable failure persistence.

- [ ] **Step 4: Run Go tests**

Run:

```bash
bun run test:extractor
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
but status
but commit enkang/extractor-worker-loop -m "feat(extractor): process article extraction jobs"
```

## Task 12: Add Docker Compose Service and Local Runbook

**Files:**
- Modify: `docker/docker-compose.yml`
- Modify: `package.json`
- Create: `docs/runbooks/article-extraction-pipeline.md`

**Interfaces:**
- Produces local Docker service `kyomi-article-extractor`.
- Documents rollout/rollback and failure-state interpretation.

- [ ] **Step 1: Add compose service**

In `docker/docker-compose.yml`, add after `worker`:

```yaml
  article-extractor:
    image: golang:1.24-alpine
    container_name: kyomi-article-extractor
    restart: unless-stopped
    working_dir: /app/services/article-extractor
    command:
      [
        "sh",
        "-lc",
        "go mod download && go run ./cmd/extractor"
      ]
    environment:
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
      REDIS_URL: redis://redis:6379
      ARTICLE_EXTRACTION_STREAM: jobs:article-extraction
      ARTICLE_CLASSIFICATION_STREAM: jobs:article-classification
      JOBS_DEAD_LETTER_STREAM: jobs:dead-letter
      JOBS_CONSUMER_GROUP: kyomi-workers
      ARTICLE_EXTRACTOR_CONSUMER: kyomi-go-extractor
      ARTICLE_EXTRACTOR_GLOBAL_CONCURRENCY: ${ARTICLE_EXTRACTOR_GLOBAL_CONCURRENCY:-16}
      ARTICLE_EXTRACTOR_PER_HOST_CONCURRENCY: ${ARTICLE_EXTRACTOR_PER_HOST_CONCURRENCY:-1}
      ARTICLE_EXTRACTOR_FETCH_TIMEOUT_MS: ${ARTICLE_EXTRACTOR_FETCH_TIMEOUT_MS:-15000}
      ARTICLE_EXTRACTOR_FETCH_MAX_BYTES: ${ARTICLE_EXTRACTOR_FETCH_MAX_BYTES:-31457280}
      ARTICLE_EXTRACTOR_DOM_MAX_BYTES: ${ARTICLE_EXTRACTOR_DOM_MAX_BYTES:-6291456}
      ARTICLE_EXTRACTOR_CANDIDATE_MAX_BYTES: ${ARTICLE_EXTRACTOR_CANDIDATE_MAX_BYTES:-3145728}
      ARTICLE_EXTRACTOR_METADATA_MAX_BYTES: ${ARTICLE_EXTRACTOR_METADATA_MAX_BYTES:-262144}
    volumes:
      - ..:/app
      - go_mod_cache:/go/pkg/mod
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - kyomi-network
```

Add volume:

```yaml
  go_mod_cache:
    name: kyomi_go_mod_cache
```

- [ ] **Step 2: Add scripts**

In `package.json`, add:

```json
"dev:extractor": "cd services/article-extractor && go run ./cmd/extractor",
"fmt:extractor": "cd services/article-extractor && gofmt -w ."
```

- [ ] **Step 3: Write runbook**

Create `docs/runbooks/article-extraction-pipeline.md`:

```md
# Article Extraction Pipeline Runbook

## Purpose

Feed refresh discovers item URLs quickly. Article extraction runs separately and promotes a feed item to the main reader only after readable HTML/text is stored.

## Services

- `kyomi-worker`: feed refresh, OPML, full-text classification.
- `kyomi-scheduler`: feed refresh scheduling and article extraction retry/backfill scheduling.
- `kyomi-article-extractor`: Go service consuming `jobs:article-extraction`.

## Rollout

1. Deploy DB migration with `ARTICLE_EXTRACTION_PIPELINE_ENABLED=false`.
2. Start `kyomi-article-extractor`.
3. Set `ARTICLE_EXTRACTION_PIPELINE_ENABLED=true`.
4. Watch extraction logs and DB counts:

```sql
SELECT extraction_workflow_status, count(*)
FROM feed_items
GROUP BY extraction_workflow_status
ORDER BY count DESC;
```

5. Enable `ARTICLE_EXTRACTION_VISIBILITY_GATE_ENABLED=true` after ready latency and failure rates are acceptable.

## Rollback

1. Set `ARTICLE_EXTRACTION_VISIBILITY_GATE_ENABLED=false`.
2. Set `ARTICLE_EXTRACTION_PIPELINE_ENABLED=false`.
3. Stop `kyomi-article-extractor` if outbound fetch volume must stop.

No data rollback is required because `extracted_content_*` is additive.

## Failure States

- `retryable_failed`: transient network, timeout, or rate-limit. Scheduler retries after backoff.
- `paywalled`, `login_required`, `captcha`: access control page. Not visible in main reader while gate is enabled.
- `not_article`: readability could not find enough article text.
- `unsupported_content_type`: response was not HTML/XHTML/plain text.
- `too_large_no_candidate`: page exceeded streaming limits and no article-like container was found.
- `blocked`: outbound safety policy rejected the URL or redirect.
- `sanitization_failed`: extracted HTML could not be made safe.

## Large HTML Policy

The extractor does not reject large HTML immediately. It streams tokens, captures article-like containers (`article`, `main`, and positive `class`/`id` containers), preserves metadata, and then runs readability on the bounded candidate HTML. A hard fetch cap still protects memory and bandwidth.
```

- [ ] **Step 4: Run checks**

Run:

```bash
bun run test:extractor
docker compose --env-file docker/.env.example --env-file docker/.env --project-directory docker config >/tmp/kyomi-compose.yml
```

Expected: Go tests pass and compose config renders successfully.

- [ ] **Step 5: Commit**

```bash
but status
but commit enkang/extractor-docker-runbook -m "chore(extractor): add compose service and runbook"
```

## Task 13: Final Integration, Backfill, and Promotion Gate

**Files:**
- Create: `scripts/articles/enqueue-extraction-backfill.ts`
- Create: `tests/api/integration/scripts/article-extraction-backfill.test.ts`
- Modify: `docs/runbooks/article-extraction-pipeline.md`

**Interfaces:**
- Produces a controlled backfill script for existing `pending` rows.
- Produces final validation commands for promotion.

- [ ] **Step 1: Add backfill script test**

Create `tests/api/integration/scripts/article-extraction-backfill.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { buildArticleExtractionBackfillSql } from "../../../scripts/articles/enqueue-extraction-backfill";

describe("article extraction backfill script", () => {
  test("selects pending rows in deterministic order", () => {
    const sqlText = String(buildArticleExtractionBackfillSql(250).queryChunks.join(""));
    expect(sqlText).toContain("extraction_workflow_status = 'pending'");
    expect(sqlText).toContain("ORDER BY");
    expect(sqlText).toContain("LIMIT");
  });
});
```

- [ ] **Step 2: Create backfill script**

Create `scripts/articles/enqueue-extraction-backfill.ts`:

```ts
import { db } from "../../apps/api/src/adapters/db/client";
import { getRedis } from "../../apps/api/src/adapters/redis";
import { publishJob } from "../../apps/api/src/adapters/queue/publish-job";
import { feedItems } from "@kyomi/db";
import { eq, sql } from "drizzle-orm";

export function buildArticleExtractionBackfillSql(limit: number) {
  return sql<{
    feedItemId: string;
    feedId: string;
    url: string;
    canonicalUrl: string;
  }>`
    SELECT id AS "feedItemId", feed_id AS "feedId", link AS "url", canonical_url AS "canonicalUrl"
    FROM feed_items
    WHERE extraction_workflow_status = 'pending'
    ORDER BY published_at DESC, id DESC
    LIMIT ${Math.min(Math.max(limit, 1), 5000)}
  `;
}

const limitArg = Number(process.argv[2] ?? "500");
const limit = Number.isFinite(limitArg) ? limitArg : 500;
const rowsResult = await db.execute(buildArticleExtractionBackfillSql(limit));
const rows =
  Array.isArray(rowsResult) ? rowsResult : "rows" in rowsResult ? rowsResult.rows : [];
const redis = getRedis();

for (const row of rows) {
  await db
    .update(feedItems)
    .set({ extractionWorkflowStatus: "queued", extractionQueuedAt: new Date(), updatedAt: new Date() })
    .where(eq(feedItems.id, row.feedItemId));
  await publishJob(redis, {
    type: "article.extract",
    payload: {
      ...row,
      reason: "backfill",
    },
  });
}

console.log(JSON.stringify({ enqueued: rows.length }));
process.exit(0);
```

- [ ] **Step 3: Add package script**

In `package.json`, add:

```json
"articles:extract:backfill": "bunx --no-install dotenvx run -f docker/.env -f apps/api/.env -- bun scripts/articles/enqueue-extraction-backfill.ts"
```

- [ ] **Step 4: Add promotion checklist to runbook**

Append to `docs/runbooks/article-extraction-pipeline.md`:

```md
## Promotion Gate

Enable `ARTICLE_EXTRACTION_VISIBILITY_GATE_ENABLED=true` only after:

- Ready rate is at least 90% for subscribed-feed items from the last 24 hours.
- p95 ready latency is under 120 seconds for normal pages.
- `retryable_failed` queue is draining over time.
- `too_large_no_candidate` examples have been sampled and are not obviously valid articles.
- No sanitizer parity test fails.
- Direct article detail returns 404 for pending feed items only while the gate is enabled.
```

- [ ] **Step 5: Run final checks**

Run:

```bash
bun run --cwd tests test:api:integration tests/api/integration/scripts/article-extraction-backfill.test.ts
bun run --cwd tests test:api:integration tests/api/integration/modules/articles/read/extraction-visibility.test.ts
bun run --cwd tests test:api:integration tests/api/integration/modules/feeds/refresh/extraction-candidates.test.ts
bun run --cwd tests test:api:integration tests/api/integration/app/jobs/extraction-scheduler.test.ts
bun run test:extractor
SKIP_ENV_VALIDATION=true bun run typecheck:app
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
but status
but commit enkang/extraction-pipeline-backfill -m "feat(api): add article extraction backfill tooling"
```

## Plan Review Findings Applied

CEO review lens:
- The product outcome is not “backend in Go”; it is “reader items have dependable full extracted content.” This plan therefore uses Go only where it changes the throughput/memory/concurrency economics.
- The launch path is deliberately reversible: the pipeline can run and populate extracted content while the reader continues current visibility behavior.
- Failure states are product states, not just logs, so the system can later expose “blocked/paywalled/not article” views without changing ingestion history.

Engineering review lens:
- The schema separates workflow state from reader artifact status to avoid breaking existing DTO contracts.
- `SKIP LOCKED` remains in Postgres claim paths, and Redis Streams remain the delivery mechanism, preserving the existing concurrency model.
- Large HTML is handled with streaming token selection before DOM/readability parsing.
- The Go sanitizer is treated as a parity risk and gets fixtures from day one.
- Classification remains in TypeScript because the existing category/embedding pipeline already lives there.

Plan tuning lens:
- Defaults avoid asking for up-front choices: build the Go extractor behind a flag, do not gate visibility until metrics pass, and keep API rewrite out of scope.
- The only major operator decision is when to flip `ARTICLE_EXTRACTION_VISIBILITY_GATE_ENABLED`.

## Self-Review

Spec coverage:
- Staged ingestion: Tasks 1-6 and 13.
- Go extraction service: Tasks 7-12.
- Large HTML processing instead of immediate rejection: Task 9.
- Full-text classification: Task 4 and Task 11 publish/consume classification jobs.
- Scale controls: Tasks 5, 8, 9, 11, and 12.
- Visibility guarantee: Task 6 and the promotion gate in Task 13.

Placeholder scan:
- The plan has no `TBD` markers.
- The plan names concrete files, functions, env vars, statuses, commands, and expected results.

Type consistency:
- Queue payload names use `feedItemId`, `feedId`, `url`, `canonicalUrl`, and `reason` in TypeScript and Go.
- Reader artifact status remains `pending | ready | failed`; workflow status carries detailed states.
- Visibility SQL uses `extractionWorkflowStatus`, `extractedContentStatus`, and `extractedContentHtml`, matching Task 1 column names.
