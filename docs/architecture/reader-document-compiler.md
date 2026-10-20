# Reader Document Compiler

Status: accepted 2026-10-20. Phase 0 shipped passes 2–6, 8, and 9 in
`packages/worker/src/document/` (`@kyomi/worker/document`), wired into feed refresh, extraction, and
clip writes (plan: `docs/superpowers/plans/2026-10-20-reader-sanitizer-v2.md`). The schema the later
passes target is `packages/reader/src/core/document/`, exported as `@kyomi/reader/document`.

## Goal

Compile every article body once, at ingest, into the Kyomi Document Model (KDM): a typed,
renderer-neutral tree. The target is semantic fidelity with the source: every element the author
published appears in order with its intent (wide image, pull quote, gallery, footnote, embed,
math, code language) rendered in Kyomi typography. Pixel fidelity stays the job of "Original" mode.

The compiler replaces work that is currently split across three places and runs after paint:

| Today                                                                                    | Moves into       |
| ---------------------------------------------------------------------------------------- | ---------------- |
| `apps/api/src/modules/articles/reader/content/normalize.ts`, `sanitize.ts`               | passes 2–8       |
| `packages/reader/src/web/html/*` (caption, profile, media, carousel, image, string-prep) | passes 7, 10, 16 |
| `packages/reader/src/core/code-language.ts`, `web/lib/code-block.tsx` highlighting       | pass 12          |
| `web/html/string-prep.ts` implicit TeX, `web/katex-runtime.ts`                           | pass 13          |

## Ownership

| Concern                                                      | Owner                                                                                  |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| KDM schema and types (runtime-neutral contract)              | `packages/reader/src/core/document/`                                                   |
| Compiler and passes (Node-only: linkedom, Shiki, KaTeX)      | `packages/worker/src/document/`, exported as `@kyomi/worker/document`                  |
| Calling the compiler on refresh, extraction, clips, backfill | `apps/api` ingestion and `articles/reader/extraction`                                  |
| `content_document`, `document_version`, retained raw source  | `packages/db/src/schema/articles.ts`                                                   |
| Renderers                                                    | `packages/reader/src/web` (React blocks on `@kyomi/ui`), `packages/reader/src/webview` |

Markdown stays on `@tanstack/markdown` (exact pin, per decision D1-A in
`docs/superpowers/plans/2026-09-13-tanstack-markdown-migration.md`). Its AST is lowered to KDM
directly; `html` and `inlineHtml` nodes go through the HTML passes.

## Passes

Passes run in order. Each pass is a pure function over one tree with its own fixture tests.
Phase 0 runs pass 4 (`unlazy-media`) before pass 3 (`resolve-urls`) so promoted lazy URLs are
resolved too; see `ARTICLE_COMPILE_PASSES` in `packages/worker/src/document/compile.ts`.

Phase 0 status: passes 2–6, 8, and 9 are shipped. Beyond the table, pass 3 also rewrites ids to
`kyomi-` anchors and fixes in-page links, pass 6 also records task-list state
(`li[data-kyomi-checked]`) and drops Chroma line-number gutters and publisher token colours, and
pass 8 also drops `label` and MathML `annotation-xml`. Pass 7 is deferred to Phase 1, which can
derive it from retained raw source. Read paths never run these passes; they re-apply the policy and
strip `data-kyomi-*` unless the row's stored sanitizer version is current.
Stage A and B operate on a linkedom DOM, stage C on KDM.

### Stage A: input

| #   | Pass            | Does                                                                                                                                                                                                               | Notes                                                |
| --- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| 0   | `select-source` | Picks the body: extracted HTML, `content:encoded`, Atom `content`, then `description`. Records `source.origin` and `source.format`. Collects `media:group`, `media:content`, and `enclosure` for the media passes. | Origin values reuse `ReaderContentSource`.           |
| 1   | `parse`         | HTML → linkedom fragment. Markdown → TanStack AST, with raw HTML nodes parsed as fragments. Text → paragraphs on blank lines.                                                                                      | Size caps before parsing (bytes, node count, depth). |

### Stage B: DOM passes (HTML path, before and through sanitizing)

Several fidelity signals (iframe `src`, publisher classes, `data-*` language hints) are deleted by
the sanitizer, so they are captured first as compiler-owned `data-kyomi-*` attributes.

| #   | Pass                 | Does                                                                                                                                                                                                                                                                                                                  | Security note                                                      |
| --- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| 2   | `strip-reserved`     | Removes every incoming `data-kyomi-*` attribute and `kyomi-*` element.                                                                                                                                                                                                                                                | Required: otherwise a feed could forge compiler hints.             |
| 3   | `resolve-urls`       | Absolutizes `href`, `src`, `srcset`, `poster` against `baseUrl`; drops non-http(s). Keeps `#fragment` links for pass 11.                                                                                                                                                                                              | Replaces the two duplicated resolvers.                             |
| 4   | `unlazy-media`       | Promotes `data-src`, `data-srcset`, `data-lazy-src`, and `<noscript>` fallback images to real attributes.                                                                                                                                                                                                             | Many publishers ship placeholder `src` values.                     |
| 5   | `recognize-embeds`   | Turns provider iframes, `blockquote.twitter-tweet` / `instagram-media` / `tiktok-embed` / `bluesky-embed`, Gist scripts, and bare-link paragraphs into `figure[data-kyomi-embed][data-kyomi-url]` holding a plain link to the post; a CMS figure that holds only the embed is reused.                                 | Only the canonical URL survives; source iframe `src` is discarded. |
| 6   | `capture-code-hints` | Reads `language-*`, `lang-*`, `highlight-source-*`, `brush:`, `data-lang`, WordPress and Prism hints, filenames from titles or captions, and highlighted lines into `data-kyomi-lang`, `-filename`, `-lines`.                                                                                                         |                                                                    |
| 7   | `capture-layout`     | Maps `alignwide`/`alignfull`/`alignleft`/`alignright`, Ghost `kg-width-*`, `wp-block-gallery`, `wp-block-media-text`, Substack and Medium figure markup into `data-kyomi-placement` / `-gallery` / `-media-text`. Publisher adapters (keyed by host or `generator` meta) hook in here.                                |                                                                    |
| 8   | `strip-chrome`       | Removes carousel dots, share bars, author cards, newsletter CTAs, Medium "click to view" placeholders. Counts each removal in `diagnostics.droppedElements`.                                                                                                                                                          | Conservative: never matches whole-article wrappers.                |
| 9   | `sanitize`           | neosanitize with the v2 allowlist (adds `b i u s del ins kbd var small cite q time dl dt dd caption tfoot picture source video audio`, extended MathML, `srcset sizes start datetime poster id`). Keeps `data-kyomi-*` hints only because pass 2 guaranteed they are compiler-made; `kyomi-*` elements never survive. | Bumps `ARTICLE_HTML_SANITIZER_VERSION`.                            |

### Stage C: lowering and KDM passes

| #   | Pass        | Does                                                                                                                                                                                                                                                                      |
| --- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 10  | `lower`     | Walks the DOM or Markdown AST into KDM blocks and inlines. Unwraps structural `div`/`section` wrappers. Content that is safe but not representable becomes an `html` block with a `reason`.                                                                               |
| 11  | `figures`   | Pairs images with `figcaption` or adjacent caption and credit lines, clears `alt` that duplicates the caption, applies `placement`, groups consecutive or hinted images into `gallery`, builds `mediaText`.                                                               |
| 12  | `footnotes` | Collects definitions (`.footnotes`, `#fn*` targets, Markdown `[^n]`), rewrites references to `footnoteRef`, assigns stable `fn-*` anchors, marks sidenotes when the source authored them.                                                                                 |
| 13  | `code`      | Resolves the language: explicit hint, then filename extension, then shebang or modeline, else `null` with `languageSource: "none"`. A server-side classifier is deferred (decision 7). Highlights with pinned Shiki into dual-theme tokens; skips tokens past a size cap. |
| 14  | `math`      | Finds explicit delimiters in text outside code. TeX → KaTeX `htmlAndMathml` with `trust: false` and expansion limits into `rendered`; render errors keep `tex` only. Publisher MathML is kept as `mathml`. No implicit-TeX guessing in prose.                             |
| 15  | `embeds`    | Lowers `kyomi-embed` to `embed` blocks. Builds `frameUrl` only from the provider allowlist template (e.g. `youtube-nocookie.com/embed/{id}`). Unknown providers become `linkCard`.                                                                                        |
| 16  | `normalize` | Merges adjacent text, trims whitespace, drops empty nodes, unwraps nested links, removes a leading heading equal to `meta.title`, shifts headings so the shallowest is 2, moves a duplicated hero image to `meta.leadImage`.                                              |
| 17  | `derive`    | Fills `features`, `wordCount`, `readingMinutes`, and `diagnostics.htmlBlocks`.                                                                                                                                                                                            |
| 18  | `validate`  | `readerDocumentSchema.parse` plus invariants Zod cannot express (below). On failure, persist nothing new and fall back to the current `text` body with a warning.                                                                                                         |

### Async enrichment (queue jobs that patch a stored document)

| Job              | Does                                                                                                                                               |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `embed-snapshot` | Fetches post text, author, and media for X, Bluesky, Mastodon, Threads, Instagram through the worker's SSRF-safe fetcher; writes `embed.snapshot`. |
| `image-measure`  | Probes missing `width`/`height` through the image proxy and computes thumbhash `placeholder`.                                                      |

## Invariants checked in `validate`

- Anchors are unique across blocks and footnotes.
- Every `footnoteRef.id` and `#fragment` link resolves to an anchor in the document.
- No `link` inline contains another `link`.
- `embed.frameUrl`, when present, matches its provider's allowlist template.
- Highlight `[text, styleIndex]` indexes are in range, and joined token text equals `value`.
- `features` matches the tree.

## Versioning and recompile

- `READER_DOCUMENT_VERSION` changes when the schema changes shape. The compiler version changes
  when output changes. Both are stored with the document.
- Raw source is retained (`content_raw` and `extracted_content_raw` on feed items and clips,
  `raw_html` on the extraction cache, all `lz4`-compressed) so a compiler change can be backfilled
  to existing articles instead of only new ones. The backfill does not recompile from it yet.
- During rollout the API serves `bodyKind: "document"` alongside the current HTML body, and
  renderers fall back to the HTML path when no document exists.

## Verification

- Pass-level tests, one file per pass, under
  `tests/api/integration/modules/articles/reader/content/compile/` (the compiler runs in Node).
- The HTML fidelity corpus in `tests/api/fixtures/articles/corpus/`: 20 publisher archetypes with
  authored checks and a recorded baseline per sanitizer version (v1: 78 of 176, v2: 176 of 176).
  Phase 1 extends it with expected KDM, text recall, element recall per type, order, and
  `htmlBlocks` count per fixture. Markdown keeps its own corpus in
  `tests/web/integration/src/packages/reader/markdown-corpus.test.tsx`.

## Decisions (accepted 2026-10-20)

1. **Inline shape:** nested `format` nodes, mirroring the DOM and the TanStack AST. Flat
   ProseMirror-style marks were rejected.
2. **Highlighting:** tokens are stored in the document, so clients ship no highlighter and web and
   WebView render identically. Render-time highlighting was rejected.
3. **Math output:** stored KaTeX `htmlAndMathml`, with KaTeX CSS loaded only when
   `features.math`. Temml MathML-only output was rejected for browser-dependent rendering.
4. **Table cells** hold blocks, so publisher tables with lists survive.
5. **Entrypoint:** `@kyomi/reader/document`, so importing `@kyomi/reader/core` does not pull in Zod.
6. **`html` escape hatch:** kept, counted in `diagnostics.htmlBlocks`, and driven toward zero by
   the corpus.
7. **Language classifier:** deferred. Phase 1 ships the explicit, filename, and shebang chain only;
   the classifier is reconsidered once the corpus shows how often hints are missing.
8. **Raw source storage:** a `content_raw` text column with Postgres `lz4` TOAST compression. No
   object storage dependency.
