# @kyomi/worker

Queue contracts, feed refresh/ingestion, and shared article HTML sanitization.

## Layout

```
src/
  index.ts                 # public barrel
  services/
    queue/                 # Redis stream jobs
    feed/                  # fetch, parse, enrich, refresh
    favicon/               # SSRF-safe favicon resolution + browser proxy URL
  lib/                     # article identity, html entities, feed helpers
  sanitization/            # neosanitize article HTML policy
```

## Exports

| Import | Use |
|--------|-----|
| `@kyomi/worker` | Queue + feed refresh, parsing, host limiting, `decodeHtmlEntities`, `normalizeArticleUrl` |
| `@kyomi/worker/queue` | Job stream types and `consumeJobs` |
| `@kyomi/worker/ingestion` | Feed refresh + parsing (legacy path name) |
| `@kyomi/worker/sanitization` | Browser-safe shared article HTML policy and sanitizer |
| `@kyomi/worker/favicon` | Server-side favicon fetch and resolution |
| `@kyomi/worker/favicon/browser` | `buildClientFaviconUrl` for web UI |
| `@kyomi/worker/lib/html-entities` | `decodeHtmlEntities` only |
| `@kyomi/worker/lib/article-identity` | URL normalization helpers |

API adapters publish typed jobs. `apps/api` owns the executable scheduler and worker process boots:

- `bun run --cwd apps/api scheduler` claims due feeds and publishes refresh jobs.
- `bun run --cwd apps/api worker` consumes Redis Streams and executes `runFeedRefresh` or OPML jobs.

Refresh and OPML jobs use separate streams so imports cannot starve scheduled refreshes.

The `@kyomi/worker/sanitization` subpath is intentionally browser-safe. It owns the shared
article HTML `neosanitize` policy used by the API and `@kyomi/reader/web`; do not import queue,
database, Redis, JSDOM, or other Node-only modules from that subpath.
