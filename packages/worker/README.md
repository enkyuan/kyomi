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
  sanitization/            # DOMPurify article HTML policy
```

## Exports

| Import | Use |
|--------|-----|
| `@kyomi/worker` | Queue + `runFeedRefresh`, `parseFeedDocument`, `decodeHtmlEntities`, `normalizeArticleUrl` |
| `@kyomi/worker/queue` | Job stream types and `consumeJobs` |
| `@kyomi/worker/ingestion` | Feed refresh + parsing (legacy path name) |
| `@kyomi/worker/sanitization` | Article HTML DOMPurify config and hooks |
| `@kyomi/worker/favicon` | Server-side favicon fetch and resolution |
| `@kyomi/worker/favicon/browser` | `buildClientFaviconUrl` for web UI |
| `@kyomi/worker/lib/html-entities` | `decodeHtmlEntities` only |
| `@kyomi/worker/lib/article-identity` | URL normalization helpers |

API adapters publish typed jobs; the worker process executes `runFeedRefresh` via `consumeJobs`.
