# @kyomi/ingest

queue contracts, feed ingestion, favicon resolution, and the ingest-time article compiler. consumed by background jobs and both apps.

## layout

```text
src/
  services/
    queue/    Redis Stream job contracts and consumers.
    feed/     feed fetch, parse, enrich, and refresh.
    favicon/  SSRF-safe favicon resolution and browser proxy URLs.
  document/      ingest-time article compiler and its passes (Node-only, linkedom).
  enrichment/    pure helpers for the document-enrichment jobs: image size, thumbhash, embed snapshots.
  lib/           article identity, HTML entities, and feed helpers.
```

## exports

| import                               | purpose                                                                                          |
| ------------------------------------ | ------------------------------------------------------------------------------------------------ |
| `@kyomi/ingest`                      | queue, feed, favicon, and helpers.                                                 |
| `@kyomi/ingest/queue`                | job stream types and consumers.                                                                  |
| `@kyomi/ingest/ingestion`            | feed refresh and parsing.                                                                        |
| `@kyomi/ingest/document`             | `compileArticleDocument` (HTML plus KDM), `compileArticleHtml`, and the ordered compiler passes. |
| `@kyomi/ingest/enrichment`           | KDM image-measure and embed-snapshot helpers (Node).                                             |
| `@kyomi/ingest/favicon`              | server-side favicon fetch and resolution.                                                        |
| `@kyomi/ingest/favicon/browser`      | client favicon proxy URL builder.                                                                |
| `@kyomi/ingest/lib/article-identity` | article URL identity helpers.                                                                    |
| `@kyomi/ingest/lib/html-entities`    | HTML entity decoding.                                                                            |
| `@kyomi/ingest/lib/feed-text`        | the parser's text and URL helpers (`absoluteHttpUrl`), for scripts that must match the parser.   |

## commands

| command                                   | purpose           |
| ----------------------------------------- | ----------------- |
| `bun run --cwd packages/ingest typecheck` | type-check.       |
| `bun run --cwd packages/ingest lint`      | lint.             |
| `bun run --cwd packages/ingest fmt:check` | check formatting. |

## notes

- `apps/api` owns the executable `worker` and `scheduler` processes.
- refresh and OPML jobs use separate streams so imports don't starve scheduled refreshes.
- Article HTML policy and sanitizer live in `@kyomi/reader/sanitization` (browser-safe); `document` imports
  it plus the KDM schema from `@kyomi/reader/document`. Reader never imports ingest.
- `document` runs once at ingest. Read paths re-apply only the `@kyomi/reader/sanitization` policy, because the
  compiler's first pass strips `data-kyomi-*` hints it did not write itself.
