# Reader fidelity corpus

Raw article bodies used to measure how much of a source survives the reader pipeline. The test
lives at `tests/api/integration/modules/articles/reader/content/corpus.test.ts` and renders each
fixture the way a feed item travels once ingestion is wired: `compileArticleHtml` at ingest, then
the API read pass. The `article-html-v1` baseline predates the compiler and used the old store
pass instead.

## Layout

```text
html/<name>.html            raw body, as a feed's content:encoded would carry it
manifest.json               archetype, base URL, title, and authored checks per fixture
baseline/<version>/         recorded output for one ARTICLE_HTML_SANITIZER_VERSION
  <name>.html               what a client receives for the fixture
  report.json               pass/fail for every check, plus totals
```

The fixtures are synthetic. Each reproduces the markup structure of its platform (WordPress
blocks, Ghost cards, Substack, Medium, Hugo, Jekyll, MkDocs, Docusaurus, LaTeXML, KaTeX, social
embeds, GitHub, Tufte CSS, and so on) with original placeholder prose, so no publisher content is
copied and runs need no network.

## Checks

Checks describe the sanitizer v2 contract from
`docs/superpowers/plans/2026-10-20-reader-sanitizer-v2.md`, not the current behaviour. A failing
check in a baseline report is expected and records a known loss.

| `assert`             | Passes when                                                              |
| -------------------- | ------------------------------------------------------------------------ |
| `present` / `absent` | `selector` matches / does not match in the output                        |
| `text` / `no-text`   | the whitespace-collapsed output text contains / does not contain `value` |

Contract details the checks rely on:

- Ids become `kyomi-` plus a slug: lowercase, every run of other characters replaced by `-`,
  leading and trailing `-` trimmed (`fn:1` → `kyomi-fn-1`, `S1.E1` → `kyomi-s1-e1`). In-page
  `#` links are rewritten to match.
- Embeds use canonical public URLs: `youtube.com/watch?v=`, `vimeo.com/<id>`,
  `open.spotify.com/<type>/<id>`, `x.com/<user>/status/<id>`, `codepen.io/<user>/pen/<id>`,
  `codesandbox.io/s/<id>`, and tracking query strings removed.
- `data-kyomi-lang` keeps the hint as the source wrote it (`Bash`, `ts`); canonical language ids
  are resolved later, in compiler pass 13.

## Document baseline

`corpus-document.test.ts` compiles every fixture with `compileArticleDocument` and scores the KDM
document against the sanitized HTML body and the authored `document` entry in `manifest.json`:

```text
document/<ARTICLE_COMPILER_VERSION>/
  <name>.json     stable KDM snapshot (KaTeX markup and Shiki tokens are replaced by size and hash)
  report.json     per-fixture and total scores
```

| Metric       | Meaning                                                                                    |
| ------------ | ------------------------------------------------------------------------------------------ |
| `elements`   | authored count per KDM type (`image` counts figures, gallery items, and media-text images) |
| `textRecall` | share of the HTML body's words present in the document (embed fallbacks excluded)          |
| `order`      | longest common word subsequence over the HTML body's words                                 |
| `htmlBlocks` | `html` escape-hatch blocks; the manifest states the allowance and the target is zero       |

Authored counts are the semantic truth (what the publisher put in the article), not the compiler's
current output. Record a new baseline when `ARTICLE_COMPILER_VERSION` changes, with the same
`KYOMI_UPDATE_READER_CORPUS=1` command, and review the report diff.

## Updating

The test compares against `baseline/<current version>/`. When `ARTICLE_HTML_SANITIZER_VERSION`
changes, record a new baseline and review the report diff against the previous version:

```sh
cd apps/api
KYOMI_UPDATE_READER_CORPUS=1 bun run dotenvx run -f ../../docker/.env -f .env -- \
  bun test ../../tests/api/integration/modules/articles/reader/content/corpus.test.ts
```

Add a fixture by dropping its raw body in `html/` and adding a manifest entry; the test fails if
either is missing.
