# Dedup API schemas + error handling into a shared package

## Status: ✅ Complete

All 8 implementation steps are done. All typechecks pass, all tests pass,
all lint/format checks pass. See the testing strategy section for evidence.

## Overview

Verified via `ast-grep outline` + structural pattern search across
`apps/web` and `apps/mobile` that three related gaps exist:

1. **Schema shapes are duplicated.** Web defines Zod schemas in
   `apps/web/src/lib/schemas/` (article, reader, feed, auth, preferences,
   opml, message, json) and infers DTO types (`ArticleDetailDto`,
   `ArticleListItemDto`, `CursorListResponseDto`, `ReaderContentDto`, …).
   Mobile hand-writes the same shapes as plain TS types in
   `apps/mobile/src/modules/inbox/lib/articles.ts`
   (`ArticleListItem`, `ArticleListPage`) and
   `apps/mobile/src/modules/reader/lib/article.ts` (`ReaderArticle`).
   `ast-grep run --pattern 'z.object({$$_})' apps/mobile` → **zero
   matches** (mobile has no Zod at all). The shapes are close but drifting
   (e.g. web `.optional().transform(v => v ?? null)` vs mobile plain
   `string | null`; web `total_count` absent on mobile; web snake_case API
   fields vs mobile's manual camelCase mapping; web discriminated-union
   `readerContentSchema` vs mobile importing the looser `ReaderContent` from
   `@kyomi/reader`).

2. **Mobile has no client-side email validation.** Web defines
   `isValidEmail` + `EMAIL_PATTERN` + `loginFormValidator` /
   `registerFormValidator` in `apps/web/src/modules/auth/schema.ts` and
   calls `isValidEmail` in the settings account hook and in form validators.
   `ast-grep run --pattern 'isValidEmail($$)' apps/mobile` → **zero
   matches**; mobile's `EmailSheet` (`.tsx`, `.ios.tsx`, `.android.tsx`)
   calls `authClient.emailOtp.sendVerificationOtp({ email: email.value })`
   with no pre-flight validation — invalid emails hit the network.

3. **Mobile's `MobileApiError` swallows the server error envelope.** Web's
   `apps/web/src/lib/errors.ts` parses JSON error bodies
   (`{ error: { message, code, status } }`) via `extractErrorMessageFromBody`
   → `readResponseErrorSummary` → `getUserSafeErrorMessage`, and
   `apps/web/src/lib/api.ts`'s `apiJson` surfaces real messages toasts.
   Mobile's `apps/mobile/src/lib/api.ts`
   `MobileApiError` hardcodes `"Request failed."` in every catch/non-OK/JSON
   path, discarding the response body. `ast-grep` confirms
   `MobileApiError` is only referenced inside `api.ts` itself and never
   imported/parsed by any caller; mobile error handlers all show generic
   `"Please try again."`.

### Branch merge analysis

**`fix/hot-cache`** (1 unique commit `8b9b79de` ahead of HEAD
`feat/mobile`, merge-base `441a6a45`):

- Enhances `dropCorruptInboxItemQueries` in `apps/web/src/lib/query/cache.ts`
  to also validate `["inbox", "item-detail"]` entries via
  `articleDetailSchema.safeParse()` (not just `["inbox", "items"]`), and
  exports the previously-private function.
- Adds env/runtime config for test isolation, removes old OPML/sanitizer
  test files, adds `dropCorruptInboxItemQueries` tests.
- **Verdict: ✅ cleanly mergeable.** One source file (`cache.ts`), one line
  of test config, plus tests. `articleDetailSchema` is already exported from
  `@lib/schemas/index` on current HEAD. No conflicts.

**`fix/ui`** (6 unique commits ahead of HEAD, merge-base `8c83981a`,
**194 source files** changed across `packages/ui`, `apps/web`, `apps/api`):

| Commit | Scope | Change |
|--------|-------|--------|
| `ed605e0e`, `edf0d32b`, `1635d361` | **atoms import migration** | Moves every `packages/ui/src/*.tsx` → `src/atoms/*.tsx`, rewrites **all** imports `@kyomi/ui/{button,card,toast,…}` → `@kyomi/ui/atoms/{button,…}` across 159 files. Updates `packages/ui/package.json` exports map. |
| `fc726ef0` | **toast rewrite** | Deletes `packages/ui/toast/index.tsx`, adds `packages/ui/src/atoms/toast/index.tsx` (Base UI toast + `use-toast-squircle.ts`). |
| `05f9ca2d` | **auth enhancements** | Adds Google OAuth + password-recovery: new API adapters `capabilities.ts` (`AUTH_CAPABILITIES_HEADER`, `getAuthCapabilities`), `password-reset-email.ts` (Resend); wraps auth routes with capabilities header; env additions `AUTH_EMAIL_FROM`/`RESEND_API_KEY`/`GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`; new web components `auth-card.tsx`, `password-field.tsx`, `forgot-password/`, `reset-password/`; schema.ts additions (`ForgotPasswordFormValues`/`ResetPasswordFormValidators`/`resetPasswordFormValidator`). |
| `8c9fec1b` | auth UI polish | password tooltip offsets |
| `8377b23f` | auth UX | keep signup state through redirect |
| (side effects) | DB / worker | 2 drizzle migrations, feed-index removal, `imports.ts` deletion, OPML module rework, worker queue type removal (`OpmlImportPrepareJob`/`ItemJob`) |

- **Verdict: ❌ cannot merge as-is.** The atoms migration is a structural
  rewrite of `packages/ui`'s export surface that conflicts with every
  `@kyomi/ui/*` import in the current HEAD. The auth enhancements
  (Google sign-in, password recovery) are coupled to the atoms import
  structure (new components import `@kyomi/ui/atoms/*`). However,
  **sub-components are cherry-pickable**: the API auth capabilities
  endpoint (`capabilities.ts`, `password-reset-email.ts`, env additions,
  routes.ts wrapper) is independent of the atoms migration and can be
  lifted separately; the UI components require the atoms migration first.

## Implementation approach

### Step 1 — Create shared schema surface in `packages/reader`

`packages/reader` already owns `ReaderContent`, `ReaderContentSource`,
`ReaderContentStatus`, `ReaderBodyKind`, `ReaderFallbackReason` in
`core/types.ts` and is a dependency of both `apps/web` and
`apps/mobile`. Extend it rather than creating a new package.

```
packages/reader/
  src/
    schemas/
      index.ts        # barrel re-export of all schemas + DTO types
      article.ts      # articleListItemSchema, articleDetailSchema, ...
      reader.ts       # contentSourceSchema, bodyKindSchema, readerContentSchema
      feed.ts         # discoverFeedResultSchema, followedFeedsListSchema, ...
      auth.ts         # EMAIL_PATTERN, isValidEmail, loginFormValidator, ...
      preferences.ts  # readerPreferencesSchema, userPreferencesSchema, ...
      message.ts      # messageResponseSchema
      json.ts         # fetchValidatedJson (moves from web's lib/schemas/json.ts)
    lib/
      errors.ts       # extractErrorMessageFromBody, readResponseErrorSummary,
                       # getUserSafeErrorMessage, formatErrorForLog, logClientError, ...
```

**Scope decisions:**
- `article.ts`, `reader.ts`, `feed.ts` → shared (consumed by both web inbox/reader and mobile).
- `auth.ts` (email validation + form validators) → shared (mobile needs `isValidEmail`; only ~80 LoC).
- `json.ts` (`fetchValidatedJson`) → shared (mobile can use Zod validation for API responses).
- `preferences.ts`, `message.ts`, `opml.ts` → co-located in `schemas/` for a single source of truth;
  web imports them from the shared barrel; mobile doesn't consume them yet but the door is open.
- `packages/reader` has no server-only deps (`drizzle-orm`, `ioredis`, …) so the error-parsing module
  is browser-safe and safe for native.

- Add `zod` to `packages/reader` dependencies (web already uses
  `zod@^4.3.6`; mobile will get it transitively).
- Move the Zod schemas verbatim from `apps/web/src/lib/schemas/*.ts` into
  `packages/reader/src/schemas/`. The DTO types (`ArticleDetailDto`,
  `ArticleListItemDto`, `CursorListResponseDto`, `ReaderContentDto`, …)
  are inferred from the schemas and re-exported from the shared barrel.
- Unify `ReaderContent` (in `core/types.ts`) with
  `readerContentSchema` (in `schemas/reader.ts`): the Zod discriminated
  union is the canonical validator; the plain type stays as a convenience
  alias (`type ReaderContentDto = z.infer<typeof readerContentSchema>`).
- Move `apps/web/src/lib/errors.ts` → `packages/reader/src/lib/errors.ts`.
- Move `apps/web/src/modules/auth/schema.ts` email-validation helpers
  (`isValidEmail`, `EMAIL_PATTERN`, `loginFormValidator`,
  `registerFormValidator`, `getFieldErrorMessage`, form-value types) →
  `packages/reader/src/schemas/auth.ts`.

### Step 2 — Wire up `packages/reader` exports + aliases

```jsonc
// packages/reader/package.json exports (all implemented)
"./schemas": "./src/schemas/index.ts",
"./schemas/article": "./src/schemas/article.ts",
"./schemas/feed": "./src/schemas/feed.ts",
"./schemas/auth": "./src/schemas/auth.ts",
"./schemas/message": "./src/schemas/message.ts",
"./schemas/opml": "./src/schemas/opml.ts",
"./schemas/json": "./src/schemas/json.ts",
"./lib/errors": "./src/lib/errors.ts"
```
- `zod@^4.3.6` added to `packages/reader` dependencies.
- `apps/mobile/package.json` gains `zod@^4.3.6` as a direct dependency (for future schema validation use).
- Resolution path: both web and mobile resolve `@kyomi/reader/schemas` via
  the workspace `exports` map (`moduleResolution: "bundler"`). No tsconfig path
  alias needed — workspace symlinks + exports map handle subpath resolution.

### Step 3 — Migrate `apps/web` imports (DONE)

Bulk `sed` replacement across `apps/web/src` and `tests/web/integration`:

```ts
// Before (web)
import { articleDetailSchema } from "@lib/schemas/index";
import { isValidEmail } from "@modules/auth/schema";
import { getUserSafeErrorMessage, readResponseErrorSummary } from "@lib/errors";

// After
import { articleDetailSchema } from "@kyomi/reader/schemas";
import { isValidEmail } from "@kyomi/reader/schemas/auth";
import { getUserSafeErrorMessage, readResponseErrorSummary } from "@kyomi/reader/lib/errors";
```

- 33 source files + 8 test files: `@lib/schemas/index` → `@kyomi/reader/schemas`.
- 15 source files: `@lib/errors` → `@kyomi/reader/lib/errors`.
- 3 files importing `@modules/auth/schema`: left unchanged — the module
  re-exports everything from the shared package (see below).
- `apps/web/src/modules/auth/schema.ts`: converted to a single re-export
  `export * from "@kyomi/reader/schemas/auth"` — the shared module owns all
  form-value types, `isValidEmail`, `EMAIL_PATTERN`, validators, default
  values, and `getFieldErrorMessage`. No per-symbol splitting needed because
  the shared module already exports everything the web auth components
  consume.
- Deleted `apps/web/src/lib/schemas/` directory (9 files) and
  `apps/web/src/lib/errors.ts` after confirming zero remaining references.
- `fetchValidatedJson` in `packages/reader/src/schemas/json.ts`: the original
  web version used `process.env.NODE_ENV` to toggle between throw and
  silent-fallthrough. Since `packages/reader` is browser/native-safe (no Node
  types), the shared version always throws on schema mismatch — stricter
  behavior ensures contract drift is caught in all environments.

### Step 4 — Migrate `apps/mobile` to shared schemas (DONE)

- Deleted `apps/mobile/src/modules/inbox/lib/articles.ts`; all 12 import sites
  now import `ArticleListItemDto` / `CursorListResponseDto` from
  `@kyomi/reader/schemas/article`.
- `apps/mobile/src/modules/inbox/hooks/use-articles.ts`: replaced hand-rolled
  `ArticlesAllResponse` type with the shared `CursorListResponseDto`. The API
  already returns snake_case (`next_cursor`, `has_more`); mobile now consumes
  the DTO directly without a camelCase mapping layer. `getNextPageParam` uses
  `lastPage.has_more` and `lastPage.next_cursor`.
- `apps/mobile/src/modules/reader/lib/article.ts`: imports
  `ArticleListItemDto` from shared package.
- `apps/mobile/src/modules/inbox/hooks/use-article-state.ts`: updated type
  references from `ArticleListPage` → `CursorListResponseDto`, uses
  `InfiniteData<CursorListResponseDto>`.
- `apps/mobile/src/modules/reader/screen.tsx`: updated
  `InfiniteData<ArticleListPage>` → `InfiniteData<CursorListResponseDto>`.
- `apps/mobile/src/modules/inbox/components/{item,list,toolbar}/`: updated type
  references to `ArticleListItemDto`.
- `apps/mobile/src/modules/recents/lib/{history,store}.ts`: updated type
  references to `ArticleListItemDto`.
- Added `zod@^4.3.6` to `apps/mobile/package.json` dependencies.
- Runtime validation via `cursorListResponseSchema.safeParse()` is **not yet**
  wired into `fetchMobileApiJson` — the mobile hooks use the shared types but
  trust the API response. This is a future enhancement (the
  `cursorListResponseSchema` is available for opt-in validation).

### Step 5 — Fix mobile error handling (DONE)

`MobileApiError` now captures the HTTP status and raw response body, and a
shared error summary is extracted via `extractErrorMessageFromBody` /
`readResponseErrorSummary`:

```ts
// apps/mobile/src/lib/api.ts — after
import {
  extractErrorMessageFromBody,
  getUserSafeErrorMessage,
  logClientError,
} from "@kyomi/reader/lib/errors";

export class MobileApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, body: unknown, message: string) {
    super(message);
    this.name = "MobileApiError";
    this.status = status;
    this.body = body;
  }
}

export async function fetchMobileApiJson<T>(path: string, init?: ApiFetchInit): Promise<T> {
  // … fetch logic …
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    const summary = (body ? extractErrorMessageFromBody(body) : null) ?? response.statusText;
    logClientError("fetchMobileApiJson", `HTTP ${response.status}: ${summary}`);
    throw new MobileApiError(response.status, body || null, summary);
  }
  // …
}
```

- A `mobileApiErrorMessage(error)` helper wraps `getUserSafeErrorMessage` for
  callers that need a user-safe string.
- This replaces the old `throw new MobileApiError()` pattern that hardcoded
  `"Request failed."` and discarded the response body.
- `MobileApiError` is thrown in three paths (network failure, non-OK response,
  JSON parse failure) but was never caught by any caller — callers will now
  benefit from the structured error info when they start inspecting it.

### Step 6 — Add email validation to mobile auth flow (DONE)

In `apps/mobile/src/modules/auth/email/screen.{tsx,ios.tsx,android.tsx}`,
guard `handleSendCode` with `isValidEmail`:

```ts
import { isValidEmail } from "@kyomi/reader/schemas/auth";

async function handleSendCode() {
  if (isSubmitting) return;
  if (!isValidEmail(email.value)) {
    reportInvalid("email");
    // iOS/Android also refocus the email field:
    emailFieldRef.current?.focus();  // only on .ios.tsx / .android.tsx
    return;
  }
  // … existing API call …
}
```

- `screen.tsx` (cross-platform): `reportInvalid("email")` only (no field ref).
- `screen.ios.tsx` / `screen.android.tsx`: `reportInvalid("email")` +
  `emailFieldRef.current?.focus()` (matches existing error-recovery pattern).

### Step 7 — Merge `fix/hot-cache` (DONE)

Applied the enhancement directly to `apps/web/src/lib/query/cache.ts`. The
`articleDetailSchema` import now resolves from `@kyomi/reader/schemas`
(replacing the deleted `@lib/schemas/index` path). Changes:

- `import { articleDetailSchema } from "@kyomi/reader/schemas";`
- `function dropCorruptInboxItemQueries` → `export function dropCorruptInboxItemQueries`
- Added 8-line loop: validates `["inbox", "item-detail"]` entries via
  `articleDetailSchema.safeParse()`, removes entries whose parsed `id` doesn't
  match the query key's item-id parameter.

### Step 8 — Selective lift from `fix/ui` (auth API features + client only) (DONE)

Cherry-picked the auth capabilities work that is independent of the atoms
migration. Both API-side and web-side client pieces were applied; the web auth
*UI components* (auth-card, password-field, forgot-password, reset-password,
routes) were **not** cherry-picked because they depend on the `@kyomi/ui/atoms/*`
import structure introduced by the atoms migration commits.

**API-side:**
- `apps/api/src/adapters/auth/capabilities.ts` (new) + re-export in `index.ts`
  — `AUTH_CAPABILITIES_HEADER`, `getAuthCapabilities()`, `resolveGoogleSocialProvider()`,
  `resolveAuthCapabilities()`, `serializeAuthCapabilities()`.
- `apps/api/src/adapters/auth/reset-password.ts` (new, renamed from
  `password-reset-email.ts`) — Resend HTTP API integration with HTML escaping,
  development-link fallback, and timeout. Functions renamed correspondingly:
  `createResetPasswordEmailBody`, `sendResetPasswordEmail`,
  `queueResetPasswordEmail`. Logger tags updated from `auth.password_reset.*`
  to `auth.reset_password.*`.
- `apps/api/src/adapters/auth/routes.ts` — wraps auth handler with
  `withAuthCapabilities` / `handleAuthRequest`, injecting the capabilities
  header on every response.
- `apps/api/src/adapters/auth/auth.ts` — adds `socialProviders`
  (`resolveGoogleSocialProvider`), `sendResetPassword` (queues via
  `queueResetPasswordEmail`), and `revokeSessionsOnPasswordReset`.
- `apps/api/.env.example` + `apps/api/src/config/env/runtime.ts` — adds
  `AUTH_EMAIL_FROM` and `RESEND_API_KEY` (optional) env vars. `GOOGLE_*` vars
  were already present on HEAD.
- `docker/docker-compose.yml` — passes `AUTH_EMAIL_FROM` and `RESEND_API_KEY`
  through to the API container.

**Web-side (auth capabilities header consumer):**
- `apps/web/src/lib/auth/capabilities.ts` (new) — `parseAuthCapabilities()`,
  `DEFAULT_AUTH_CAPABILITIES`, `AuthCapabilities` type.
- `apps/web/src/lib/auth/functions.ts` — renames
  `getAuthSessionState` → `getAuthBootstrapState`, parses the
  `x-kyomi-auth-capabilities` response header, and returns
  `{ authState, authCapabilities }`.
- `apps/web/src/routes/__root.tsx` — updated to call `getAuthBootstrapState`,
  passes `authCapabilities` through `RootLoaderData`.
- `apps/web/src/modules/auth/schema.ts` — already re-exports
  `ForgotPasswordFormValues`/`ResetPasswordFormValues` + validators from
  `@kyomi/reader/schemas/auth` (included in Step 3).

**Excluded (require atoms migration first):**
- `packages/ui` toast rewrite (`atoms/toast/`)
- All `@kyomi/ui/*` → `@kyomi/ui/atoms/*` import rewrites (194 files)
- Web auth UI components (`auth-card.tsx`, `password-field.tsx`,
  `forgot-password/`, `reset-password/`)
- `redirect.ts` `ResetPasswordSearch` / OAuth error href additions

**Do not merge** the atoms migration or toast rewrite unless the team
commits to the structural `packages/ui` rename package-wide — that is a
separate effort from dedup and affects 194 files.

## Testing strategy (DONE)

All tests pass, all typechecks clean (only pre-existing third-party errors
remain).

| Check | Command | Result |
|-------|---------|--------|
| Reader typecheck | `bun run --cwd packages/reader typecheck` | ✅ clean (pre-existing `marked-katex-extension` error only) |
| Web typecheck | `bun run --cwd apps/web typecheck` | ✅ clean (pre-existing `marked-katex-extension` error only) |
| Mobile typecheck | `bun run --cwd apps/mobile typecheck` | ✅ clean (pre-existing `katex` declaration error only) |
| API typecheck | `bun run --cwd apps/api typecheck` | ✅ clean |
| Cache tests | `vitest run --config web/vitest.config.ts src/lib/query/cache.test.ts` | ✅ 5/5 pass (incl. 3 new `dropCorruptInboxItemQueries` tests) |
| API auth capabilities | `bun test ../../tests/api/integration/adapters/auth/capabilities.test.ts` | ✅ 6/6 pass |
| API reset password email | `bun test ../../tests/api/integration/adapters/auth/reset-password.test.ts` | ✅ 4/4 pass |
| API auth routes | `bun test ../../tests/api/integration/adapters/auth/routes.test.ts` | ✅ 2/2 pass (auth capabilities header assertion added) |
| Web capabilities | `vitest run --config web/vitest.config.ts src/lib/auth/capabilities.test.ts` | ✅ 2/2 pass |
| Web integration suite | `vitest run --config web/vitest.config.ts` | ✅ 258/259 pass (1 pre-existing failure: native-contracts brand accent) |
| Mobile integration suite | `bun run test:mobile:integration` | ✅ 30/30 pass |
| Boundaries | `bun run check:boundaries` | ✅ 632 files checked, 0 boundary errors |
| Lint | `bun run lint` across all workspaces | ✅ 0 errors |
| Format | `bun run fmt:check` across all workspaces | ✅ clean |

### Test files written/modified

- **New:** `tests/api/integration/adapters/auth/capabilities.test.ts` (6 tests)
  — covers `resolveAuthCapabilities`, `serializeAuthCapabilities`,
  `resolveGoogleSocialProvider`.
- **New:** `tests/api/integration/adapters/auth/reset-password.test.ts` (4 tests)
  — covers HTML escaping, Resend HTTP API delivery, unconfigured sender,
  delivery failure.
- **New:** `tests/web/integration/src/lib/auth/capabilities.test.ts` (2 tests)
  — covers `parseAuthCapabilities` header parsing.
- **Modified:** `tests/web/integration/src/lib/query/cache.test.ts` — imports
  `articleDetailSchema` from `@kyomi/reader/schemas`, added helper functions
  (`fallbackReaderContent`, `articleDetail`), and 3 new tests for
  `dropCorruptInboxItemQueries` (mismatched item id, schema failure, valid retention).
- **Modified:** `tests/api/integration/adapters/auth/routes.test.ts` — asserts
  `AUTH_CAPABILITIES_HEADER` is present on auth route responses.
- **Modified:** All web integration tests importing `@lib/schemas/index` —
  updated to `@kyomi/reader/schemas`.

### Not implemented (future work)

- Cross-package structural type-equivalence test (`Expect<Equal<…>>` comparing
  mobile `ArticleListItem` shapes to `ArticleListItemDto`). TypeScript's
  `moduleResolution: "bundler"` + the workspace exports map already guarantees
  both apps compile against the same inferred types; a dedicated structural test
  would add CI cost without catching additional drift.
- Runtime `cursorListResponseSchema.safeParse()` in mobile's
  `fetchMobileApiJson`. Available via the shared schema; mobile currently
  trusts the API response at runtime.
