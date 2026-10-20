# Reader Phase 0: Sanitizer v2

## Goal

Stop losing article content at ingest, inside the current HTML pipeline, using code that becomes
passes 2–6, 8, and 9 of the Reader Document Compiler
(`docs/architecture/reader-document-compiler.md`) without rework.

Phase 0 is split. This plan covers sanitizer v2 (0a). Shiki highlighting (0b) and feed media
parsing into `articles.media` (0c) get their own plans because they touch different owners.

Success means a new article keeps:

- Publisher emphasis, strikethrough, keyboard keys, definition lists, table captions, and footers.
- Working footnotes and in-page anchors.
- Responsive images (`srcset`, `<picture>`), lazy-loaded images, and intrinsic dimensions with no
  layout shift.
- Direct `<video>` and `<audio>`.
- A visible, linked placeholder for every recognized embed instead of nothing.
- Language hints for code blocks that the class filter currently drops.
- Its raw source, so Phase 1 can recompile it.

## Current State

Facts confirmed in code on 2026-10-20.

### The policy loses content

A probe of `sanitizeArticleHtmlFragment` showed `i b s kbd dl dt dd caption picture video` flattened
or removed, `id` and `ol start` dropped, and `iframe` removed with its content.
`normalizeElementAttributes` then deletes any `href` that is not `http(s)://`, which kills
`#fn1` footnote links (`packages/worker/src/sanitization/article-html.ts:361-381`).

### The drop-content list is not enforced

`ARTICLE_HTML_DROP_CONTENT_TAGS` (`article-html.ts:100-115`) is exported but never passed to
neosanitize. The builder takes only `{ tags, attrs }` (`:291-296`), and neosanitize 0.3.0's
`deny(tag)` only removes a tag from the allowlist. Disallowed tags are unwrapped unless they are
in neosanitize's own fixed list (script, style, textarea, noscript, iframe, template, and a few
others). So `aside button footer form header input nav select svg` lose their tag but keep their
text today. neosanitize has no hooks, so dropping with content needs a DOM pre-pass.

### Where sanitization runs

| Path                  | Code                                                                | Behaviour today                                                                                                                                                                                   |
| --------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Feed refresh (ingest) | `packages/worker/src/lib/feed-text.ts:34` `sanitizeStoredContent`   | Fragment sanitize only, no normalize, no URL resolution, never stamps `content_sanitizer_version`. Upsert keeps existing HTML on conflict (`refresh.ts:1039`), so stored HTML is never rewritten. |
| Extraction (ingest)   | `extraction/readability.ts:124` → `processArticleHtml`              | Resolve `a`/`img` URLs, sanitize, normalize, strip carousels and leading metadata. Stamps the version. Cache hits are reprocessed and persisted (`workflow.ts:84-98`).                            |
| Clips (write)         | `write/clips/operations.ts:143-170`                                 | Stores client-provided `contentHtml` unsanitized; sanitized on read.                                                                                                                              |
| Stored read           | `content/normalize.ts:141,211` → `sanitizeArticleHtml`              | Re-sanitizes original content on every read. Extracted content is re-sanitized only on version mismatch, and not persisted.                                                                       |
| Browser               | `packages/reader/src/web/html/purify.ts` via `string-prep.ts:192`   | Same two worker functions on the API output.                                                                                                                                                      |
| Backfill              | `apps/api/src/app/boot/sanitizer.ts` (`content:sanitizer-backfill`) | Re-runs the policy on stored HTML. Does not pass `baseUrl`.                                                                                                                                       |
| WebView               | `packages/reader/src/webview`                                       | Regex script stripping only. `WebViewReaderBody` has no consumer; mobile renders the web `ReaderContent` in Expo DOM.                                                                             |

### Images and proxying

- `string-prep.ts:137-138,153-154` strips `width`/`height` from every image, which causes layout
  shift.
- The image proxy rewrite (`web/html/url-resolve.ts:33-49`) covers `img[src]` only. Only mobile
  passes `transformImageUrl` (`article-body.dom.tsx:215-217`); apps/web loads images directly.
- No Content-Security-Policy is set anywhere.

## Decisions

1. **Compile at write time; apply only the policy when reading.** A new `compileArticleHtml(raw, { baseUrl })` runs
   the ingest passes once. The read path and the browser keep running only the policy and
   normalization (`sanitizeStoredArticleHtml`). The ingest passes must not run on stored HTML,
   because pass 2 would strip the compiler's own `data-kyomi-*` hints.
2. **Reserved-attribute invariant.** v1 output cannot contain `data-*` attributes, and every v2
   write goes through `compileArticleHtml`, which strips incoming `data-kyomi-*` first. So any
   `data-kyomi-*` in stored HTML was produced by the compiler. Renderers still revalidate URLs
   from these attributes.
3. **Owner.** `compileArticleHtml` and its passes live in `packages/worker/src/document/` and are
   exported as `@kyomi/worker/document` (Node-only, adds `linkedom`). The policy stays in
   `@kyomi/worker/sanitization`, which stays browser-safe.
4. **Retain raw source now (decision 8).** Without it, v2 and Phase 1 only help new articles,
   because v1 output has already lost the content. Raw source goes in a `content_raw` column with
   `lz4` compression and is never serialized to clients.
5. **No backfill of the policy.** Re-running v2 on v1-stored HTML recovers nothing. Existing
   extracted articles recover by re-extraction; existing feed items do not recover. The backfill
   script only gains `baseUrl`.
6. **Keep `aside`; drop interactive chrome.** In feed bodies `aside` is usually a note or pull
   quote, so it becomes an allowed tag. `nav form button input select textarea svg` are dropped
   with their content. `footer` inside `blockquote` or `figure` is kept as attribution; other
   footers are dropped. `header` stays unwrapped, because it often holds the title or byline that
   later passes dedupe.
7. **No iframes in Phase 0.** Embeds become linked placeholders that the existing link-preview
   cards pick up. Click-to-load players and `frame-src` CSP arrive in Phase 2.
8. **Media privacy.** Images, `srcset` candidates, and `poster` go through `transformImageUrl`
   when it is set. Video and audio files are not proxied (the proxy is `image/*` only), so they
   are forced to `preload="none"` and make no request until played.

## Policy v2

`ARTICLE_HTML_SANITIZER_VERSION` becomes `article-html-v2`. Attributes move from the `"*"` bucket to
per-tag lists, which neosanitize supports.

| Change              | Items                                                                                                                                                                                                                                  |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tags added          | `b i u s del ins kbd samp var small cite q time dl dt dd caption tfoot picture source video audio aside footer ruby rt rp bdi wbr`                                                                                                     |
| MathML added        | `mtable mtr mtd msubsup munderover mroot mspace mstyle mpadded menclose mmultiscripts mprescripts mphantom`; `annotation-xml` and `maction` stay excluded                                                                              |
| Global attributes   | `lang dir`, plus `id` (pass 3 rewrites every id to `kyomi-<slug>`)                                                                                                                                                                     |
| Per-tag attributes  | `img: srcset sizes`; `source: srcset sizes media type src`; `ol: start reversed`; `li: value`; `time del ins: datetime`; `video: src poster controls preload playsinline width height`; `audio: src controls preload`; `details: open` |
| Compiler attributes | `pre: data-kyomi-lang data-kyomi-filename data-kyomi-lines`; `figure: data-kyomi-embed data-kyomi-url`; `li: data-kyomi-checked`                                                                                                       |
| URL rules           | `href` accepts `http(s)` or `#kyomi-[a-z0-9-]{1,64}`. Each `srcset` candidate must be `http(s)`, and at most 8 are kept. `poster` and `source[src]` must be `http(s)`                                                                  |
| Forced values       | `video`/`audio`: `controls` set, `preload="none"`, never `autoplay`, `loop`, or `muted`                                                                                                                                                |

## Passes Implemented in Phase 0

Each pass is a function `(root: ParentNode, context) => void` in
`packages/worker/src/document/passes/<name>.ts`, so Phase 1 reuses it unchanged. Pass 7 (layout
hints) is deferred: with raw source retained, Phase 1 can derive it, and Phase 0 has no consumer.

| #   | Pass                 | Phase 0 scope                                                                                                                                                                                                                                                                                                                                             |
| --- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2   | `strip-reserved`     | Remove incoming `data-kyomi-*` attributes and `kyomi-*` elements.                                                                                                                                                                                                                                                                                         |
| 3   | `resolve-urls`       | Absolutize `href src srcset poster` on `a img source video audio`. Rewrite ids to `kyomi-<slug>`, deduplicated, and rewrite matching `#id` hrefs. Drop fragment links whose target does not exist.                                                                                                                                                        |
| 4   | `unlazy-media`       | Promote `data-src`, `data-srcset`, `data-lazy-src`, and `<noscript><img>` fallbacks when `src` is missing or a known placeholder.                                                                                                                                                                                                                         |
| 5   | `recognize-embeds`   | Provider iframes (YouTube, Vimeo, Spotify, SoundCloud, CodePen, CodeSandbox, Loom, Figma) and provider blockquotes (X, Instagram, TikTok, Bluesky, Mastodon) become `<figure data-kyomi-embed="{provider}" data-kyomi-url="{canonical}"><a href="{canonical}">{title or URL}</a></figure>`. Unknown iframes are dropped and counted.                      |
| 6   | `capture-code-hints` | Write `data-kyomi-lang` from `language-*`, `lang-*`, `highlight-source-*`, `brush:`, `data-lang`, and Prism or WordPress hints. Write `data-kyomi-filename` from a `title` or caption, and `data-kyomi-lines` from highlighted-line markers. Also write `data-kyomi-checked` (`true` or `false`) on task-list items before pass 8 drops their checkboxes. |
| 8   | `strip-chrome`       | Enforce decision 6, then move `stripCarouselArtifacts` and `stripLeadingArticleMetadata` here from `content/sanitize.ts`.                                                                                                                                                                                                                                 |
| 9   | `sanitize`           | Serialize, apply policy v2, re-parse, then `normalizeSanitizedArticleRoot`.                                                                                                                                                                                                                                                                               |

`compileArticleHtml` returns `{ html, text, sanitizerVersion, diagnostics }`, where `diagnostics`
counts drops by tag in the shape of the document model's `droppedElements`.

## Areas That Change

### packages/db

- Nullable `content_raw` and `extracted_content_raw` on `feed_items` and `article_clips`, and
  `raw_html` on `article_extraction_cache` (migration `0040_raw_source_columns`). The extracted
  columns are needed because an item's extracted body is persisted apart from the cache row, which
  a later re-extraction overwrites.
- `lz4` compression is a separate custom migration (`0041_raw_source_lz4`), so the generated SQL
  stays untouched.

### packages/worker

- `sanitization/article-html.ts`: policy v2, per-tag attributes, URL rules, forced media values,
  and `ARTICLE_HTML_DROP_CONTENT_TAGS` kept as the list pass 8 enforces.
- New `document/` with `compile.ts` and `passes/*`. Add `linkedom` to dependencies and the
  `./document` export.
- `lib/feed-text.ts`: compile HTML bodies with the item link as `baseUrl`, stamp the version, and
  return the raw body for storage.
- `services/feed/refresh.ts`: write `content_raw` and `content_sanitizer_version`. Keep the
  conflict rule; existing rows are not rewritten.

### apps/api

- `extraction/readability.ts` and `workflow.ts`: call `compileArticleHtml` on the Readability
  output and persist the raw output with the result.
- `write/clips/operations.ts`: compile on write and store the client HTML as `content_raw`.
- `content/sanitize.ts`: split `processArticleHtml` into ingest (delegates to the worker compiler)
  and stored (policy, normalize, text extraction). Delete the duplicate `resolveRelativeAssetUrls`.
- `app/boot/sanitizer.ts`: pass the article link as `baseUrl`.
- Response DTOs: assert that the raw columns are never serialized into client payloads.
- Whole-row reads (`.select().from(articleClips)` in `read/list/views.ts`,
  `write/clips/detail.ts`, and `write/clips/operations.ts`) would fetch raw HTML on every list or
  detail query once it is populated. Switch them to explicit columns in the same step that starts
  writing raw source.

### packages/reader

- `web/html/string-prep.ts`: stop stripping `width`/`height`.
- `web/html/url-resolve.ts`: rewrite `srcset` candidates and `poster` through
  `transformImageUrl`, and drop any candidate that does not come back as `http(s)`.
- `web/lib/code-block.tsx`: read `data-kyomi-lang` and `data-kyomi-filename` before class hints,
  and show the filename in the chrome label.
- `README.md`: note the v2 policy and the stored-vs-ingest split.

### packages/ui styles

`src/styles/reader.css` and `packages/reader/src/web/styles.css`:

- **Images:** `img { height: auto }`, so `width`/`height` attributes give the browser an aspect
  ratio and reserve space before load.
- **Inline elements:** `kbd` matches the `@kyomi/ui` Kbd component. `del`/`s` and `ins` get
  readable strike and underline colours. `q` gets locale quotes.
- **Blocks:** `dl`/`dt`/`dd` use the paragraph rhythm. `caption` matches figure captions. `aside`
  gets the note treatment.
- **Media:** `video` and `audio` use the image frame radius and the 1px pure-black / pure-white
  10% outline.
- **Embed placeholder:** `figure[data-kyomi-embed]` reserves no fake aspect ratio; it is a link
  until Phase 2.

## Implementation Steps

1. **Fixtures first.** Done 2026-10-20: 20 fixtures, 176 checks, and the `article-html-v1`
   baseline in `tests/api/fixtures/articles/corpus/` (see its README). v1 passes 78 of 176.
2. **Schema.** Done 2026-10-20: migrations 0040 and 0041, covered by
   `db/sanitizer-version-schema.test.ts` and dry-run on local Postgres 18 inside a rolled-back
   transaction.
3. **Policy v2.** Done 2026-10-20. The policy is split into `article-policy.ts` (allowlists),
   `article-classes.ts`, `article-attributes.ts` (value rules, spec-style `srcset` parsing), and
   `article-html.ts`. Beyond the table above it also allows `footer` (pass 8 drops page
   footers), keeps empty table cells and empty `kyomi-` anchor targets, drops media with no
   valid source, and validates `align`, `scope`, `width`, `height`, and `type`. Both URL resolvers
   (API `content/sanitize.ts`, reader `web/html/url-resolve.ts`) now leave `#kyomi-` links
   relative. Corpus: 78 → 112 of 176 checks, no regressions. Until passes 2–6 and 8 land, the
   policy alone keeps forged `data-kyomi-*` values inert but does not remove well-formed ones, so
   ship steps 3–5 together.
4. **Passes and compiler.** Done 2026-10-20 in `packages/worker/src/document/`, exported as
   `@kyomi/worker/document` (`compileArticleHtml`, `ARTICLE_COMPILE_PASSES`, `parseArticleFragment`).
   Run order is strip-reserved, unlazy-media, resolve-urls, recognize-embeds, capture-code-hints,
   strip-chrome, sanitize: unlazy runs before resolve so promoted lazy URLs are resolved too.
   Tests are one file per pass under `tests/api/integration/modules/articles/reader/content/compile/`
   (the `$testing` skill puts worker behaviour under the API boundary it serves, not a
   `packages/worker` tree). Corpus through the compiler: 176 of 176. Deviations:
   - `compileArticleHtml` returns `{ html, sanitizerVersion, diagnostics }`; text extraction stays in
     the API until step 5 decides where it lives.
   - `stripCarouselArtifacts` and `stripLeadingArticleMetadata` stay on the API read path, which still
     needs them for v1 rows; moving them waits for Phase 1.
   - The drop list also covers `label` (form and margin-toggle text) and `annotation-xml`.
   - Code passes strip publisher token colours inside `<pre>` and unwrap Chroma line-number tables.
5. **Ingest wiring.** Done 2026-10-20.
   - Feed refresh: `buildStoredFeedContent` compiles HTML bodies against the item link and returns
     `contentRaw` and `contentSanitizerVersion`; the upsert writes both. On conflict, raw source
     fills in for older rows (`COALESCE`), and the version only changes when `content_html` is
     taken from the new row, so a kept v1 body never claims v2.
   - Extraction: `compileExtractedHtml` in `extraction/readability.ts` compiles Readability output
     for fresh extractions and for stale cache rows that carry raw source; older cache rows without
     it are only re-sanitized. Raw output goes to `article_extraction_cache.raw_html` and
     `extracted_content_raw` on feed items and clips.
   - Clips: create compiles HTML `content` through `buildStoredContentRecord` and stores the raw body;
     update compiles client `contentHtml` and stores it as raw source.
   - `processIngestedArticleHtml` in `content/sanitize.ts` is the API ingest entry (compile, then
     the stored cleanup and text extraction). The API `resolveRelativeAssetUrls` stays: v1 rows still
     carry relative URLs on the read path.
   - Clip reads select `clipReadColumns` (`write/clips/columns.ts`), every column except the raw
     bodies, in `detail.ts`, `operations.ts`, and `read/list/views.ts`.
   - Deploy order: migrations 0040 and 0041 must run before this code, since refresh and extraction
     now write the new columns.
6. **Read path.** Make the stored path policy-only and make the backfill pass `baseUrl`. Extend
   `sanitizer-version.test.ts` and `app/boot/sanitizer.test.ts`.
7. **Reader.** Update `string-prep`, `url-resolve`, `code-block`, and the CSS. Extend
   `web/render-html.test.tsx`.
8. **Docs.** Update the reader README and mark passes 2–6, 8, 9 as shipped in the compiler doc.
9. **QA.** Run the focused suites, typecheck, lint, and format for `packages/worker`,
   `packages/reader`, `packages/db`, and `apps/api`; build `apps/web`; then manually check light and
   dark themes, narrow and wide layouts, and mobile Expo DOM against the fixtures.

## Security Review

| Risk                          | Control                                                                                                    | Test                                                                   |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Forged compiler hints         | Pass 2 strips incoming `data-kyomi-*`; renderers revalidate URLs                                           | Feed HTML carrying `data-kyomi-url="javascript:…"` and `<kyomi-embed>` |
| DOM clobbering via `id`       | Every id is prefixed `kyomi-`; `name` is not allowed                                                       | `id="location"` and `id="__proto__"` fixtures                          |
| Script URLs in new attributes | `srcset` is parsed per candidate; `poster`, `source[src]`, and `href` are checked against the scheme rules | `javascript:` and `data:text/html` in each attribute                   |
| Autoplaying or tracking media | Forced `controls` and `preload="none"`; no `autoplay`                                                      | Fixture with `autoplay muted loop`                                     |
| MathML script vectors         | `annotation-xml` and `maction` excluded                                                                    | MathML fixture with embedded HTML                                      |
| Raw source exposure           | `content_raw` is never selected into DTOs                                                                  | DTO tests for detail, list, and clip responses                         |
| Proxy bypass on mobile        | `srcset` and `poster` rewritten through `transformImageUrl`                                                | `url-resolve` test with a transformer                                  |

## Non-Goals

- Shiki highlighting (plan 0b) and feed `media:*` and `enclosure` parsing (plan 0c).
- Iframe players, embed snapshots, and CSP (Phase 2).
- The document model renderer and `content_document` column (Phase 1).
- Recovering content already lost in v1-stored rows.
- The dormant WebView string renderer.

## Risk Matrix

| Risk                                                             | Likelihood | Impact | Mitigation                                                                     |
| ---------------------------------------------------------------- | ---------- | ------ | ------------------------------------------------------------------------------ |
| Keeping `aside` or `header` re-admits page chrome in feed bodies | Medium     | Low    | Fixture corpus. Readability already removes page chrome from extracted content |
| `id` rewriting breaks a publisher's internal links               | Low        | Low    | Rewrite matching hrefs in the same pass; drop dangling fragments               |
| `linkedom` parse differences from the browser parser             | Medium     | Medium | The parity test runs the browser policy on compiler output                     |
| `content_raw` storage growth                                     | Medium     | Low    | `lz4` compression; feed bodies are already size-capped                         |
| Read-path cost of re-sanitizing v1 rows                          | Existing   | Low    | Unchanged from today                                                           |
