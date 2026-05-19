# @vols.rss/worker

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
| `@vols.rss/worker` | Queue + `runFeedRefresh`, `parseFeedDocument`, `decodeHtmlEntities`, `normalizeArticleUrl` |
| `@vols.rss/worker/queue` | Job stream types and `consumeJobs` |
| `@vols.rss/worker/ingestion` | Feed refresh + parsing (legacy path name) |
| `@vols.rss/worker/sanitization` | Article HTML DOMPurify config and hooks |
| `@vols.rss/worker/favicon` | Server-side favicon fetch and resolution |
| `@vols.rss/worker/favicon/browser` | `buildClientFaviconUrl` for web UI |
| `@vols.rss/worker/lib/html-entities` | `decodeHtmlEntities` only |
| `@vols.rss/worker/lib/article-identity` | URL normalization helpers |

API adapters publish typed jobs; the worker process executes `runFeedRefresh` via `consumeJobs`.
