# API Boundary Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove misleading article API surfaces, align article/date behavior with the web client, and tighten API module boundaries without changing shipped reader behavior.

**Architecture:** Keep the existing `apps/api/src/modules/*` shape and make small, behavior-preserving moves toward shared helpers. Public route composition stays thin; generic network and codec behavior moves to shared/focused utility modules; module parent barrels remain public-only surfaces.

**Tech Stack:** Bun test runner for API integration tests, Vitest for web integration tests, Elysia route registration, Drizzle query helpers, TypeScript path aliases from `apps/api/tsconfig.json` and `tests/api/tsconfig.json`.

## Global Constraints

- Do not modify user work already present in the worktree: `apps/web/src/modules/inbox/components/recap/sections/top-sources.tsx` and `docs/superpowers/plans/2026-07-01-platform-expansion-roadmap.md`.
- Keep normal app runtime/setup independent from Poetry and catalog sync.
- Prefer `bunx` over `npx` for one-off tooling.
- Keep `apps/api/src/modules/feeds/routes.ts` and `apps/api/src/modules/articles/routes.ts` as thin route composition files.
- Do not reintroduce feeds -> inbox -> sidebar style barrel cycles; import concrete owner files inside API modules.
- Preserve API UTC instant semantics; day-scoped article filters must use explicit client-provided bounds, not server-local or UTC midnight defaults.
- Use shared URL/network helpers from `apps/api/src/shared/net` for non-feed-specific URL validation and remote document fetching.

---

## What Already Exists

- `apps/web/src/modules/inbox/services/query-urls.ts` already maps legacy `today`, `unread`, and `inbox` filters to `my-feed`, so the web no longer needs `/api/v1/articles/views/today`.
- `apps/api/src/shared/net/http-url.ts` already provides generic `assertHttpOrHttpsUrl`.
- `apps/api/src/shared/net/safe-fetch.ts` already enforces outbound URL policy, redirect safety, and byte-limited response reads.
- `apps/api/src/modules/articles/read/merged-view-cursor.ts` has a good merged cursor contract, but its base64url JSON helpers are duplicated elsewhere.
- `apps/api/src/modules/articles/read/list.ts`, `apps/api/src/modules/articles/read/views-merged.ts`, and `apps/api/src/modules/articles/write/clips.ts` all implement the same SQL LIKE escaping.
- `apps/api/src/modules/feeds/service.ts` is already documented as a public service surface; the cleanup is to stop importing that public barrel from feed internals.

## NOT In Scope

- Real summarize/translate implementation with an LLM provider, prompts, evals, quotas, streaming, or persistence. The current work removes misleading live stubs only.
- Web UI for summarize/translate. The web already treats these capabilities as coming soon.
- Repo-wide filename convention cleanup for unrelated boot and script files: `register-error-handlers.ts`, `register-global-middleware.ts`, `api-v1-router.ts`, `listen-with-retry.ts`, `feed-refresh-errors.ts`, `startup-schema-guard.ts`, `import-catalog-feeds.ts`, and `smoke-discover-catalog.ts`. This branch renames the article files it already touches and leaves the unrelated rename sweep for a separate mechanical PR.
- Database migrations. No schema change is needed.
- Catalog package changes. Catalog sync remains optional offline enrichment.

## Data Flow

```text
Article route registration
  registerArticleRoutes()
    |
    +-- read/routes.ts
    |     +-- list views: all, recently-read, read-later
    |     +-- counts with explicit published_after/published_before only
    |
    +-- reader/routes.ts
    |     +-- extract-full-text only
    |
    +-- write/routes.ts

Remote document fetching
  discover/feed/fetch.ts       opml/fetch-url.ts
          |                           |
          +-----------+---------------+
                      |
             shared/net/remote-document.ts
                      |
             shared/net/safe-fetch.ts
```

## File Structure Map

- Create `apps/api/src/shared/net/remote-document.ts`: generic remote document fetcher built on `safe-fetch`.
- Create `apps/api/src/modules/articles/read/cursor-codec.ts`: base64url JSON cursor encode/decode helpers for article read modules.
- Create `apps/api/src/modules/articles/search-filter.ts`: SQL LIKE escaping and search pattern normalization shared by article read/write code.
- Create `apps/api/src/modules/articles/read/merged-cursor.ts`: renamed replacement for `merged-view-cursor.ts`.
- Create `apps/api/src/modules/articles/reader/extract-url.ts`: URL extraction helper previously parked in `enrichment.ts`.
- Rename `apps/api/src/modules/articles/reader/extract-full-text.ts` to `apps/api/src/modules/articles/reader/full-text.ts`.
- Delete `apps/api/src/modules/articles/reader/enrichment.ts`: placeholder summarize/translate logic goes away.
- Delete `apps/api/src/modules/articles/read/merged-view-cursor.ts` after `merged-cursor.ts` is in place.
- Modify route/tests under `apps/api/src/modules/articles/**` and `tests/api/integration/modules/articles/**`.
- Modify `apps/api/src/modules/opml/fetch-url.ts` and add shared-net tests so OPML no longer imports discover/feed internals.
- Modify feed internal imports in `apps/api/src/modules/feeds/read/status.ts`, `apps/api/src/modules/feeds/refresh/routes.ts`, and `apps/api/src/modules/feeds/subscription/routes.ts`.

---

### Task 1: Remove Live Summarize/Translate Stubs

**Files:**
- Create: `apps/api/src/modules/articles/reader/extract-url.ts`
- Modify: `apps/api/src/modules/articles/reader/routes.ts`
- Modify: `apps/api/src/modules/articles/schemas.ts`
- Modify: `apps/api/src/modules/articles/write/clips.ts`
- Modify: `tests/api/integration/modules/articles/routes.test.ts`
- Delete: `apps/api/src/modules/articles/reader/enrichment.ts`
- Delete: `tests/api/integration/modules/articles/reader/enrichment.test.ts`

**Interfaces:**
- Consumes: `extractArticleContentFromUrl(url: string)` from `apps/api/src/modules/articles/reader/extract-content.ts`.
- Produces: `extractFullTextFromUrl(url: string): Promise<string>` from `apps/api/src/modules/articles/reader/extract-url.ts`.
- Removes: public `POST /articles/:articleId/summarize` and `POST /articles/:articleId/translate` route registration.

- [ ] **Step 1: Write the route regression test first**

Update `tests/api/integration/modules/articles/routes.test.ts` so the expected route list no longer includes summarize/translate:

```ts
expect(routes.map((route) => `${route.method} ${route.path}`)).toEqual([
  "get /articles/views/all",
  "get /articles/views/today",
  "get /articles/views/recently-read",
  "get /articles/views/read-later",
  "get /articles/counts",
  "get /articles/unread-counts",
  "get /articles/check-saved",
  "get /articles/saved",
  "get /articles",
  "get /articles/clips",
  "get /articles/write/clips",
  "get /articles/:articleId",
  "post /articles/:articleId/extract-full-text",
  "post /articles",
  "post /articles/:articleId/view",
  "post /articles/:articleId/reports/broken",
  "put /articles/:articleId",
]);
```

Replace the enrichment schema test with extract-only assertions:

```ts
test("exposes validation/response schemas for extract-full-text only", () => {
  const { app, routes } = createRouteRecorder();
  registerArticleRoutes(app as never);

  const extract = routes.find((r) => r.path.endsWith("/extract-full-text"));
  const summarize = routes.find((r) => r.path.endsWith("/summarize"));
  const translate = routes.find((r) => r.path.endsWith("/translate"));

  expect(extract).toBeDefined();
  expect(summarize).toBeUndefined();
  expect(translate).toBeUndefined();
  expect((extract?.options as Record<string, unknown>).params).toBeDefined();
  expect((extract?.options as Record<string, unknown>).response).toBeDefined();
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `bun run --cwd tests test:api:integration ../../tests/api/integration/modules/articles/routes.test.ts`

Expected: FAIL because `routes.ts` still registers summarize/translate.

- [ ] **Step 3: Move the URL extraction helper out of enrichment**

Create `apps/api/src/modules/articles/reader/extract-url.ts`:

```ts
import { AppError } from "@shared/errors/app";
import { extractArticleContentFromUrl } from "./extract-content";

export async function extractFullTextFromUrl(url: string): Promise<string> {
  const extracted = await extractArticleContentFromUrl(url);
  if (!extracted.ok) {
    throw new AppError(extracted.errorMessage, {
      status: 400,
      code: extracted.errorCode,
    });
  }

  if (!extracted.content.contentHtml) {
    throw new AppError("No readable HTML content was extracted.", {
      status: 400,
      code: "EXTRACTION_EMPTY",
    });
  }

  return extracted.content.contentHtml;
}
```

In `apps/api/src/modules/articles/write/clips.ts`, change:

```ts
import { extractFullTextFromUrl } from "../reader/enrichment";
```

to:

```ts
import { extractFullTextFromUrl } from "../reader/extract-url";
```

- [ ] **Step 4: Remove summarize/translate route registration**

In `apps/api/src/modules/articles/reader/routes.ts`, keep only `extract-full-text`. The import block should become:

```ts
import type { Elysia } from "elysia";
import { v1HandlerContext } from "@shared/http/v1/context";
import { extractFullTextForUser } from "./extract-full-text";
import { articleIdParamsSchema, extractFullTextResponseSchema } from "../schemas";
```

The exported function should end after the extract route:

```ts
export function registerArticleEnrichmentRoutes(app: Elysia) {
  return app.post(
    "/articles/:articleId/extract-full-text",
    async (context) => {
      const { db, logger, params, userId } = v1HandlerContext(context);
      const result = await extractFullTextForUser(db, userId, params.articleId);
      if (result.ok) {
        logger.info("articles.extract_full_text.succeeded", {
          userId,
          articleId: params.articleId,
        });
      } else {
        logger.warn("articles.extract_full_text.failed", {
          userId,
          articleId: params.articleId,
          errorCode: result.errorCode,
        });
      }
      return result;
    },
    {
      params: articleIdParamsSchema,
      response: { 200: extractFullTextResponseSchema },
    },
  );
}
```

- [ ] **Step 5: Remove unused summarize/translate schemas**

Delete these exports from `apps/api/src/modules/articles/schemas.ts`:

```ts
export const summarizeBodySchema = t.Object({
  content: t.Optional(t.String()),
  language_key: t.Optional(t.String()),
});

export const summarizeResponseSchema = t.Object({
  summary: t.String(),
});

export const translateBodySchema = t.Object({
  content: t.Optional(t.String()),
  target_language: t.String({ minLength: 1 }),
});

export const translateResponseSchema = t.Object({
  translated_content: t.String(),
  target_language: t.String(),
});
```

- [ ] **Step 6: Delete the placeholder implementation and tests**

Run: `git rm apps/api/src/modules/articles/reader/enrichment.ts tests/api/integration/modules/articles/reader/enrichment.test.ts`

Expected: both files are staged for deletion. Do not stage unrelated work.

- [ ] **Step 7: Run focused API tests**

Run:

```bash
bun run --cwd tests test:api:integration ../../tests/api/integration/modules/articles/routes.test.ts ../../tests/api/integration/modules/articles/write/clips.test.ts
```

Expected: PASS.

- [ ] **Step 8: Typecheck the API**

Run: `bun run --cwd apps/api typecheck`

Expected: PASS with no remaining references to summarize/translate schemas or `reader/enrichment`.

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/modules/articles/reader/routes.ts apps/api/src/modules/articles/reader/extract-url.ts apps/api/src/modules/articles/schemas.ts apps/api/src/modules/articles/write/clips.ts tests/api/integration/modules/articles/routes.test.ts
git add -u apps/api/src/modules/articles/reader/enrichment.ts tests/api/integration/modules/articles/reader/enrichment.test.ts
git commit -m "fix(api): remove placeholder article enrichment routes"
```

---

### Task 2: Remove Stale `/articles/views/today`

**Files:**
- Modify: `apps/api/src/modules/articles/read/routes.ts`
- Modify: `apps/api/src/modules/articles/read/views-merged.ts`
- Modify: `tests/api/integration/modules/articles/routes.test.ts`
- Modify: `tests/web/integration/modules/inbox/query-urls.test.ts`

**Interfaces:**
- Removes: `listMergedTodayView(database, userId, limit, cursor?, sort?)`.
- Keeps: client-timezone "today" counts via explicit `published_after` and `published_before` on `/articles/counts`.
- Keeps: web legacy filter normalization to `/api/v1/articles?limit=100`.

- [ ] **Step 1: Tighten API route expectations first**

In `tests/api/integration/modules/articles/routes.test.ts`, remove this line from the route list:

```ts
"get /articles/views/today",
```

Add an explicit absence assertion after the route list:

```ts
expect(routes.find((route) => route.path === "/articles/views/today")).toBeUndefined();
```

- [ ] **Step 2: Add a web regression assertion**

In `tests/web/integration/modules/inbox/query-urls.test.ts`, add this assertion to the existing `"maps removed Today and Unread filters to My Feed"` test:

```ts
expect(
  buildInboxListUrl({
    filter: "today",
    timezoneOffsetMinutes: -840,
    includeRead: false,
    search: "edge",
    cursor: undefined,
    sort: undefined,
  }),
).toBe("/api/v1/articles?limit=100&search=edge");
```

- [ ] **Step 3: Run focused tests and verify the API test fails**

Run:

```bash
bun run --cwd tests test:api:integration ../../tests/api/integration/modules/articles/routes.test.ts
bun run --cwd tests test:web:integration web/integration/modules/inbox/query-urls.test.ts
```

Expected: API test FAILS because the route still exists; web test PASSES because the client already avoids the stale route.

- [ ] **Step 4: Remove the route and import**

In `apps/api/src/modules/articles/read/routes.ts`, remove `listMergedTodayView` from the import:

```ts
import { listMergedRecentlyReadView, listMergedSavedView } from "./views-merged";
```

Delete the whole `.get("/articles/views/today", ...)` block.

- [ ] **Step 5: Remove UTC-midnight today implementation**

In `apps/api/src/modules/articles/read/views-merged.ts`, delete `utcDayRange()` and delete the full `listMergedTodayView` export. The first exported view in the file should now be `listMergedRecentlyReadView`.

- [ ] **Step 6: Run focused tests**

Run:

```bash
bun run --cwd tests test:api:integration ../../tests/api/integration/modules/articles/routes.test.ts ../../tests/api/integration/modules/articles/read/views-merged.test.ts
bun run --cwd tests test:web:integration web/integration/modules/inbox/query-urls.test.ts
```

Expected: PASS.

- [ ] **Step 7: Typecheck**

Run: `bun run --cwd apps/api typecheck`

Expected: PASS with no references to `listMergedTodayView`.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/modules/articles/read/routes.ts apps/api/src/modules/articles/read/views-merged.ts tests/api/integration/modules/articles/routes.test.ts tests/web/integration/modules/inbox/query-urls.test.ts
git commit -m "fix(api): remove stale today article view"
```

---

### Task 3: Deduplicate Article Cursor and Search Helpers

**Files:**
- Create: `apps/api/src/modules/articles/read/cursor-codec.ts`
- Create: `apps/api/src/modules/articles/search-filter.ts`
- Create: `apps/api/src/modules/articles/read/merged-cursor.ts`
- Modify: `apps/api/src/modules/articles/read/list.ts`
- Modify: `apps/api/src/modules/articles/read/views-merged.ts`
- Modify: `apps/api/src/modules/articles/read/merge.ts`
- Modify: `apps/api/src/modules/articles/write/clips.ts`
- Modify: `tests/api/integration/modules/articles/read/merged-view-cursor.test.ts` then rename it to `tests/api/integration/modules/articles/read/merged-cursor.test.ts`
- Create: `tests/api/integration/modules/articles/read/cursor-codec.test.ts`
- Create: `tests/api/integration/modules/articles/search-filter.test.ts`
- Delete: `apps/api/src/modules/articles/read/merged-view-cursor.ts`

**Interfaces:**
- Produces `encodeCursorPayload(prefix: string, payload: unknown): string`.
- Produces `decodeCursorPayload<T>(prefix: string, cursor: string, onInvalid: () => never): T`.
- Produces `escapeLikePattern(input: string): string`.
- Produces `searchPattern(search: string | undefined): string | undefined`.
- Replaces `merged-view-cursor.ts` with `merged-cursor.ts` while preserving `encodeMergedListCursorFromItem(item, sort)` and `decodeMergedListCursor(cursor)`.

- [ ] **Step 1: Add failing helper tests**

Create `tests/api/integration/modules/articles/read/cursor-codec.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { decodeCursorPayload, encodeCursorPayload } from "@modules/articles/read/cursor-codec";

describe("article cursor codec", () => {
  test("round-trips base64url JSON payloads with a prefix", () => {
    const encoded = encodeCursorPayload("x1.", { v: 1, id: "item_1" });
    expect(encoded.startsWith("x1.")).toBe(true);
    expect(decodeCursorPayload<{ v: number; id: string }>("x1.", encoded, () => {
      throw new Error("invalid");
    })).toEqual({ v: 1, id: "item_1" });
  });

  test("uses the caller invalid handler for bad prefixes and bad JSON", () => {
    const invalid = () => {
      throw new Error("bad cursor");
    };

    expect(() => decodeCursorPayload("x1.", "y1.abc", invalid)).toThrow("bad cursor");
    expect(() => decodeCursorPayload("x1.", "x1.not-json", invalid)).toThrow("bad cursor");
  });
});
```

Create `tests/api/integration/modules/articles/search-filter.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { escapeLikePattern, searchPattern } from "@modules/articles/search-filter";

describe("article search filter helpers", () => {
  test("escapes LIKE wildcards and backslashes", () => {
    expect(escapeLikePattern(String.raw`100%_match\path`)).toBe(String.raw`100\%\_match\\path`);
  });

  test("returns undefined for blank search and wraps nonblank search", () => {
    expect(searchPattern("   ")).toBeUndefined();
    expect(searchPattern(" browser ")).toBe("%browser%");
  });
});
```

- [ ] **Step 2: Run tests and verify missing module failures**

Run:

```bash
bun run --cwd tests test:api:integration ../../tests/api/integration/modules/articles/read/cursor-codec.test.ts ../../tests/api/integration/modules/articles/search-filter.test.ts
```

Expected: FAIL because the helper modules do not exist yet.

- [ ] **Step 3: Implement cursor codec**

Create `apps/api/src/modules/articles/read/cursor-codec.ts`:

```ts
export function encodeCursorPayload(prefix: string, payload: unknown): string {
  return `${prefix}${Buffer.from(JSON.stringify(payload), "utf8").toString("base64url")}`;
}

export function decodeCursorPayload<T>(
  prefix: string,
  cursor: string,
  onInvalid: () => never,
): T {
  if (!cursor.startsWith(prefix)) {
    onInvalid();
  }

  let raw: unknown;
  try {
    raw = JSON.parse(Buffer.from(cursor.slice(prefix.length), "base64url").toString("utf8"));
  } catch {
    onInvalid();
  }

  if (!raw || typeof raw !== "object") {
    onInvalid();
  }

  return raw as T;
}
```

- [ ] **Step 4: Implement search helper**

Create `apps/api/src/modules/articles/search-filter.ts`:

```ts
export function escapeLikePattern(input: string): string {
  return input.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
}

export function searchPattern(search: string | undefined): string | undefined {
  const trimmed = search?.trim();
  return trimmed ? `%${escapeLikePattern(trimmed)}%` : undefined;
}
```

- [ ] **Step 5: Rename merged cursor file and use the codec**

Run:

```bash
git mv apps/api/src/modules/articles/read/merged-view-cursor.ts apps/api/src/modules/articles/read/merged-cursor.ts
git mv tests/api/integration/modules/articles/read/merged-view-cursor.test.ts tests/api/integration/modules/articles/read/merged-cursor.test.ts
```

In `apps/api/src/modules/articles/read/merged-cursor.ts`, replace local base64 helpers with:

```ts
import { decodeCursorPayload, encodeCursorPayload } from "./cursor-codec";
```

Then encode with:

```ts
return encodeCursorPayload(PREFIX, payload);
```

and parse with:

```ts
const o = decodeCursorPayload<Partial<MergedCursorPayloadV1>>(
  PREFIX,
  trimmed,
  invalidMergedCursor,
);
```

Update imports in `apps/api/src/modules/articles/read/merge.ts`:

```ts
import { encodeMergedListCursorFromItem } from "./merged-cursor";
```

Update the renamed test import:

```ts
} from "@modules/articles/read/merged-cursor";
```

Also update the round-trip call so it passes the required sort:

```ts
const enc = encodeMergedListCursorFromItem(item, "newest");
```

- [ ] **Step 6: Update list and recent view cursor code**

In `apps/api/src/modules/articles/read/list.ts`, import:

```ts
import { decodeCursorPayload, encodeCursorPayload } from "./cursor-codec";
import { searchPattern } from "../search-filter";
```

Replace local `toBase64Url`, `fromBase64Url`, and `escapeLikePattern` with helper calls. `encodeCompositeCursor` should return:

```ts
return encodeCursorPayload("a1.", {
  v: 1,
  s: sort,
  pa: row.publishedAt.toISOString(),
  id: row.id,
  r: row.isRead,
});
```

The `a1.` branch in `decodeCompositeCursor` should use:

```ts
let raw: {
  pa?: unknown;
  id?: unknown;
  r?: unknown;
};
try {
  raw = decodeCursorPayload<{
    pa?: unknown;
    id?: unknown;
    r?: unknown;
  }>("a1.", trimmed, () => {
    throw new Error("Invalid article cursor");
  });
} catch {
  return null;
}
```

Then keep the existing payload validation. Preserve the legacy `publishedAt::id` fallback exactly.

In `pushSearchFilter`, replace pattern construction with:

```ts
const pattern = searchPattern(opts.search);
if (!pattern) {
  return;
}
```

In `apps/api/src/modules/articles/read/views-merged.ts`, import the same helpers. Replace local base64 helpers and search escaping. `encodeRecentViewCursorFromItem` should call:

```ts
return encodeCursorPayload(RECENT_VIEW_CURSOR_PREFIX, {
  v: 1,
  va: item.lastViewedAt.toISOString(),
  id: item.id,
  r: item.isRead,
  s: sort,
});
```

`decodeRecentViewCursor` should use `decodeCursorPayload` with `invalidRecentViewCursor`:

```ts
const payload = decodeCursorPayload<{
  v?: unknown;
  va?: unknown;
  id?: unknown;
  r?: unknown;
}>(
  RECENT_VIEW_CURSOR_PREFIX,
  trimmed,
  invalidRecentViewCursor,
);
```

- [ ] **Step 7: Update clip search escaping**

In `apps/api/src/modules/articles/write/clips.ts`, import:

```ts
import { searchPattern } from "../search-filter";
```

Delete the local `escapeLikePattern` function. In `listClipRows`, replace the search block with:

```ts
const pattern = searchPattern(opts.search);
if (pattern) {
  filters.push(
    or(
      ilike(articleClips.title, pattern),
      ilike(articleClips.note, pattern),
      ilike(articleClips.url, pattern),
    )!,
  );
}
```

- [ ] **Step 8: Run focused tests**

Run:

```bash
bun run --cwd tests test:api:integration ../../tests/api/integration/modules/articles/read/cursor-codec.test.ts ../../tests/api/integration/modules/articles/search-filter.test.ts ../../tests/api/integration/modules/articles/read/merged-cursor.test.ts ../../tests/api/integration/modules/articles/read/list.test.ts ../../tests/api/integration/modules/articles/read/views-merged.test.ts ../../tests/api/integration/modules/articles/write/clips.test.ts
```

Expected: PASS.

- [ ] **Step 9: Check for duplicate helpers**

Run:

```bash
rg "function toBase64Url|function fromBase64Url|function escapeLikePattern" apps/api/src/modules/articles
```

Expected: no matches.

- [ ] **Step 10: Typecheck**

Run: `bun run --cwd apps/api typecheck`

Expected: PASS.

- [ ] **Step 11: Commit**

```bash
git add apps/api/src/modules/articles/read/cursor-codec.ts apps/api/src/modules/articles/search-filter.ts apps/api/src/modules/articles/read/merged-cursor.ts apps/api/src/modules/articles/read/list.ts apps/api/src/modules/articles/read/views-merged.ts apps/api/src/modules/articles/read/merge.ts apps/api/src/modules/articles/write/clips.ts tests/api/integration/modules/articles/read/cursor-codec.test.ts tests/api/integration/modules/articles/search-filter.test.ts tests/api/integration/modules/articles/read/merged-cursor.test.ts
git add -u apps/api/src/modules/articles/read/merged-view-cursor.ts tests/api/integration/modules/articles/read/merged-view-cursor.test.ts
git commit -m "refactor(api): share article cursor and search helpers"
```

---

### Task 4: Move Generic Remote Document Fetching to `shared/net`

**Files:**
- Create: `apps/api/src/shared/net/remote-document.ts`
- Modify: `apps/api/src/modules/discover/feed/fetch.ts`
- Modify: `apps/api/src/modules/opml/fetch-url.ts`
- Modify: `apps/api/src/modules/articles/write/clips.ts`
- Modify: `apps/api/src/modules/articles/reader/extract-full-text.ts`
- Create: `tests/api/integration/shared/net/remote-document.test.ts`
- Modify: `tests/api/integration/modules/opml/fetch-url.test.ts`

**Interfaces:**
- Produces `RemoteDocumentErrorCode`.
- Produces `RemoteDocumentFetchResult`.
- Produces `fetchRemoteDocument(url: string, options?: FetchRemoteDocumentOptions): Promise<RemoteDocumentFetchResult>`.
- Keeps `fetchFeedDocument(url, options?)` as a discover/feed wrapper for feed-specific callers.
- Changes OPML to depend on shared net instead of `@modules/discover/feed/fetch`.

- [ ] **Step 1: Add shared fetcher tests first**

Create `tests/api/integration/shared/net/remote-document.test.ts`:

```ts
import { afterEach, describe, expect, test } from "bun:test";
import { fetchRemoteDocument } from "@shared/net/remote-document";

const originalFetch = globalThis.fetch;

function mockedFetch(
  handler: (url: string, init?: RequestInit) => Response | Promise<Response>,
): typeof globalThis.fetch {
  return (async (input: Request | string | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    return handler(url, init);
  }) as typeof globalThis.fetch;
}

describe("fetchRemoteDocument", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("follows safe redirects and returns the final URL", async () => {
    globalThis.fetch = mockedFetch((url) => {
      if (url === "https://93.184.216.34/start.xml") {
        return new Response(null, { status: 302, headers: { location: "/final.xml" } });
      }
      if (url === "https://93.184.216.34/final.xml") {
        return new Response("<xml />", { status: 200, headers: { "content-type": "text/xml" } });
      }
      throw new Error(`unexpected fetch: ${url}`);
    });

    await expect(fetchRemoteDocument("https://93.184.216.34/start.xml")).resolves.toMatchObject({
      ok: true,
      finalUrl: "https://93.184.216.34/final.xml",
      body: "<xml />",
      contentType: "text/xml",
    });
  });

  test("passes caller headers through without owning a feed user agent", async () => {
    let seenHeaders: HeadersInit | undefined;
    globalThis.fetch = mockedFetch((_url, init) => {
      seenHeaders = init?.headers;
      return new Response("<xml />", { status: 200 });
    });

    await expect(
      fetchRemoteDocument("https://93.184.216.34/feed.xml", {
        headers: { "user-agent": "kyomi-test-fetcher" },
      }),
    ).resolves.toMatchObject({ ok: true });

    expect(seenHeaders).toEqual({ "user-agent": "kyomi-test-fetcher" });
  });

  test("classifies blocked URLs and oversized responses", async () => {
    await expect(fetchRemoteDocument("http://127.0.0.1/feed.xml")).resolves.toMatchObject({
      ok: false,
      code: "BLOCKED_URL",
    });

    globalThis.fetch = mockedFetch(() => new Response("x".repeat(6), { status: 200 }));
    await expect(
      fetchRemoteDocument("https://93.184.216.34/feed.xml", { maxBytes: 5 }),
    ).resolves.toMatchObject({
      ok: false,
      code: "RESPONSE_TOO_LARGE",
    });
  });
});
```

- [ ] **Step 2: Run the shared fetcher test and verify it fails**

Run: `bun run --cwd tests test:api:integration ../../tests/api/integration/shared/net/remote-document.test.ts`

Expected: FAIL because `@shared/net/remote-document` does not exist yet.

- [ ] **Step 3: Implement the shared remote document fetcher**

Create `apps/api/src/shared/net/remote-document.ts`:

```ts
import { assertHttpOrHttpsUrl } from "./http-url";
import {
  BlockedOutboundUrlError,
  TooManyRedirectsError,
  fetchWithSafeRedirects,
  readResponseBodyWithByteLimit,
} from "./safe-fetch";

const DEFAULT_TIMEOUT_MS = 12_000;
const DEFAULT_MAX_BYTES = 2 * 1024 * 1024;
const DEFAULT_MAX_REDIRECTS = 5;

export type RemoteDocumentErrorCode =
  | "FETCH_FAILED"
  | "FETCH_TIMEOUT"
  | "TLS_CERTIFICATE_FAILED"
  | "HTTP_ERROR"
  | "TOO_MANY_REDIRECTS"
  | "RESPONSE_TOO_LARGE"
  | "BLOCKED_URL";

export type RemoteDocumentFetchResult =
  | { ok: true; finalUrl: string; body: string; contentType: string }
  | { ok: false; error: string; code: RemoteDocumentErrorCode; status?: number };

export type FetchRemoteDocumentOptions = {
  ignoreTlsError?: boolean;
  headers?: HeadersInit;
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
};

const TLS_CERT_ERROR_PATTERNS = [
  /unable to verify the first certificate/i,
  /unable to get local issuer certificate/i,
  /self[- ]signed certificate/i,
  /certificate has expired/i,
  /cert_.*invalid/i,
] as const;

function failed(
  code: RemoteDocumentErrorCode,
  error: string,
  status?: number,
): Extract<RemoteDocumentFetchResult, { ok: false }> {
  return { ok: false, error, code, status };
}

function classifyRemoteDocumentError(
  error: unknown,
): Extract<RemoteDocumentFetchResult, { ok: false }> {
  if (error instanceof BlockedOutboundUrlError) {
    return failed("BLOCKED_URL", error.message);
  }
  if (error instanceof TooManyRedirectsError) {
    return failed("TOO_MANY_REDIRECTS", "Too many redirects");
  }
  if (error instanceof Error && error.name === "AbortError") {
    return failed("FETCH_TIMEOUT", "Document fetch timed out");
  }
  if (
    error instanceof Error &&
    TLS_CERT_ERROR_PATTERNS.some((pattern) => pattern.test(error.message))
  ) {
    return failed("TLS_CERTIFICATE_FAILED", error.message);
  }
  const message = error instanceof Error ? error.message : "fetch failed";
  return failed("FETCH_FAILED", message);
}

export async function fetchRemoteDocument(
  url: string,
  options: FetchRemoteDocumentOptions = {},
): Promise<RemoteDocumentFetchResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    const init: RequestInit & { tls?: { rejectUnauthorized: boolean } } = {
      signal: controller.signal,
      headers: options.headers,
    };
    if (options.ignoreTlsError) {
      init.tls = { rejectUnauthorized: false };
    }

    const { response, finalUrl } = await fetchWithSafeRedirects(
      assertHttpOrHttpsUrl(url),
      init,
      { maxRedirects: options.maxRedirects ?? DEFAULT_MAX_REDIRECTS },
    );

    if (!response.ok) {
      response.body?.cancel().catch(() => undefined);
      return failed("HTTP_ERROR", `HTTP ${response.status}`, response.status);
    }

    const body = await readResponseBodyWithByteLimit(
      response,
      options.maxBytes ?? DEFAULT_MAX_BYTES,
    );
    if (!body.ok) {
      return failed("RESPONSE_TOO_LARGE", "Document response too large");
    }

    return {
      ok: true,
      finalUrl: finalUrl.href,
      body: body.body,
      contentType: response.headers.get("content-type") ?? "",
    };
  } catch (error) {
    return classifyRemoteDocumentError(error);
  } finally {
    clearTimeout(timer);
  }
}
```

- [ ] **Step 4: Keep feed fetch as a wrapper**

Replace `apps/api/src/modules/discover/feed/fetch.ts` with a small wrapper:

```ts
import {
  fetchRemoteDocument,
  type RemoteDocumentErrorCode,
  type RemoteDocumentFetchResult,
} from "@shared/net/remote-document";

const FETCH_TIMEOUT_MS = 12_000;
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 5;
const FEED_FETCH_HEADERS = {
  accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,application/rss+xml,application/atom+xml,application/json,*/*;q=0.8",
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36 (VolsRssFeedFetcher/1.0)",
} as const;

export type FetchFeedErrorCode = RemoteDocumentErrorCode;
export type FetchFeedDocumentResult = RemoteDocumentFetchResult;

function toFeedFetchResult(result: RemoteDocumentFetchResult): FetchFeedDocumentResult {
  if (result.ok) {
    return result;
  }
  if (result.code === "FETCH_TIMEOUT") {
    return { ...result, error: "Feed fetch timed out" };
  }
  if (result.code === "RESPONSE_TOO_LARGE") {
    return { ...result, error: "Feed response too large" };
  }
  return result;
}

export async function fetchFeedDocument(
  url: string,
  options?: { ignoreTlsError?: boolean },
): Promise<FetchFeedDocumentResult> {
  const result = await fetchRemoteDocument(url, {
    ignoreTlsError: options?.ignoreTlsError,
    headers: FEED_FETCH_HEADERS,
    timeoutMs: FETCH_TIMEOUT_MS,
    maxBytes: MAX_BYTES,
    maxRedirects: MAX_REDIRECTS,
  });
  return toFeedFetchResult(result);
}
```

- [ ] **Step 5: Move OPML off discover/feed fetcher**

In `apps/api/src/modules/opml/fetch-url.ts`, replace the feed import:

```ts
import {
  fetchRemoteDocument,
  type RemoteDocumentFetchResult,
} from "@shared/net/remote-document";
```

Add an OPML-local header constant near the top of the file so OPML preserves the previous fetch identity without depending on discover/feed internals:

```ts
const OPML_FETCH_HEADERS = {
  accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,application/rss+xml,application/atom+xml,application/json,*/*;q=0.8",
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36 (VolsRssFeedFetcher/1.0)",
} as const;
```

Change the error helper signature:

```ts
function fetchFailureToAppError(
  result: Extract<RemoteDocumentFetchResult, { ok: false }>,
): AppError {
```

Change the fetch call:

```ts
const fetched = await fetchRemoteDocument(url, { headers: OPML_FETCH_HEADERS });
```

- [ ] **Step 6: Use generic URL validation in article modules**

In `apps/api/src/modules/articles/write/clips.ts`, replace:

```ts
import { assertHttpOrHttpsUrl } from "@modules/discover/feed/normalize-url";
```

with:

```ts
import { assertHttpOrHttpsUrl } from "@shared/net/http-url";
```

In `apps/api/src/modules/articles/reader/extract-full-text.ts`, replace:

```ts
import { assertHttpOrHttpsUrl } from "@modules/discover/feed/normalize-url";
```

with:

```ts
import { assertHttpOrHttpsUrl } from "@shared/net/http-url";
```

- [ ] **Step 7: Run focused tests**

Run:

```bash
bun run --cwd tests test:api:integration ../../tests/api/integration/shared/net/remote-document.test.ts ../../tests/api/integration/modules/opml/fetch-url.test.ts ../../tests/api/integration/modules/discover/normalize-feed-url.test.ts ../../tests/api/integration/modules/discover/resolve-remote-feed.test.ts ../../tests/api/integration/modules/articles/write/clips.test.ts
```

Expected: PASS.

- [ ] **Step 8: Check forbidden imports**

Run:

```bash
rg "@modules/discover/feed/(fetch|normalize-url)" apps/api/src/modules/articles apps/api/src/modules/opml
```

Expected: no matches.

- [ ] **Step 9: Typecheck**

Run: `bun run --cwd apps/api typecheck`

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add apps/api/src/shared/net/remote-document.ts apps/api/src/modules/discover/feed/fetch.ts apps/api/src/modules/opml/fetch-url.ts apps/api/src/modules/articles/write/clips.ts apps/api/src/modules/articles/reader/extract-full-text.ts tests/api/integration/shared/net/remote-document.test.ts tests/api/integration/modules/opml/fetch-url.test.ts
git commit -m "refactor(api): share remote document fetching"
```

---

### Task 5: Rename Article Files That Already Change In This Branch

**Files:**
- Rename: `apps/api/src/modules/articles/reader/extract-full-text.ts` to `apps/api/src/modules/articles/reader/full-text.ts`
- Rename: `apps/api/src/modules/articles/read/merged-view-cursor.ts` to `apps/api/src/modules/articles/read/merged-cursor.ts` if Task 3 has not already done it
- Rename: `tests/api/integration/modules/articles/read/merged-view-cursor.test.ts` to `tests/api/integration/modules/articles/read/merged-cursor.test.ts` if Task 3 has not already done it
- Modify imports in `apps/api/src/modules/articles/reader/routes.ts`, `apps/api/src/modules/articles/read/merge.ts`, and tests.

**Interfaces:**
- Keeps: `extractFullTextForUser(...)` unchanged.
- Keeps: `encodeMergedListCursorFromItem(...)` and `decodeMergedListCursor(...)` unchanged.

- [ ] **Step 1: Rename full-text extraction file**

Run:

```bash
git mv apps/api/src/modules/articles/reader/extract-full-text.ts apps/api/src/modules/articles/reader/full-text.ts
```

Update `apps/api/src/modules/articles/reader/routes.ts`:

```ts
import { extractFullTextForUser } from "./full-text";
```

- [ ] **Step 2: Confirm merged cursor rename has happened**

Run:

```bash
test -f apps/api/src/modules/articles/read/merged-cursor.ts
test -f tests/api/integration/modules/articles/read/merged-cursor.test.ts
```

Expected: both commands exit 0. If either fails, perform the `git mv` commands from Task 3 Step 5 before continuing.

- [ ] **Step 3: Run filename check for touched article files**

Run:

```bash
git diff --name-only --diff-filter=ACMR | rg '^(apps/api/src/modules/articles|tests/api/integration/modules/articles)/.*([a-z]+-){2,}[a-z]+\\.(ts|tsx)$'
```

Expected: no matches for files added or modified by this branch.

- [ ] **Step 4: Run focused tests and typecheck**

Run:

```bash
bun run --cwd tests test:api:integration ../../tests/api/integration/modules/articles/routes.test.ts ../../tests/api/integration/modules/articles/read/merged-cursor.test.ts
bun run --cwd apps/api typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/articles/reader/full-text.ts apps/api/src/modules/articles/reader/routes.ts apps/api/src/modules/articles/read/merged-cursor.ts tests/api/integration/modules/articles/read/merged-cursor.test.ts
git add -u apps/api/src/modules/articles/reader/extract-full-text.ts apps/api/src/modules/articles/read/merged-view-cursor.ts tests/api/integration/modules/articles/read/merged-view-cursor.test.ts
git commit -m "refactor(api): shorten touched article filenames"
```

---

### Task 6: Stop Feed Internals From Importing Through Their Parent Barrel

**Files:**
- Modify: `apps/api/src/modules/feeds/read/status.ts`
- Modify: `apps/api/src/modules/feeds/refresh/routes.ts`
- Modify: `apps/api/src/modules/feeds/subscription/routes.ts`

**Interfaces:**
- Keeps: `apps/api/src/modules/feeds/service.ts` as the public cross-module surface.
- Internal imports should target `../read/service`, `../subscription/service`, and `../subscription/mutations` directly.

- [ ] **Step 1: Add an import-boundary smoke check command**

Run this before changes:

```bash
rg 'from "../service"' apps/api/src/modules/feeds
```

Expected: matches in `read/status.ts`, `refresh/routes.ts`, and `subscription/routes.ts`.

- [ ] **Step 2: Update `read/status.ts`**

Change:

```ts
import { assertUserSubscribedToFeed } from "../service";
```

to:

```ts
import { assertUserSubscribedToFeed } from "../subscription/mutations";
```

- [ ] **Step 3: Update `refresh/routes.ts`**

Change:

```ts
import { assertUserSubscribedToFeed, listFeedRefreshStatusesForUser } from "../service";
```

to:

```ts
import { listFeedRefreshStatusesForUser } from "../read/service";
import { assertUserSubscribedToFeed } from "../subscription/mutations";
```

- [ ] **Step 4: Update `subscription/routes.ts`**

Replace the `../service` import with owner imports:

```ts
import { getFeedDetailForUser, listSubscribedFeeds } from "../read/service";
import {
  assertUserSubscribedToFeed,
  bulkMoveFeedsToFolder,
  bulkUnsubscribeFromFeeds,
  unsubscribeFromFeed,
  updateFeedSubscriptionSettings,
} from "./mutations";
import { createOrSubscribeToFeed, subscribeToExistingFeed } from "./service";
```

- [ ] **Step 5: Verify internal feed imports no longer use the parent barrel**

Run:

```bash
rg 'from "../service"' apps/api/src/modules/feeds
```

Expected: no matches.

- [ ] **Step 6: Run focused tests and typecheck**

Run:

```bash
bun run --cwd tests test:api:integration ../../tests/api/integration/modules/feeds/service.test.ts ../../tests/api/integration/modules/feeds/feed-refresh-policy.test.ts
bun run --cwd apps/api typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/feeds/read/status.ts apps/api/src/modules/feeds/refresh/routes.ts apps/api/src/modules/feeds/subscription/routes.ts
git commit -m "refactor(api): use owner imports inside feeds module"
```

---

### Task 7: Final Boundary Audit and Full Verification

**Files:**
- Modify only files already changed by Tasks 1-6 if verification finds a missed import.

**Interfaces:**
- Produces no new runtime interface.
- Produces final confidence that removed routes, dead today view, shared helpers, and owner imports are coherent.

- [ ] **Step 1: Run route and import audits**

Run:

```bash
rg "summarizeContent|translateContent|summarizeBodySchema|translateBodySchema|listMergedTodayView" apps/api/src tests/api/integration tests/web/integration
rg "/articles/views/today" apps/api/src
rg "@modules/discover/feed/(fetch|normalize-url)" apps/api/src/modules/articles apps/api/src/modules/opml
rg 'from "../service"' apps/api/src/modules/feeds
rg "function toBase64Url|function fromBase64Url|function escapeLikePattern" apps/api/src/modules/articles
```

Expected:
- First command has no matches for summarize/translate symbols or `listMergedTodayView`; intentional negative-test references to `/articles/views/today` are allowed.
- Second command has no matches, proving the removed today route is not live in API source.
- Third command has no matches.
- Fourth command has no matches.
- Fifth command has no matches.

- [ ] **Step 2: Run API integration suite**

Run: `bun run test:api:integration`

Expected: PASS.

- [ ] **Step 3: Run web integration tests touched by query URL behavior**

Run: `bun run --cwd tests test:web:integration web/integration/modules/inbox/query-urls.test.ts`

Expected: PASS.

- [ ] **Step 4: Run API typecheck and format check**

Run:

```bash
bun run --cwd apps/api typecheck
bun run --cwd apps/api fmt:check
```

Expected: PASS.

- [ ] **Step 5: Inspect final diff**

Run: `git diff --stat`

Expected: diff includes only files named in this plan plus the new plan file if it is intentionally committed.

- [ ] **Step 6: Commit final fixes if any**

If Step 1-5 caused follow-up edits:

```bash
git status --short
git diff --name-only
git commit -m "chore(api): verify boundary cleanup"
```

Stage only the specific follow-up files reported by `git diff --name-only` that belong to Tasks 1-6 before running the commit command. If no follow-up edits were needed, do not create an empty commit.

## Failure Modes to Cover

- Removed summarize/translate routes still appear in route registration. Covered by `tests/api/integration/modules/articles/routes.test.ts`.
- Web accidentally calls the deleted today route through a legacy filter. Covered by `tests/web/integration/modules/inbox/query-urls.test.ts`.
- Cursor helper refactor corrupts pagination cursor decode. Covered by `merged-cursor.test.ts` and `cursor-codec.test.ts`.
- Search helper refactor fails to escape `%`, `_`, or `\`. Covered by `search-filter.test.ts`.
- OPML import loses safe-fetch protections when moving off the feed fetcher. Covered by `remote-document.test.ts` and `opml/fetch-url.test.ts`.
- Feed internal direct imports accidentally change route behavior. Covered by API typecheck and feed integration tests.

## Worktree Parallelization Strategy

| Step | Modules touched | Depends on |
|------|-----------------|------------|
| Remove summarize/translate | `modules/articles/reader`, `modules/articles/write`, `modules/articles/schemas` | - |
| Remove today view | `modules/articles/read`, `apps/web/src/modules/inbox` tests | - |
| Cursor/search helpers | `modules/articles/read`, `modules/articles/write` | Remove today view preferred |
| Shared remote fetch | `shared/net`, `modules/discover`, `modules/opml`, `modules/articles` | Remove summarize/translate preferred |
| Feed owner imports | `modules/feeds` | - |
| Filename cleanup | `modules/articles/reader`, `modules/articles/read` | Cursor/search helpers |

Parallel lanes:
- Lane A: Remove summarize/translate -> Shared remote fetch -> Filename cleanup.
- Lane B: Remove today view -> Cursor/search helpers.
- Lane C: Feed owner imports.

Execution order: Launch Lane A, Lane B, and Lane C in parallel worktrees only if each worker owns its lane and merges through the base branch between lanes. Merge Lane C first, then Lane B, then Lane A, because Lane A and Lane B both touch article modules and may conflict around imports.

Conflict flags:
- Lane A and Lane B both touch `apps/api/src/modules/articles`, so merge sequentially if you want fewer conflict-resolution steps.
- Lane C is independent and safe to implement separately.

## Deferred Work

- Create a separate mechanical plan for the remaining filename convention violations outside touched article files: app boot files, startup guard, feed refresh error helper, and catalog scripts.
- When real summarize/translate is ready, design it as a new feature with provider configuration, rate limits, auth/accounting, prompt/eval coverage, and explicit UI entry points.
- Consider adding a lightweight boundary check that fails when `apps/api/src/modules/**` internals import through their own parent `service.ts` barrel.

## Self-Review

- Spec coverage: The plan addresses all five functional findings and the filename finding with right-sized in-branch renames plus explicit deferred mechanical work.
- Placeholder scan: No task says to "add appropriate handling" or "write tests"; each task names specific tests and code snippets.
- Type consistency: New helper names are stable across tasks: `extractFullTextFromUrl`, `fetchRemoteDocument`, `encodeCursorPayload`, `decodeCursorPayload`, `escapeLikePattern`, `searchPattern`, `encodeMergedListCursorFromItem`, and `decodeMergedListCursor`.
- Behavior preservation: Reader full-text extraction, clip creation, OPML fetch, feed refresh, and article list pagination keep existing public behavior except for the deliberate removal of placeholder routes and stale today view.
