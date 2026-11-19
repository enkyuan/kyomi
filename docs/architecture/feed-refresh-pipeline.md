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

A feed worker reads at most the number of free handler slots and starts the next Redis read when any handler finishes. A slow publisher consumes one slot. The blocking read connection is separate from acknowledgements. Jobs already delivered can drain on shutdown and an interrupted job remains pending for lease recovery. Other streams keep their batch policy. [Redis XREADGROUP](https://redis.io/docs/latest/commands/xreadgroup/) · [Effect 4.1.4 scoped fiber sets](https://unpkg.com/effect@4.1.4/src/FiberSet.ts)

Subscribed refreshes can prefetch extraction for up to five eligible articles. Unsubscribed catalog polls store a bounded preview. Full-text prefetch, image measurements and embed snapshots start with the full subscription refresh. Catalog previews still include the compiled reader document and publisher image URLs.

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

## Catalog previews and subscription hydration

The subscribed and catalog lanes poll on separate clocks. Their default intervals are one hour and one day. A trigger maintains the number of subscriptions for each feed. The scheduler locks admission for one short transaction, recovers expired leases, counts queued rows, and spends one remaining queue budget across both lanes. The due-time indexes order never-checked feeds first. A bounded final join updates the claimed primary keys. Redis consumer names include a per-process UUID so replicas can share a consumer group. [PostgreSQL row locking](https://www.postgresql.org/docs/18/sql-select.html#SQL-FOR-UPDATE-SHARE) · [Expression indexes](https://www.postgresql.org/docs/18/indexes-expressional.html) · [Redis consumer groups](https://redis.io/docs/latest/commands/xreadgroup/)

An unsubscribed catalog refresh records the result of checking the feed, its metadata and HTTP validators. For a changed feed, it selects up to three of the newest entries published within seven days before compiling their bodies. Entries with no usable publication date use observation time. A valid feed with zero recent items can have a successful refresh and an empty preview. An HTTP 304 counts as success for a conditional request. Rate-limited publishers receive a later poll, honoring a longer Retry-After within the implementation's 30-day ceiling. [HTTP conditional requests](https://www.rfc-editor.org/rfc/rfc9110.html#section-13) · [Retry-After](https://www.rfc-editor.org/rfc/rfc9110.html#section-10.2.3)

For a never-successful catalog feed returning 404 or 410, Kyomi can check the catalogued homepage for a replacement. The original URL must be a conventional feed endpoint under that homepage. The alternate must stay on the origin and declare the same homepage and title. Category-specific paths, mismatched publications and access challenges retain their failure status. [HTML feed autodiscovery](https://html.spec.whatwg.org/multipage/links.html#rel-alternate)

Only rows newly inserted as catalog previews acquire an expiration. The worker marks surplus preview rows for expiry and the scheduler sweeps up to 500 at a time. It waits five seconds after a full batch and one minute after a partial or empty sweep. At 500,000 daily polls, replacing all three previews per feed could expire 1.5 million rows a day, so the sweep continues promptly while a backlog exists. The sweep locks the feed and item, then preserves articles with a subscription, reading progress, user state, report or view event. Earlier full-history rows keep their original retention. The first subscription promotes previews and makes the feed due. Its next full fetch omits the preview validators so the publisher can return older entries even when the feed is unchanged. A subscription arriving during a preview fetch also makes the next poll due. Publisher history available at hydration is limited by the publisher's feed window. Miniflux similarly makes polling and archival independently configurable. [Miniflux configuration](https://miniflux.app/docs/configuration.html)

## Reader recovery

Feed ingestion accepts RSS descriptions and content:encoded, RSS 1.0 RDF items outside the channel, JSON Feed HTML and text, and Atom text constructs including nested XHTML. An Atom entry with external content or a non-text payload can supply an inline summary. The body path retains mixed XHTML child order and passes it through the existing sanitizer. If markup exceeds 256 KiB, the parser can retain complete bounded plain text after stripping markup, scripts and styles. This projection precedes the publisher summary. During replay, an existing excerpt is replaced when its raw bytes match an alternate supplied by the feed and the recovered text is longer. Full-page extraction uses a validated publisher article URL and the shared host limiter. [Atom text and content constructs](https://www.rfc-editor.org/rfc/rfc4287.html#section-4.1.3) · [RSS content module](https://web.resource.org/rss/1.0/modules/content/) · [JSON Feed 1.1](https://www.jsonfeed.org/version/1.1/)

Use `bun run --cwd apps/api content:recover --batch-size 200` to inspect eligible items. Add `--apply` to enqueue one batch of the oldest never-requested link-only articles. Repeating the command advances through the backlog. Existing preview rows expire on the catalog policy and are excluded from this historical batch. The refresh completion log includes feed-supplied body count. Article extraction logs record publisher recovery. On instrumented web clients, `kyomi_reader_body_visible` records visible body text by source, mode and body kind. It counts displays, including summary fallbacks, and carries no article content or identifiers.

## Capacity and SQL measurement

Run `bun run --cwd apps/api feed:freshness` to read distinct successful feeds over 24 hours, lifetime successes, the oldest queue and overdue ages, and latest publisher 429s by lane. Queue jobs and feed items are separate units. A target of 500,000 distinct daily successes needs 5.79 successes per second sustained. At an 80% per-attempt success rate it needs at least 7.24 attempts per second before hourly subscription rechecks, retries and duplicate checks. Use the observed latency and success distribution to size worker concurrency. Keep the sum of replica pool sizes within the PostgreSQL connection budget and retain per-host admission as replicas are added. A single busy publisher, failed DNS or a publisher rate limit can dominate a batch. [Miniflux polling configuration](https://miniflux.app/docs/configuration.html) · [Redis stream monitoring](https://redis.io/docs/latest/commands/xinfo-groups/)

Compose preloads pg_stat_statements. Enable the extension in the target database and compare counter deltas over the same workload. The query below reports normalized query IDs and costs without statement text. Capture calls, total time and buffer reads before and after a change. Inspect the selected statement with EXPLAIN (ANALYZE, BUFFERS). Enclose write probes in a transaction and roll them back. [pg_stat_statements](https://www.postgresql.org/docs/18/pgstatstatements.html) · [Using EXPLAIN](https://www.postgresql.org/docs/18/using-explain.html)

```sql
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
SELECT queryid, calls, total_exec_time, mean_exec_time, shared_blks_read, temp_blks_written
FROM pg_stat_statements
WHERE dbid = (SELECT oid FROM pg_database WHERE datname = current_database())
ORDER BY total_exec_time DESC
LIMIT 30;
```

The local workload exposed scans of both category-assignment tables during article detail reads and category refreshes. Indexes on the owner and provenance support those queries across all model IDs. The existing partial unique indexes still enforce deduplication for each model. Title and URL substring searches use trigram indexes. Concurrent refreshes also contended on the same canonical category rows. The dictionary now reuses matching IDs under a shared key lock and upserts only missing labels or provenance changes. Check ranking, membership filters and pagination with representative queries because each can change the chosen plan. [PostgreSQL row-level locks](https://www.postgresql.org/docs/18/explicit-locking.html#LOCKING-ROWS) · [PostgreSQL partial indexes](https://www.postgresql.org/docs/18/indexes-partial.html) · [pg_trgm indexes](https://www.postgresql.org/docs/18/pgtrgm.html#PGTRGM-INDEX)

## Private Garage image cache

Configure a private Garage bucket and a bucket-scoped read/write key. Supply GARAGE_S3_ENDPOINT, GARAGE_S3_BUCKET, GARAGE_S3_ACCESS_KEY and GARAGE_S3_SECRET_KEY to the API using the normal encrypted environment. The local Compose endpoint is http://garage:3900 inside the network and http://127.0.0.1:3900 on the host. The S3 client uses path-style requests and the garage region. The existing image handlers validate destinations and bound upstream reads. Browser and mobile readers request images through the API. Favicons are capped at 64 KiB and reader images at 8 MiB. Source hashes and expiration live in PostgreSQL. Garage stores private objects under sha256/ keyed by their byte digest. Reads check the size and digest. Storage errors fall back to fetching from the publisher. [Bun S3](https://bun.com/docs/runtime/s3) · [Garage S3 compatibility](https://garagehq.deuxfleurs.fr/documentation/reference-manual/s3-compatibility/)

Set an object and byte quota when provisioning the bucket. Apply an S3 lifecycle expiration rule to the sha256/ prefix. The local policy is nine days, beyond the maximum seven-day favicon or one-day reader-image freshness. The scheduler removes expired SQL mappings in batches. Origin directives and object age can shorten the cache lifetime. Private, no-store, no-cache, cookie-bearing and unsupported Vary responses bypass storage. The proxy serves bounded image bytes with its sandbox and nosniff headers. [Garage bucket management](https://garagehq.deuxfleurs.fr/documentation/reference-manual/garage-cli/) · [HTTP caching](https://www.rfc-editor.org/rfc/rfc9111.html)

```json
{"Rules":[{"ID":"expire-reader-cache","Status":"Enabled","Filter":{"Prefix":"sha256/"},"Expiration":{"Days":9}}]}
```


## Local verification, 2026-11-19

- Replayed the affected feeds against the local PostgreSQL data and passed their saved bodies to the web reader. All 27 confirmed Atom XHTML losses displayed text. All 54 matched entries from the source-content audit displayed text or a media link after the parser and link-preview repairs. Three oversized RSS bodies produced 30,170, 39,921 and 41,706 visible characters after replay, matching the independent feed-text counts. These are targeted regression cohorts.
- The full-retention pilot added about 29 MB for 90 newly successful feeds. A later bounded-preview interval added 43,483,136 PostgreSQL bytes for 2,175 additional distinct successes, including concurrent article extraction. These are whole-database size deltas. Wall-clock workload and publisher mix affect the result.
- At 167,465 feeds the old claim plan scanned the feed table and took 464 ms. A 64-feed claim using bounded primary-key lookups took 16.2 ms with writes. Three concurrent claimers on an isolated 500,001-row fixture admitted 19 distinct feeds against a shared budget of 19 in 212 ms including connection setup. This test exercised PostgreSQL scheduling. Sustained coverage requires successful network polls over a full freshness window.
- With a 56-slot local feed configuration, twelve samples of running database rows had medians of 15 before slot refilling and 51 afterward. Two post-warmup intervals gained 1,177 distinct successful feeds in 66 seconds. Publisher mix and network conditions vary over time.
- Garage v2.2.0 served the same 4,846 bytes on both requests to the reader-image handler. The favicon handler also returned 200. Replay used Bun 1.3.14, fast-xml-parser 5.11.0 and PostgreSQL 18.6.
