# Migrate packages/reader to TanStack Markdown

## Goal

Migrate Kyomi's Markdown parsing and rendering pipeline in `packages/reader` from `marked` and `marked-katex-extension` to `@tanstack/markdown` while preserving feature and security parity across Web, WebView, and Mobile surfaces:

- **Ecosystem alignment**: Integrate `@tanstack/markdown` alongside TanStack Start, TanStack Router, TanStack Query, TanStack Form, and TanStack Virtual.
- **Remove unmaintained dependency surface**: Drop `marked-katex-extension` and its ambient type shim in `packages/reader/src/css.d.ts`. Bundle change is small: current `marked@18.0.12` costs 42.6 KB minified / 12.7 KB gzip plus `marked-katex-extension` at 1.1 KB minified / 0.6 KB gzip (bundlephobia, accessed 2026-09-13); `@tanstack/markdown` v0.0.12 costs 4.9 KB gzip parser + 6.7 KB gzip HTML renderer (TanStack docs, accessed 2026-09-13), plus the new math extension. Net reader-bundle delta is roughly 1 to 2 KB gzip before the math extension. Bundle size is not the headline win; the AST, ecosystem alignment, and dependency hygiene are.
- **Parity guarantees**:
  - GFM tables, task lists, blockquotes, and fenced code blocks with `language-*` class extraction.
  - Safe link and image resolution against `contentBaseUrl` using `normalizeSafeHttpUrl`, wired through a typed TanStack Markdown document extension.
  - Configurable `openLinksInNewTab` behavior (`target="_blank"`, `rel="noopener noreferrer"`).
  - Inline and block TeX math rendering via KaTeX without `marked-katex-extension`, covering the full delimiter set: `$...$`, `$$...$$`, `\(...\)`, `\[...\]`, and `\begin{env}...\end{env}` environments.
  - Inline raw HTML support via `allowHtml: true` (for example `<code>...</code>`), with sanitization ownership unchanged: `sanitizeReaderArticleHtml` on web, `stripDangerousMarkupForWebViewFragment` in the WebView document.
  - Inline redundant tag unwrapping parity (backtick-wrapped literal `<code>...</code>`), re-verified against the new engine's output shape.
  - Full compatibility with existing Web DOM enhancements (`RenderHtml`: code copy buttons, photo preview sliders, link preview cards) and React Native WebView document generation (`createReaderDocument`).

> **Adoption status (decided 2026-09-13, D1-A)**: `@tanstack/markdown` is v0.0.12, announced as first alpha on 2026-07-24. Approximately 20k weekly npm downloads, 1 dependent. Its syntax profile targets repository-authored docs content and explicitly lists "complete CommonMark or GFM conformance" as a non-goal. Kyomi renders arbitrary third-party feed markdown. The user chose to adopt now behind the golden-corpus harness. Binding conditions: exact version pin until stable, corpus report green with no unclassified diffs before merge, and every version upgrade re-runs the corpus harness.

---

## Current Architecture & Pain Points

### Current Component & Call Graph

```
[RSS Feeds / Articles / Clips]
              │
              ▼
   ReaderContent DTO
   bodyKind: "markdown"
   contentMarkdown: string
   contentBaseUrl: string
              │
              ├─── Web Surface (apps/web & apps/mobile DOM) ───────────────┐
              │                                                            │
              ▼                                                            ▼
     <RenderMarkdown>                                            createReaderDocument
    (packages/reader/src/web)                                   (packages/reader/src/webview)
              │                                                            │
              ├─── hasLikelyMarkdownMath?                                  │
              │         │                                                  │
              │         ├── No  ──► readerMarkdownToHtml                   │
              │         │           (packages/reader/src/shared)           │
              │         │                    │                             │
              │         └── Yes ──► readerMarkdownToHtmlWithKatex ◄────────┘
              │                     (packages/reader/src/shared)
              │                              │
              ▼                              ▼
         HTML string                    HTML string
              │                              │
              ▼                              ▼
        <RenderHtml>          stripDangerousMarkupForWebViewFragment
   - photo preview slider                    │
   - link preview cards                      ▼
   - code block copy buttons        Standalone HTML Document
   - highlight.js highlighting      (for React Native WebView)
```

### Current Implementation Details

Verified against the working tree (2026-09-13):

1. **`packages/reader/src/shared/markdown-core.ts`**: Instantiates `new Marked()` with `gfm: true`, `breaks: false`. Custom `Renderer`:
   - `renderer.link`: normalizes via `normalizeSafeHttpUrl(href, baseUrl)`; emits `rel="noopener noreferrer" target="_blank"` when `openLinksInNewTab`.
   - `renderer.image`: resolves relative images against `baseUrl`.
   - `renderer.code`: emits `<pre><code class="language-${lang}">${escapeAttr(text)}</code></pre>`.
2. **`packages/reader/src/shared/markdown-html.ts`**: Parser cache `markedByBaseUrl = Map<string, Marked>` keyed by `${baseUrl ?? ""}|${openLinksInNewTab ? "blank" : "same"}`. Exports `readerMarkdownToHtml(markdown, options?): string`.
3. **`packages/reader/src/shared/markdown-katex.ts`**: Same cache shape; `parser.use(markedKatex({ throwOnError: false }))`. Exports `readerMarkdownToHtmlWithKatex(markdown, options?): string`.
4. **`packages/reader/src/web/components/markdown.tsx`**: `RenderMarkdown` client component. Computes `hasLikelyMarkdownMath(markdown)`; when math is likely, dynamically imports `../katex-runtime` and swaps in KaTeX HTML. Always pipes HTML into `<RenderHtml>`.
5. **`packages/reader/src/web/katex-runtime.ts`**: Delegates to `readerMarkdownToHtmlWithKatex`; also exports `renderMathInHtmlElement` (DOM auto-render, used by `RenderHtml` at `html.tsx:165`) with delimiters `$$`, `\(`, `\[`, `\begin{equation|equation*|align|align*|alignat|alignat*|gather|gather*|CD}`.
6. **`packages/reader/src/webview/create-document.ts`**: Calls `readerMarkdownToHtmlWithKatex` for `bodyKind === "markdown"` (line 32), then passes every body through `stripDangerousMarkupForWebViewFragment` (line 58).
7. **`packages/reader/src/webview/strip-html.ts`**: `stripDangerousMarkupForWebViewFragment` is a regex hardening pass only: strips `<script>` blocks and `on*=` event-handler attributes. It does not screen `javascript:` hrefs inside raw HTML. This is a pre-existing gap shared by both engines once raw HTML is enabled; native CSP and script blocking remain the backstop per the file's contract comment.
8. **`packages/reader/src/web/html/string-prep.ts`**: `prepareArticleHtml` unwraps redundant inline `<code>` markup (regexes shaped to marked's entity-encoded output), resolves relative asset URLs, sanitizes via `sanitizeReaderArticleHtml` (`purify.ts`, neosanitize policy, same as API), then DOM-normalizes figures and implicit TeX.
9. **`packages/reader/src/css.d.ts`**: Ambient declarations for `*.css`, `katex/dist/contrib/auto-render.mjs`, and `marked-katex-extension`. Only the last block is removed by this migration.
10. **`packages/reader/package.json`**: `"marked": "^18.0.0"`, `"marked-katex-extension": "^5.1.8"`, `"katex": "^0.16.45"` (stays).

### Identified Issues with Current Setup

- **Type-system friction**: `marked-katex-extension` types are shimmed by hand in `src/css.d.ts`.
- **Ecosystem divergence**: Kyomi standardizes on TanStack libraries but parses markdown with `marked`.
- **Maintenance risk**: `marked-katex-extension` tracks `marked` internals; breaking changes arrive with every marked major.

---

## Target Architecture with TanStack Markdown

### TanStack Markdown Engine Profile

Verified against TanStack docs and npm (accessed 2026-09-13):

- **Version**: v0.0.12, first alpha announced 2026-07-24. API surface may change before stable.
- **Parser (`@tanstack/markdown`)**: 4.9 KB gzip, zero runtime dependencies, serializable `MarkdownDocument` AST.
- **HTML renderer (`@tanstack/markdown/html`)**: 6.7 KB gzip, `renderHtml(source | document, options?)`, deterministic output.
- **React adapter (`@tanstack/markdown/react`)**: 6.7 KB gzip. Not used by this migration; `RenderHtml` remains the enhancement hub.
- **Security defaults**: raw block and inline HTML are escaped unless `allowHtml: true`; `javascript:`, `vbscript:`, `file:`, and dangerous `data:` URLs are removed by a built-in policy during parsing; renderer escapes text, attributes, code, link titles, and image alt text. `allowHtml: true` is documented as an explicit trusted-content boundary: "not sanitization". Kyomi keeps its independent sanitizers downstream on both paths.
- **URL handling in v0.0.12**: the installed `ParseOptions` declarations do not expose the previously planned `urlTransform` hook. Kyomi uses a typed `transformDocument` extension to traverse declared link and image nodes, call `normalizeSafeHttpUrl`, and drop unsafe destinations. Raw HTML is not screened by this extension and remains the responsibility of downstream sanitizers.
- **Extension hooks**: `parseBlock`, `transformInline`, `transformDocument`, and a `renderHtml` hook for custom trusted HTML emission. No built-in math extension exists; KaTeX integration is custom work (Step 5).
- **Syntax profile (documented subset)**: ATX headings, fenced code (backtick and tilde, language + metadata), tables (delimiter row, alignment, escaped pipes), task lists, ordered/unordered lists, blockquotes, footnotes, thematic breaks, GFM `~~strikethrough~~`, inline code, inline/reference links and images, hard breaks. **Not supported**: indented code blocks, setext headings, autolink literals, full entity decoding ("partial"), and complete CommonMark/GFM conformance as a matter of project goals.
- **Other output deltas vs marked**: headings receive stable duplicate-safe IDs by default (`headingAnchors` links stay opt-in); code fences accept a `highlighter` callback for trusted inner token markup (TanStack Highlight adapter exists; deferred here).

### Target Pipeline

```
Markdown Source
       │
       ▼
TanStack Markdown Engine
┌────────────────────────────────────────────────────────────┐
│  1. Parse (allowHtml: true for raw inline HTML parity)     │
│  2. Typed document extension:                             │
│       - link/image nodes: normalizeSafeHttpUrl(url,       │
│         baseUrl); unsafe nodes become readable text        │
│       - parser protocol policy runs underneath as a        │
│         second defense layer                               │
│  3. Math extension (custom, Step 5):                       │
│       - $...$ $$...$$ \(...\) \[...\] \begin{env}          │
│       - renderHtml hook emits katex.renderToString HTML    │
│         (trusted, throwOnError: false)                     │
│  4. Link attributes (renderHtml hook):                     │
│       - if openLinksInNewTab: target="_blank", rel=...     │
│  5. Code blocks:                                           │
│       - default output <pre><code class="language-*">;     │
│         verify class + escaping at implementation time     │
└────────────────────────────────────────────────────────────┘
       │
       ▼
Rendered HTML String
       │
       ├─── Web: <RenderHtml> -> prepareArticleHtml -> sanitizeReaderArticleHtml
       │        (neosanitize policy; independent defense layer)
       │
       └─── Native WebView: createReaderDocument
                -> stripDangerousMarkupForWebViewFragment (regex hardening;
                   pre-existing raw-HTML URL gap unchanged, CSP backstop)
```

### Architectural Decisions

#### Decision 1: Keep `RenderMarkdown` piping into `RenderHtml`
- **Context**: TanStack Markdown offers `@tanstack/markdown/html` (`renderHtml`) and a React adapter.
- **Rationale**: `RenderHtml` is the hub for photo preview, link preview cards, code copy buttons, image proxying, layout-mode normalization, and sanitization via `prepareArticleHtml`.
- **Conclusion**: Generate sanitized HTML with `@tanstack/markdown/html` and keep piping into `RenderHtml`. No change to the enhancement layer.

#### Decision 2: Custom KaTeX extension over the TanStack extension hooks
- **Context**: `marked-katex-extension` is bound to `marked`. TanStack Markdown ships no math extension.
- **Math ownership split** (prevents double-render and delimiter loss):
  - Parse-time (extension): `$...$`, `$$...$$`, `\(...\)`, `\[...\]`, `\begin{env}...\end{env}` become KaTeX HTML via `katex.renderToString({ throwOnError: false })`, emitted as the declared `inlineHtml` node.
  - DOM-time (unchanged): `prepareArticleHtml` implicit-TeX normalization and `RenderHtml`'s `renderMathInHtmlElement` stay as-is. They already ignore `.katex`, `code`, `pre` ancestors (`string-prep.ts` `MATH_TEXT_IGNORED_ANCESTOR_SELECTOR`, katex-runtime `ignoredTags`), so parse-time output is never re-rendered.
  - `hasLikelyDelimitedTex` already triggers KaTeX loading for `\(`, `\[`, `\begin{}`; the extension must handle all of them or those articles render literal TeX.
- **Conclusion**: One shared math extension in `packages/reader/src/shared`, consumed by both web and WebView paths. `marked-katex-extension` and its `css.d.ts` shim are removed.

#### Decision 3: Preserve the public API of `@kyomi/reader`
- **Context**: `packages/reader/src/web/index.ts` exports `ReaderContent`, `RenderHtml`, `sanitizeReaderArticleHtml`, `RenderMarkdown`, `RenderText`, `ReaderFallback`, `useHighlight`.
- **Conclusion**: Keep all export signatures identical; `apps/web` and `apps/mobile` need no changes.

#### Decision 4 (DECIDED, D1-A): Adopt now behind the golden-corpus harness
- **Context**: The engine works for Kyomi's required feature set (tables, fences, math hooks, typed extensions, allowHtml) but is an alpha whose stated scope is authored docs content, with indented code blocks, setext headings, and autolink literals unsupported, and full CommonMark/GFM conformance a non-goal. Feed markdown is third-party and messier than docs content.
- **Resolution (user, 2026-09-13)**: Adopt now. The corpus harness from Step 0 must run green with no unclassified diffs before merge; the exact version pin holds until a stable release; every upgrade re-runs the corpus harness.

#### Decision 5 (DECIDED, D2-B): Pre-transform indented code; accept remaining deltas
- **Context**: marked (CommonMark/GFM) renders 4-space indented code blocks, setext headings, and bare-URL autolinks. TanStack Markdown renders none of the three and decodes entities only partially. Third-party feeds use all of them.
- **Resolution (user, 2026-09-13)**: 4-space indented code blocks are pre-transformed to fenced fences before rendering (Step 6). During the fold, code inspection found a better seam than an ingestion-time rewrite: `normalizeMarkdownFeedArtifacts` in `apps/api/src/modules/articles/reader/content/markdown.ts` already normalizes feed markdown artifacts, is fence-aware, and runs in the reader-content build path for every article, including already-stored ones (`read/detail.ts` calls `buildStoredReaderContent` with `row.contentMarkdown`). The transform lands there: no DB migration, no worker change, stored articles covered at serve time. Setext headings, bare-URL autolink literals, and partial entity decoding are accepted as documented reader deltas.

---

## Blast Radius Analysis

### Files Inside `packages/reader`

| File | Status | Description |
|------|--------|-------------|
| `packages/reader/package.json` | **MODIFY** | Remove `marked`, `marked-katex-extension`. Add pinned `@tanstack/markdown@0.0.12` (exact pin while alpha). |
| `packages/reader/src/css.d.ts` | **MODIFY** | Remove only the `declare module "marked-katex-extension"` block. `*.css` and `katex/dist/contrib/auto-render.mjs` declarations stay. |
| `packages/reader/src/shared/markdown-core.ts` | **MODIFY** | Typed document extension with `normalizeSafeHttpUrl`, `allowHtml: true`, link-attribute hook, code output verification, `ReaderMarkdownRenderOptions` unchanged. |
| `packages/reader/src/shared/markdown-html.ts` | **MODIFY** | `renderHtml` from `@tanstack/markdown/html`. Stateless render config preferred over the current unbounded Map cache; re-introduce caching only with a measured need and an LRU bound. |
| `packages/reader/src/shared/markdown-katex.ts` | **MODIFY** | Custom math extension using the declared `inlineHtml` node and `katex.renderToString` for the full delimiter set. |
| `packages/reader/src/web/components/markdown.tsx` | **VERIFY** | Structure unchanged: same props, same `hasLikelyMarkdownMath` gate, same dynamic import. Confirm no source edits needed. |
| `packages/reader/src/web/katex-runtime.ts` | **VERIFY** | Imports from shared modules stay identical; DOM delimiter list unchanged. Confirm no source edits needed. |
| `packages/reader/src/web/html/string-prep.ts` | **VERIFY + POSSIBLY MODIFY** | `unwrapRedundantInlineCodeMarkup` regexes are shaped to marked's entity-encoded output. Re-derive against TanStack output; the `:78` test guards this. Comment updates alone are not sufficient. |

Root `bun.lock` changes with the dependency swap. That is expected and untracked in this table.

### Files Outside `packages/reader`

| Location | Status | Description |
|----------|--------|-------------|
| `apps/web/src/modules/reader/components/article/index.tsx` | **NO CHANGE** | Consumes `ReaderContent` via `@kyomi/reader/web`. |
| `apps/mobile/src/modules/reader/components/article-body.dom.tsx` | **NO CHANGE** | Consumes `ReaderContent` via `@kyomi/reader/web`. |
| `packages/reader/src/webview/create-document.ts` | **NO CHANGE** | Calls `readerMarkdownToHtmlWithKatex`; interface unchanged. Sanitization contract (line 58) unchanged. |
| `packages/reader/src/native/reader-body.tsx` | **NO CHANGE** | Unaffected wrapper. |
| `apps/api` | **MODIFY (D2-B, O1-2)** | `reader/content/markdown.ts` converts indented code; feed and clip detail mappers normalize top-level `contentMarkdown` to match nested reader content. |
| `packages/worker` | **NO CHANGE** | Verified: `services/feed/refresh.ts` persists `item.contentMarkdown` as parsed; markdown artifact normalization is the API reader-content seam, not the worker. |

### Test Files to Verify

| Test File | Expected Result |
|-----------|-----------------|
| `tests/web/integration/src/modules/reader/components/article/reader-content.test.tsx` | All **6** test cases pass: tables + fenced code + `$$` math (`:34`), inline HTML (`:64`), backtick unwrap (`:78`), relative link/image resolution (`:91`), eager images on HTML bodies (`:107`, engine-independent), link-only fallback (`:123`, engine-independent). |
| `tests/web/integration/src/modules/reader/services/create-document.test.ts` | All 4 test cases pass: HTML document (`:5`), markdown as HTML (`:21`), script stripping (`:35`), image hiding (`:48`). |
| `tests/web/integration/src/modules/reader/components/article/render-html.test.tsx` | 42 existing DOM-enhancement tests keep passing. |
| `tests/web/integration/src/modules/reader/components/article/sanitization-parity.test.tsx` | 3 sanitization-parity tests keep passing. |

---

## Detailed Implementation Plan

### Step 0: Capture the golden corpus (before any dependency change)
Render a fixture corpus with the current `marked` pipeline and store the output as test fixtures under `tests/web/integration`:
- Corpus inputs: GFM tables, tilde and backtick fences, `$`/`$$`/`\(`/`\[`/`\begin{align}` math, inline raw HTML, backtick-wrapped `<code>` strings, relative links/images, 4-space indented code, setext headings, bare autolink literals, HTML entities, malformed table rows.
- Store paired input/expected-HTML fixtures and a diff harness that reports every output change from the new engine, classified as acceptable (documented delta) or regression.
This is the migration's safety net; it also documents the D2 deltas concretely.

### Step 1: Package dependencies (`packages/reader/package.json`)
```bash
bun remove marked marked-katex-extension --cwd packages/reader
bun add @tanstack/markdown@0.0.12 --exact --cwd packages/reader
```
Exact pin while the package is alpha; upgrade intentionally, not by caret drift. Remove only the `marked-katex-extension` block from `src/css.d.ts`.

### Step 2: Shared Markdown Core (`packages/reader/src/shared/markdown-core.ts`)
- Use the typed `transformDocument` extension to traverse declared link and image nodes, resolve with `normalizeSafeHttpUrl`, and replace unsafe links with their labels or unsafe images with alt text.
- `allowHtml: true` on the parse config. Raw HTML parity requires it (`reader-content.test.tsx:64` fails otherwise). Sanitization remains downstream: `sanitizeReaderArticleHtml` on web, `stripDangerousMarkupForWebViewFragment` in the WebView.
- Link attributes (`target`/`rel`) via the extension `renderHtml` hook when `openLinksInNewTab` is set.
- Verify default fenced-code output emits `<pre><code class="language-*">` with escaped content; adjust via options only if the default differs.
- Keep `ReaderMarkdownRenderOptions = { baseUrl?: string | null; openLinksInNewTab?: boolean }`.

### Step 3: Plain HTML Rendering (`packages/reader/src/shared/markdown-html.ts`)
- Use `renderHtml` from `@tanstack/markdown/html`.
- Keep the exported signature `readerMarkdownToHtml(markdown, options?): string`.
- Prefer a stateless per-call config. The current unbounded `Map` keyed by arbitrary article base URLs grows for the lifetime of the session and buys unmeasured throughput. Re-introduce caching only with a benchmark and an LRU bound.

### Step 4: Golden-corpus reconciliation
Run the corpus harness from Step 0 against the new engine. For every diff: accept and document (syntax-profile deltas from Decision 5), or fix the config/extension. Nothing else proceeds until this list is explicit. With Step 6 in place, indented-code fixtures are expected to render as fenced code; the harness classifies them as mitigated, not accepted.

### Step 5: KaTeX Math Integration (`packages/reader/src/shared/markdown-katex.ts`)
- Extension hooks: `transformInline`/`transformDocument` to locate math spans and emit KaTeX output as the declared `inlineHtml` node. Use `katex.renderToString(tex, { throwOnError: false, displayMode })`.
- Delimiter set: `$...$`, `$$...$$`, `\(...\)`, `\[...\]`, `\begin{env}...\end{env}` (equation, align, alignat, gather, gather*, CD variants, matching `katex-runtime.ts`).
- Keep `readerMarkdownToHtmlWithKatex(markdown, options?): string` and the shared cache discipline from Step 3.
- Do not double-render: `.katex` output is excluded from the DOM pass by existing selectors; verify with a test containing both parse-time math and implicit prose TeX.

### Step 6: Indented-Code Pre-Transform (Decision 5, D2-B)
- **Seam**: extend `normalizeMarkdownFeedArtifacts` in `apps/api/src/modules/articles/reader/content/markdown.ts`. It already runs fence-aware line normalization for every markdown body built by the reader-content pipeline (`buildStoredContentRecord` at write time, `buildStoredReaderContent` and the fallback builders at read time per `read/detail.ts`).
- **Transform**: convert blank-line-preceded blocks of 4+ leading spaces (tabs expanded to 4 columns) into fenced blocks; preserve relative indentation inside the block; leave existing fenced blocks untouched (fence state is already tracked); leave paragraph lazy continuations and list-item continuation lines untouched to avoid corrupting lists.
- **Scope**: markdown bodies only; engine-independent; covers stored and newly ingested articles at serve time. Stored rows are not rewritten.
- **Tests**: unit tests under `tests/api` mirroring `articles/reader/content`: indented block converts, fenced blocks skipped, tab expansion, blank-line requirement, list continuation not converted.

### Step 7: Web Component & WebView Document Sync
- `web/components/markdown.tsx` and `web/katex-runtime.ts`: expected no source changes; verify imports, the math gate, and the dynamic-import path.
- `web/html/string-prep.ts`: re-verify `unwrapRedundantInlineCodeMarkup` against actual new-engine output; modify the regexes only if the output shape differs; the `:78` test is the guard.
- `webview/create-document.ts`: confirm markdown, math, and sanitization flow unchanged via tests.

### Step 8: Verification & Quality Gate
- `bun run --cwd packages/reader typecheck`, `lint`, `fmt:check` (zero ambient shims for removed packages).
- `bun run --cwd apps/api typecheck`, `lint`, `fmt:check` (Step 6 transform).
- Reader integration suites listed above, plus the new regression tests:
  - `target="_blank"` + `rel="noopener noreferrer"` on links (currently untested).
  - `\(...\)` and `\[...\]` math on the web path (currently untested).
  - `.katex` inside the WebView document output for a markdown body (currently untested).
  - Raw-HTML unsafe-URL parity: `javascript:` href in raw HTML is inert on web (sanitizer) and does not regress in the WebView document (pre-existing regex-stripper gap, asserted unchanged).
- Golden-corpus diff report attached to the migration.
- Aggregate static checks: `bun run ci:static`.

---

## What Already Exists vs What Changes

### Reused Without Modification
- `packages/reader/src/core/url.ts`: `normalizeSafeHttpUrl` (all safe-URL verification and relative resolution).
- `packages/reader/src/shared/math.ts`: `hasLikelyMarkdownMath`, `hasLikelyDelimitedTex` (KaTeX load gate; already covers `\(`, `\[`, `\begin{}`).
- `packages/reader/src/web/html.tsx`: `RenderHtml` enhancement hub (copy buttons, photo slider, link previews, DOM math pass).
- `packages/reader/src/web/lib/code-blocks.tsx` and highlight.js setup (explicit fence language only).
- `packages/reader/src/webview/create-document.ts`, `strip-html.ts`, bridge script, styles.
- `sanitizeReaderArticleHtml` (neosanitize policy) and the `prepareArticleHtml` pipeline.

### Replaced
- `marked` -> `@tanstack/markdown` parser + `@tanstack/markdown/html`.
- `marked-katex-extension` -> custom TanStack math extension (Decision 2).
- `packages/reader/src/css.d.ts` `marked-katex-extension` shim -> removed.
- `markdown-html.ts` instance cache -> stateless config (unless a measured need returns it bounded).

### Added
- `apps/api` `normalizeMarkdownFeedArtifacts`: fence-aware indented-code to fenced-fence pre-transform at the reader-content boundary (Decision 5, D2-B; Step 6, T8).

---

## NOT in Scope
- **Direct AST rendering in React via `<Markdown>`**: Deferred. Rewriting photo preview, link previews, and copy buttons as React trees expands blast radius with no user-visible benefit.
- **Syntax highlighter migration to the TanStack Highlight adapter**: Deferred. The calibrated highlight.js setup (explicit fence language only, no auto-detection) stays; the `highlighter` callback seam is documented for a later pass.
- **Server-side markdown parsing in `apps/api`**: Deferred. The API persists markdown text; parsing stays on client/renderer boundaries.
- **Hardening `stripDangerousMarkupForWebViewFragment` for raw-HTML URLs**: Deferred. The regex-only WebView hardening and its raw-HTML `javascript:` href gap predate this migration and are identical under both engines (allowHtml raw HTML is not URL-screened by the parser either). Native CSP remains the backstop. Fixing it means a real WebView-side sanitizer and is its own change; asserted non-regressed by test in Step 8.
- **Parser-cache benchmarking**: Deferred. Stateless-first; a benchmark-driven bounded cache is a follow-up if profiling shows need.

---

## Syntax-Profile Parity Deltas (Decision 5 resolved by D2-B)

| Input class | marked today | TanStack Markdown | Risk | Mitigation if accepted |
|-------------|--------------|-------------------|------|------------------------|
| 4-space indented code blocks | `<pre><code>` | Not supported; renders as text | Mitigated: `normalizeMarkdownFeedArtifacts` converts them to fenced fences at reader-content build time (D2-B, Step 6); covers stored and new articles |
| Setext headings (`===`, `---`) | `<h1>`/`<h2>` | Not supported | Low-medium | Document as delta |
| Bare autolink literals (`http://...` in prose) | Linked (GFM) | Plain text; angle autolinks still work | Medium: RSS prose often has bare URLs | Accepted documented delta (D2-B resolution) |
| Entity decoding | CommonMark behavior | Partial; HTML is escaped | Low | Golden corpus documents the exact behavior |
| Heading output | No IDs | Stable duplicate-safe IDs on all headings | Cosmetic; benefits anchors | Accept; note in diff report |

---

## Engineering Review & Refinement (gstack plan-tune & plan-eng-review, run 2)

### Scope Challenge (Step 0)
1. **Existing code reuse**: Verified. `normalizeSafeHttpUrl`, `hasLikelyMarkdownMath`, `RenderHtml`, `createReaderDocument`, and both sanitizers are reused unchanged.
2. **Minimum set of changes**: 8 files inside `packages/reader`, 3 API files, test files, and the root lockfile. No changes in `apps/web`, `apps/mobile`, or `packages/worker`.
3. **Complexity check**: Passes. 8 files is at, not over, the 8-file smell threshold; zero new services or classes; the math extension is one module in an existing directory.
4. **Search check**: Performed. `@tanstack/markdown@0.0.12` is verified real. Installed declarations expose `renderHtml`, `allowHtml`, `extensions`, `transformInline`, and `transformDocument`, but no `urlTransform` or custom node registry. The typed document extension and declared `inlineHtml` math output are used instead. It remains a first alpha and is protected by the corpus gate.
5. **TODOS cross-reference**: `TODOS.md` holds one deferred item (Playwright visual-regression harness); unrelated and not blocking. New follow-up candidates from this review: bounded parser-cache benchmark, WebView-side raw-HTML URL hardening. Not added without approval.
6. **Completeness check**: Shortcuts found and folded in: golden corpus before the swap (Step 0/4), full math delimiter set (was `$`/`$$` only), `allowHtml` (was unstated), regression tests for currently untested paths, unsafe-URL parity assertion.

### Execution & Test Coverage Map

```
EXECUTION PATH                                          TEST COVERAGE
[+] packages/reader/src/shared/markdown-core.ts
  ├── link rendering (baseUrl + new tab)                ├── [★★  TESTED] reader-content.test.tsx:91 (href only; target/rel GAP -> Step 8 test)
  ├── image rendering (baseUrl resolution)              ├── [★★  TESTED] reader-content.test.tsx:91
  ├── raw inline HTML passthrough (allowHtml)           ├── [★★  TESTED] reader-content.test.tsx:64
  └── code fence language class                         ├── [★★  TESTED] reader-content.test.tsx:34
[+] packages/reader/src/shared/markdown-katex.ts
  ├── $$ math (web + webview)                           ├── [★★  TESTED] :34 (web) | GAP webview -> Step 8 test
  ├── \( \) \[ \] \begin{} delimiters                   ├── [GAP] untested today -> Step 8 test
  └── no double-render with DOM implicit-Tex pass       ├── [GAP] -> Step 8 test
[+] packages/reader/src/web/html/string-prep.ts
  └── backtick-wrapped <code> unwrap                    ├── [★★  TESTED] reader-content.test.tsx:78
[+] packages/reader/src/webview/create-document.ts
  └── markdown bodyKind in WebView document             ├── [★★  TESTED] create-document.test.ts:21
  └── unsafe raw-HTML URL parity (pre-existing gap)     ├── [GAP] -> Step 8 assertion test
[+] apps/api reader content (D2-B)
  └── indented-code -> fenced transform                 ├── [GAP] -> Step 6 unit tests
[+] Differential parity vs marked
  └── golden corpus (tables, fences, math, HTML,        ├── [GAP] -> Step 0/4 harness
      indented code, setext, autolinks, entities)

COVERAGE: today 6/14 paths exercised; Step 0, Step 6, and Step 8 close all listed gaps.
QUALITY: ★★: 6  |  GAPS: 8 (assigned to Step 0, Step 4, Step 6, or Step 8)
```

### Potential Failure Modes & Mitigation

| Failure Mode | Risk | Mitigation |
|--------------|------|------------|
| Unsafe scheme in raw HTML (`<a href="javascript:...">`) | High | The typed document extension does not screen raw HTML. Web: `sanitizeReaderArticleHtml` strips it through the existing policy. WebView: `stripDangerousMarkupForWebViewFragment` does not screen hrefs, a pre-existing gap documented in NOT in Scope, with native CSP as backstop; Step 7 asserts no regression. |
| `\(`, `\[`, `\begin{}` math missed by the new extension | High | Decision 2 mandates the full delimiter set; `hasLikelyDelimitedTex` already gates loading on them; Step 7 adds tests. |
| Double-render of math (parse-time + DOM auto-render) | Medium | Ownership split in Decision 2; `.katex` excluded from the DOM pass by `MATH_TEXT_IGNORED_ANCESTOR_SELECTOR`; test both math classes in one article. |
| Dollar signs in prose parsed as math | Low | `hasLikelyMarkdownMath` heuristics (`/\d\s*[-+*/=]\s*\d/`, `/[\\^_=]/`) gate KaTeX loading; `throwOnError: false` degrades gracefully. |
| Syntax-profile deltas (setext, autolinks, entities) silently change feed rendering | Low | Golden corpus surfaces every diff before merge; acceptance per Decision 5 (D2-B): indented code mitigated in Step 6, the rest documented. |
| Indented-code transform corrupts lists or nested fences | Medium | Fence state is already tracked in `normalizeMarkdownFeedArtifacts`; Step 6 requires blank-line-preceded blocks and skips list continuations; unit tests cover tab expansion and list safety. |
| Malformed table markdown | Low | Tables are a documented supported feature with escaped-pipe handling; malformed-input determinism is a stated engine property. Corpus includes malformed rows. |
| Indented-code transform corrupts lists or nested fences | Medium | Fence state is already tracked in `normalizeMarkdownFeedArtifacts`; Step 6 requires blank-line-preceded blocks and skips list continuations; unit tests cover tab expansion and list safety. |
| Alpha API churn breaks the build on upgrade | Medium | Exact version pin; upgrade is a deliberate change re-running the corpus harness. |

### Worktree Parallelization Strategy
- **Sequential implementation**: changes live in `packages/reader/src/shared`, `apps/api` reader content (Step 6), and test files. Single lane: Step 0 corpus -> Steps 1-3 -> Step 4 reconcile -> Steps 5-7 -> Step 8 gate. T8 is engine-independent and may land before reconciliation.

---

## Implementation Tasks

- [ ] **T0 (P1, human: ~2h / CC: ~15min)** — tests: capture the golden corpus from marked (Step 0 fixture set + diff harness).
- [ ] **T1 (P1, human: ~30m / CC: ~10min)** — packages/reader: swap deps (`bun remove marked marked-katex-extension`; `bun add @tanstack/markdown@0.0.12 --exact`), trim `css.d.ts` to remove only the `marked-katex-extension` block.
- [ ] **T2 (P1, human: ~2h / CC: ~25min)** — packages/reader: `markdown-core.ts` typed document extension with `normalizeSafeHttpUrl`, `allowHtml: true`, link-attribute hook, code output verification.
- [ ] **T3 (P1, human: ~1h / CC: ~10min)** — packages/reader: `markdown-html.ts` via `renderHtml`; stateless config replacing the unbounded Map.
- [ ] **T4 (P1, human: ~4h / CC: ~30min)** — packages/reader: math extension with the full delimiter set through `katex.renderToString` and the declared `inlineHtml` node; double-render guard test.
- [ ] **T5 (P1, human: ~2h / CC: ~15min)** — packages/reader: verify `markdown.tsx`, `katex-runtime.ts` (no edits expected); re-derive `string-prep.ts` unwrap regexes against new output if needed.
- [ ] **T6 (P1, human: ~3h / CC: ~30min)** — tests: golden-corpus reconciliation report (Step 4) plus Step 7 regression tests: target/rel, `\(` `\[` delimiters, webview `.katex`, unsafe raw-HTML URL parity web+webview.
- [ ] **T7 (P1, human: ~1h / CC: ~10min)** — verification: reader and API typecheck, lint, fmt:check, integration suites, `bun run ci:static`.
- [ ] **T8 (P1, human: ~2h / CC: ~20min)** — apps/api: extend `normalizeMarkdownFeedArtifacts` with fence-aware indented-code to fenced-fence conversion, normalize top-level feed and clip detail `contentMarkdown`, and add mapper and `tests/api` unit tests; engine-independent, can land before the dependency swap.

---

## GSTACK REVIEW REPORT

| Review | Runs | Status | Findings |
|--------|------|--------|----------|
| Scope Gate | 1 | CLEAR | User-named target: this plan file. Review target confirmed without prompt. |
| Step 0: Scope Challenge | 2 | CLEAR | 8 reader files, 3 API files, tests, and lockfile; reuse verified; alpha dependency and v0.0.12 declaration limits are documented. |
| Architecture Review | 2 | 4 FINDINGS | A1 alpha adoption (resolved: D1-A chosen 2026-09-13, adopt behind corpus harness); A2 math delimiter parity gap (fixed in plan); A3 allowHtml + sanitizer ownership (fixed in plan); A4 output-shape deltas incl. heading IDs (documented; D2-B mitigates indented code). |
| Code Quality Review | 2 | 2 FINDINGS | C1 string-prep unwrap regexes are engine-output coupled, re-derive not comment-edit (folded into T5); C2 unbounded parser cache replaced by stateless-first (folded into T3). |
| Test Review | 2 | 7 GAPS | Test-count claim corrected 5 -> 6; coverage map line cites verified; gaps assigned: golden corpus (T0), target/rel, backslash delimiters, webview math, double-render, webview unsafe-URL parity (T6). |
| Performance Review | 2 | 1 FINDING | Bundle claims corrected: 42.6 KB min / 12.7 KB gzip (marked 18.0.12) vs 4.9 + 6.7 KB gzip; net ~1-2 KB gzip, not "~40 KB". Goal reframed on dependency hygiene + ecosystem, not size. |
| Outside Voice (codex, gpt-5.6-terra) | 1 | 8 FINDINGS | Dependency unvalidated (now pinned + API-verified); security-parity overclaim (now scoped with evidence); math ownership (defined); test coverage fiction (regression tests added); no differential harness (T0 added); unbounded cache (stateless-first); 5-vs-8 file contradiction (corrected); ecosystem-alignment justification challenged (D1). |

| User Decisions | 2 | RESOLVED | D1-A chosen: adopt `@tanstack/markdown` 0.0.12 now behind the golden-corpus harness. D2-B chosen: pre-transform indented code; fold inspection relocated the transform to the existing `normalizeMarkdownFeedArtifacts` reader-content seam (serve-time; covers stored articles). Setext headings, autolink literals, and entity decoding accepted as documented deltas. |

**VERDICT: APPROVED (conditional)** — both decisions resolved by the user on 2026-09-13. Conditions: exact version pin until stable; corpus harness green with no unclassified diffs before merge; Step 6 transform landed and unit-tested before reconciliation classifies indented-code fixtures.

**RESOLVED DECISIONS (user, 2026-09-13):**
- **D1-A**: Adopt `@tanstack/markdown` v0.0.12 now, behind the golden-corpus harness (Steps 0 and 4).
- **D2-B**: Pre-transform indented code to fenced fences in `normalizeMarkdownFeedArtifacts` (Step 6, T8); accept setext headings, bare autolink literals, and partial entity decoding as documented deltas.

NO UNRESOLVED DECISIONS.
