# @vols.rss/ingestion

Owns feed ingestion business logic.

Responsibilities:
- Fetch and parse feed documents.
- Normalize article identity and stored article content.
- Resolve and persist feed-level metadata used by refresh.
- Run feed refreshes against `@vols.rss/db`.
- Use `@vols.rss/sanitization` for HTML/content safety when needed.

Not responsibilities:
- HTTP routes, auth, request DTOs, or user context.
- Redis stream consumption or job dispatch loops.
- UI cache or browser rendering behavior.

Public API is exported through `src/index.ts`. Callers should not import
`@vols.rss/ingestion/src/...` internals.

