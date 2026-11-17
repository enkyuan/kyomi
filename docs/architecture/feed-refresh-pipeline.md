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
- `jobs:<stream>:retry` (a sorted set beside each stream, for example `jobs:feed-refresh:retry`): failed jobs waiting out their retry delay.

## Retries

A job that fails with a retryable error is not put straight back on its stream, where it would hit the
same failing host or database again at once. The consumer parks it in the stream's retry set, scored
by the time it is due, and acknowledges the original entry in the same transaction, so the job is in
exactly one place at all times. Each consumer loop first runs one Lua script that moves every due
member onto the stream (`XADD`, then `ZREM`); because the move is a single script, consumers
promoting at the same moment never put a job on the stream twice. A retry is therefore delayed by up
to the stream's read block (2s) beyond its due time, and by longer while every consumer is busy.

The delay is a random share of a ceiling (full jitter): up to 5s for the first retry, doubling with
each one, never more than 5 minutes. With the default of 3 attempts a job is retried at most twice,
after up to 5s and then up to 10s; the 5-minute cap matters only if `maxAttempts` is raised. Full
jitter spreads jobs that failed together (one host down, one rate limit hit) over the whole window
instead of bringing them back as one burst, at the price that a single retry can come back at once.

`/queue/health` reports `scheduled`, the number of jobs in a stream's retry set. They are on neither
the stream nor pending, so without it a burst of failures would look like an empty queue. Entries sit in
Redis until some consumer promotes them, so they survive a worker restart. A retry's due time comes from
the clock of the host that scheduled it and is compared with the clock of the host that promotes it, so
keep worker clocks in sync (seconds of skew only shifts a delay of seconds).

The scheduler claims due feeds before enqueueing. Claims use row locks with `FOR UPDATE SKIP LOCKED`, so multiple scheduler processes should not duplicate work. The worker can be scaled independently because it no longer starts a scheduler loop.

## Backpressure

Scheduler backpressure is based on Postgres feed lifecycle state, not historical Redis stream length. It will not claim more due feeds once active `queued` rows reach `GLOBAL_FEED_REFRESH_MAX_QUEUED`.

Workers use:

- `JOB_STREAMS`
- `JOB_READ_COUNT`
- `JOB_PROCESS_CONCURRENCY`
- `JOB_STREAM_MAX_LENGTH`
- `SHUTDOWN_BUDGET_MS` (default 30000): the whole window a worker has to stop in. Compose sets the
  worker's `stop_grace_period` to 30s; keep the two in step. `app/jobs/shutdown.ts` spends the budget
  on draining running jobs, then a 2s settle for any job it has to interrupt, then a 5s reserve for
  closing Redis and Postgres. A job cut off at the end of the drain stays pending and is claimed
  again after the stream's pending-idle time.

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
