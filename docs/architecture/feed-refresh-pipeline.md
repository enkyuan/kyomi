# Feed Refresh Pipeline

## Current Roles

- API: serves product HTTP routes and publishes user-triggered jobs.
- Scheduler: atomically claims due feeds in Postgres and publishes refresh jobs.
- Worker: consumes refresh and OPML jobs from Redis Streams.
- Postgres: owns feed refresh lifecycle state.
- Redis: buffers durable background jobs.

## Queues

- `jobs:feed-refresh`: feed refresh jobs.
- `jobs:opml`: OPML import and OPML feed import jobs.
- `jobs:dead-letter`: exhausted or malformed jobs.

The scheduler claims due feeds before enqueueing. Claims use row locks with `FOR UPDATE SKIP LOCKED`, so multiple scheduler processes should not duplicate work. The worker can be scaled independently because it no longer starts a scheduler loop.

## Backpressure

Scheduler backpressure is based on Postgres feed lifecycle state, not historical Redis stream length. It will not claim more due feeds once active `queued` rows reach `GLOBAL_FEED_REFRESH_MAX_QUEUED`.

Workers use:

- `JOB_STREAMS`
- `JOB_READ_COUNT`
- `JOB_PROCESS_CONCURRENCY`
- `JOB_STREAM_MAX_LENGTH`

Scheduled system refreshes skip article enrichment by default. User-triggered refreshes can still enrich articles.

## Scale Math

- 500K hourly feeds require about 139 refreshes/sec.
- 1M hourly feeds require about 278 refreshes/sec.
- 1M daily feeds require about 11.6 refreshes/sec.

Required worker concurrency is roughly:

```text
target_refreshes_per_second * p95_refresh_seconds
```

The checked-in defaults are local-development defaults, not production sizing.

## Rollout

1. Create the scale indexes before raising scheduler throughput.
2. For large production tables, create indexes with `CREATE INDEX CONCURRENTLY`.
3. Deploy API and worker code.
4. Start one scheduler process.
5. Watch `/queue/health` or `/api/queue/health`, DB pool usage, feed error classes, and p95 refresh duration.
6. Increase `SUBSCRIBED_FEED_REFRESH_BATCH_SIZE`, `GLOBAL_FEED_REFRESH_BATCH_SIZE`, and worker replicas only after measuring.

## Rollback

1. Stop the scheduler first.
2. Let workers drain queued work or lower worker replicas.
3. Roll back code.
4. Leave indexes in place unless there is a proven write-path regression.
