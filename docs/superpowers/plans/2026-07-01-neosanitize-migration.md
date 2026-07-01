# Migrate Article Sanitization to neosanitize

## Goal

Migrate Kyomi article HTML sanitization from DOMPurify to the main `neosanitize` engine while preserving the current reader/security behavior:

- Keep article-safe structural markup, code blocks, tables, MathML/KaTeX, figures, captions, and publisher layout wrappers.
- Preserve current class-token filtering, TypeDoc `data-tsd-*` stripping, image attribute normalization, and empty-element cleanup.
- Keep API reader extraction post-processing intact: relative URL resolution, carousel cleanup, leading metadata removal, and `htmlToText`.
- Remove duplicated DOMPurify policy drift between `packages/worker` and `packages/reader`.
- Remove DOMPurify package dependencies once parity tests pass.

## Current State

The current sanitizer surface is split across server, worker, and browser reader code:

- `packages/worker/src/sanitization/article-html.ts`
  - Canonical DOMPurify allow-list and hooks.
  - Exports `ARTICLE_HTML_ALLOWED_TAGS`, `ARTICLE_HTML_ALLOWED_ATTR`, `ARTICLE_HTML_FORBID_TAGS`, `isAllowedArticleClassToken`, `registerArticleHtmlSanitizeHooks`, and DOMPurify config helpers.

- `apps/api/src/modules/articles/reader/sanitize-content.ts`
  - Creates a JSDOM window and DOMPurify instance.
  - Registers the worker hooks and calls `DOMPurify.sanitize`.
  - Also performs API-only DOM cleanup using JSDOM:
    - `resolveRelativeAssetUrls`
    - `stripCarouselArtifacts`
    - `stripLeadingArticleMetadata`
    - `htmlToText`

- `packages/reader/src/web/html/sanitization.ts`
  - Browser-side duplicate of the worker DOMPurify policy.
  - Current comment says worker is canonical and this file must be updated in parallel.

- `packages/reader/src/web/html/purify.ts`
  - Creates a browser DOMPurify instance and calls the duplicated reader policy.

- Dependency manifests:
  - `apps/api/package.json`: `dompurify`, `jsdom`
  - `packages/worker/package.json`: `dompurify`
  - `packages/reader/package.json`: `dompurify`
  - `apps/web/package.json`: already has `neosanitize`, though no code currently imports it directly.

Existing relevant tests:

- `tests/api/integration/modules/articles/reader/sanitize-content.test.ts`
  - API sanitizer coverage for scripts, unsafe schemes, relative URLs, filtered classes, `data-tsd-*`, carousel artifacts, and `htmlToText`.
- `tests/web/integration/components/reader/render-html.test.tsx`
  - Browser reader coverage for sanitized markup feeding reader DOM enhancements.

## neosanitize Findings

Local package docs inspected from Bun cache for `neosanitize@0.3.0`.

Use the main engine, not `neosanitize/legacy`:

- Main entry:
  - `import { Sanitizer } from "neosanitize"`
  - `Sanitizer.builder(policy).allow(...).build().sanitize(html)`
  - Deny-by-default.
  - Uses a browser-faithful parser.
  - Browser export condition uses native `DOMParser` and avoids shipping the Node parser.
  - Baseline always strips scripts, event handlers, `javascript:`, `vbscript:`, and non-image `data:` URLs.

- Legacy entry:
  - Drop-in for `sanitize-html`, not DOMPurify.
  - Not appropriate as the primary migration path because the current code relies on DOMPurify hooks and server/browser parity, not sanitize-html behavior.

Important API differences:

- `neosanitize` does not provide DOMPurify-style hooks.
- Policy can allow tags/attrs, but custom transformations must be explicit pre/post-processing.
- The baseline dangerous URL behavior is not identical to the current `ALLOWED_URI_REGEXP: /^https?:\/\//i`; relative URLs are allowed by default unless normalized before sanitization.
- Current API/browser code already resolves relative links and images before sanitization, so the migration should keep that sequence.

## Areas That Change

### Worker Sanitization Policy

File: `packages/worker/src/sanitization/article-html.ts`

Change from DOMPurify config/hooks to a `neosanitize`-backed article sanitizer module.

Required behavior to preserve:

- Allow-list the same article tags and attrs.
- Keep deny-by-default behavior for all unlisted tags and attrs.
- Strip forbidden active/chrome tags with children where current DOMPurify behavior expects full removal:
  - `aside`, `button`, `footer`, `form`, `header`, `iframe`, `input`, `nav`, `noscript`, `script`, `select`, `style`, `svg`, `textarea`
- Preserve class token filtering:
  - `code` keeps `language-*` only.
  - Content/layout tags keep allowed microformat, WordPress-ish, KaTeX, and article prefix tokens.
  - Deny whole-token chrome/ad/promo/sidebar/etc. classes.
- Strip `data-tsd-*`.
- Strip `style` outside `span` and MathML tags.
- Preserve non-empty safe styles on `span` and MathML, relying on `neosanitize` baseline CSS sanitization.
- Add `loading="lazy"` and `decoding="async"` to `img` if missing.
- Remove empty non-void elements after sanitization.

Recommended structure:

- Keep policy constants exported with non-DOMPurify names:
  - `ARTICLE_HTML_ALLOWED_TAGS`
  - `ARTICLE_HTML_ALLOWED_ATTR`
  - `ARTICLE_HTML_DROP_CONTENT_TAGS`
  - `isAllowedArticleClassToken`
  - `sanitizeArticleHtmlFragment`
- Remove DOMPurify-specific exports:
  - `ARTICLE_HTML_PURIFY_CONFIG`
  - `getArticleHtmlSanitizeOptions`
  - `registerArticleHtmlSanitizeHooks`
  - `ArticleHtmlPurifyInstance`
- Build one reusable sanitizer at module scope.
- Use `sanitizeWithReport` in tests or debug-only assertions only if it helps inspect removals.

### Server Reader Sanitizer

File: `apps/api/src/modules/articles/reader/sanitize-content.ts`

Change:

- Remove DOMPurify setup:
  - `createDOMPurify`
  - JSDOM window for DOMPurify
  - `registerArticleHtmlSanitizeHooks`
  - `ARTICLE_HTML_PURIFY_CONFIG`
- Keep JSDOM for existing API post-processing:
  - URL resolution
  - carousel/list artifact removal
  - leading metadata removal
  - `htmlToText`
- Replace `DOMPurify.sanitize(normalized)` with the shared `sanitizeArticleHtmlFragment(normalized)`.

Do not change reader extraction semantics beyond sanitizer engine parity.

### Browser Reader Sanitizer

Files:

- `packages/reader/src/web/html/purify.ts`
- `packages/reader/src/web/html/sanitization.ts`
- `packages/reader/src/web/html/string-prep.ts`
- `packages/reader/package.json`

Change:

- Replace DOMPurify with `neosanitize` through the same shared article policy.
- Remove or collapse the duplicated browser policy file.
- Keep `prepareArticleHtml` order:
  - unwrap redundant inline code markup
  - resolve relative URLs in the browser
  - sanitize
  - normalize figure content
- Keep the browser path free of JSDOM and other Node-only modules.

Preferred implementation:

- Make `@kyomi/worker/sanitization` browser-safe by ensuring the exported sanitization subpath imports only:
  - `neosanitize`
  - local pure constants/functions
  - no DB, queue, JSDOM, Redis, `pg`, or Node-only modules
- Then import `sanitizeArticleHtmlFragment` from `@kyomi/worker/sanitization` in `packages/reader/src/web/html/purify.ts`.
- Add `@kyomi/worker` as an explicit dependency of `@kyomi/reader` only if package typecheck requires it.

Fallback if Vite bundle analysis shows worker package leakage:

- Keep a tiny reader-local sanitizer adapter, but import or generate the pure policy constants from a browser-safe file.
- Do not keep two hand-maintained copies of class filtering rules.

### Dependency Manifests and Lockfile

Files:

- `packages/worker/package.json`
- `packages/reader/package.json`
- `apps/api/package.json`
- `apps/web/package.json`
- `bun.lock`

Change:

- Add `neosanitize` where the importing package needs it directly.
- Remove `dompurify` from `apps/api`, `packages/worker`, and `packages/reader` after all imports are gone.
- Keep `jsdom` in `apps/api` because `sanitize-content.ts` still uses it for post-sanitize DOM cleanup and text extraction.
- Remove direct `neosanitize` from `apps/web` if the web app does not import it after the migration and package ownership lives in worker/reader.

### Tests

Files:

- `tests/api/integration/modules/articles/reader/sanitize-content.test.ts`
- `tests/web/integration/components/reader/render-html.test.tsx`
- Optional new focused fixture file if the existing files become too broad:
  - `tests/api/integration/modules/articles/reader/sanitization-policy.test.ts`
  - `tests/web/integration/packages/reader/sanitization-policy.test.ts`

Add/extend coverage before changing behavior:

- Dangerous markup:
  - `<script>` content removed.
  - `onerror`, `onclick`, and mixed-case event attrs removed.
  - `javascript:` and `vbscript:` removed.
  - non-image `data:` URLs removed.
- HTTP-only policy:
  - relative links/images become absolute via existing URL resolvers.
  - unsafe schemes lose the URL attr.
- Class policy:
  - keep `language-ts` on `code`.
  - strip non-language classes from `code`.
  - keep `author-bio`, `media-object`, `wp-block-*`, `alignwide`, `h-entry`, and KaTeX classes.
  - strip `promo`, `carousel`, `sidebar`, `newsletter`, `sponsored`.
- Attribute policy:
  - strip `data-tsd-*`.
  - strip `style` from `div`.
  - keep safe style on `span` and MathML.
  - add image `loading` and `decoding`.
- Empty cleanup:
  - empty non-void wrappers removed.
  - `br`, `hr`, `img` preserved as void elements.
- Server/browser parity:
  - the same fragment sanitizes to the same relevant DOM shape in API and reader tests.
- Existing API post-processing still works:
  - carousel dot lists removed.
  - legitimate lists preserved.
  - leading article title/byline/excerpt metadata removed when metadata options match.
  - `htmlToText` behavior unchanged.

### Documentation

Files:

- `packages/worker/README.md`
- `packages/reader/README.md`

Update references from DOMPurify to `neosanitize`.

Reader README should explicitly say:

- `@kyomi/reader/web` sanitizes with the same article policy used by the API.
- The browser path uses `neosanitize` browser export behavior and must not import JSDOM or Node-only modules.

Worker README should explicitly say:

- `@kyomi/worker/sanitization` exports the shared article HTML policy and sanitizer.
- The subpath is intentionally browser-safe.

## Implementation Plan

### Phase 1 - Capture Parity Tests

- [x] Extend API sanitizer tests with the missing dangerous URL, event attr, class filtering, style, image normalization, and empty-element cases.
- [x] Extend reader rendering tests with one focused browser parity case that exercises the same class/style/image policy.
- [x] Run the relevant existing tests to confirm they fail only where the current suite lacks assertions, not because the app is already broken.

Status note:

- Reader web target passed.
- API sanitizer target exposed an existing sanitizer gap: `data:text/html` on `img[src]` survives when no base URL is available.
- The API command also ran the broader API suite and hit an unrelated route-registration expectation failure.

Commands:

```bash
bun run --cwd tests test:api:integration ../../tests/api/integration/modules/articles/reader/sanitize-content.test.ts
bun run --cwd tests test:web:integration components/reader/render-html.test.tsx
```

If the package scripts do not accept a path argument cleanly, run:

```bash
bun run --cwd tests test:api:integration
bun run --cwd tests test:web:integration
```

### Phase 2 - Build the neosanitize Policy Adapter

- [x] Refactor `packages/worker/src/sanitization/article-html.ts` to compile a reusable `Sanitizer`.
- [x] Model the allow-list as `PolicyInput` for `Sanitizer.builder`.
- [x] Add explicit post-processing for behaviors formerly implemented as DOMPurify hooks:
  - class filtering
  - `data-tsd-*` stripping
  - style tag restrictions
  - image loading/decoding attrs
  - empty element removal
- [x] Preserve public constants with DOMPurify-neutral names.
- [x] Update `packages/worker/src/sanitization/index.ts`.

Implementation note:

- Do not use `sanitizeUnsafe`.
- Do not switch to `neosanitize/legacy`.
- Do not depend on regex-only HTML rewriting for policy enforcement. Use `neosanitize` for the core sanitization step, then use DOM APIs or `neosanitize/whatwg-parser` helpers for explicit structural post-processing.

### Phase 3 - Wire API Sanitization

- [x] Update `apps/api/src/modules/articles/reader/sanitize-content.ts` to call `sanitizeArticleHtmlFragment`.
- [x] Remove DOMPurify imports and setup.
- [x] Keep JSDOM post-processing unchanged unless a test proves it needs an adapter-level adjustment.
- [x] Re-run API sanitizer tests.

### Phase 4 - Wire Browser Reader Sanitization

- [x] Update `packages/reader/src/web/html/purify.ts` to use the shared article sanitizer.
- [x] Remove or collapse `packages/reader/src/web/html/sanitization.ts`.
- [x] Confirm `packages/reader/src/web/html/string-prep.ts` still resolves URLs before sanitization.
- [x] Confirm `@kyomi/reader/web` does not import JSDOM or other Node-only modules.
- [x] Re-run reader web tests.

### Phase 5 - Dependencies and Docs

- [x] Remove DOMPurify dependencies after imports are gone.
- [x] Add/move `neosanitize` dependency ownership to packages that import it.
- [x] Update `bun.lock`.
- [x] Update worker and reader READMEs.

Status note:

- `bun install` could not complete because the registry certificate chain failed with `UNABLE_TO_GET_ISSUER_CERT_LOCALLY`.
- The existing lock already contained `neosanitize@0.3.0`, so workspace dependency metadata was updated manually.

### Phase 6 - Full Verification

Run:

```bash
bun run --cwd tests test:api:integration ../../tests/api/integration/modules/articles/reader/sanitize-content.test.ts
bun run --cwd tests test:web:integration components/reader/render-html.test.tsx
bun run --cwd packages/reader typecheck
bun run --cwd apps/api typecheck
bun run --cwd apps/web typecheck
bun run typecheck
git diff --check
```

Manual checks:

- Open a real extracted article in the reader.
- Confirm article body renders, images still load, captions/classes still drive reader enhancements, and no publisher chrome appears.
- Inspect the Vite client bundle/dev console for Node-only module resolution errors.

Status note:

- Focused API sanitizer test command passed.
- Focused web reader render test command passed.
- `packages/reader`, `apps/api`, and `apps/web` typechecks passed.
- Root `bun run typecheck` passed after allowing `uv` to access its cache.
- `git diff --check` passed.

## Non-Goals

- Do not redesign reader UI.
- Do not rewrite extraction/readability logic.
- Do not change feed ingestion or favicon logic.
- Do not remove API JSDOM cleanup that is unrelated to sanitizer engine setup.
- Do not introduce a new sanitizer package unless bundle/typecheck evidence shows the worker sanitization subpath cannot stay browser-safe.

## Risk Matrix

| Risk | Impact | Mitigation |
|------|--------|------------|
| Hook behavior drift from DOMPurify to `neosanitize` | Unsafe or broken reader HTML | Golden tests before implementation; explicit post-processing functions |
| Relative URLs become allowed before normalization | Broken links or policy mismatch | Keep URL resolution before sanitization in API and reader |
| Browser imports pull Node-only worker code | Vite build failure or bundle bloat | Keep `@kyomi/worker/sanitization` pure; verify app typecheck/build |
| DOMPurify removed too early | Runtime import errors | Remove deps only after `rg dompurify` is empty |
| Style handling changes | KaTeX/MathML rendering regressions | Preserve style only for `span` and MathML; add tests |
| Class filtering changes | Reader enhancements stop detecting author/media blocks | Add class-token parity tests and reader DOM enhancement tests |

## Plan-Tune Review

Local `plan-tune` probes:

- `question_tuning`: no configured value returned.
- Developer profile sample size: `0`.
- Question preference stats: `TOTAL: 0`.

Refinement from plan-tune:

- No auto-decisions or saved preferences were available.
- Proceed with default behavior: detailed plan, no blocking questions, explicit assumptions.
- Keep implementation phases small because this is security-sensitive and crosses API, worker, reader, and dependency boundaries.

## CEO Review

Mode: HOLD SCOPE with one selective architecture guard.

Premise challenge:

- The user asked to migrate, not merely evaluate. The migration is valid because `neosanitize` is already present in the repo and its main engine offers an explicit, compiled, deny-by-default policy.
- The migration is not a drop-in import swap. The current behavior depends on DOMPurify hooks and API JSDOM cleanup.

Approach options considered:

1. **Legacy compatibility path**
   - Use `neosanitize/legacy`.
   - Completeness: 4/10.
   - Rejected because it emulates `sanitize-html`, not DOMPurify, and does not solve the current hook parity problem cleanly.

2. **Direct main-engine replacement**
   - Replace DOMPurify calls with `Sanitizer.builder(...).build().sanitize(...)`.
   - Completeness: 6/10.
   - Rejected because hook behavior would drift unless custom transformations are rebuilt.

3. **Policy-compatible main-engine adapter**
   - Use the main `neosanitize` engine for core sanitization.
   - Rebuild DOMPurify hook behavior as explicit transformations.
   - Add parity tests first.
   - Completeness: 10/10.
   - Selected.

Scope expansion considered:

- New shared `packages/sanitization` workspace package.
- Deferred. Current workspace facts say shared article sanitization lives in `packages/worker`; the selected plan keeps that ownership and makes the `@kyomi/worker/sanitization` subpath browser-safe. Create a new package only if Vite/typecheck evidence proves worker subpath isolation is not enough.

Completeness checklist:

- User pain: safer, dependency-light sanitization without losing reader fidelity.
- Minimal useful outcome: API and browser reader both sanitize with `neosanitize`.
- Security outcome: current policy preserved and covered by tests.
- UX outcome: reader article body still renders and enhancements still attach.
- Maintenance outcome: duplicated DOMPurify policy removed or collapsed.
- Verification outcome: targeted API/web tests, package typechecks, app typechecks, and diff check.

NO UNRESOLVED DECISIONS.
