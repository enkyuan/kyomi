# @kyomi/reader

article rendering shared by the web and native clients.

## layout

```text
src/
  core/          reader types and pure helpers; document/ holds the document model schema.
  sanitization/  browser-safe article HTML policy.
  web/           React components, HTML rendering, and styles.
  webview/       WebView HTML generation.
  native/        WebView wrapper and the React Native KDM renderer (document/).
  shared/        helpers used by more than one entry point.
```

## exports

| import                         | purpose                                    |
| ------------------------------ | ------------------------------------------ |
| `@kyomi/reader`                | reader types and helpers.                  |
| `@kyomi/reader/core`           | explicit core entry point.                 |
| `@kyomi/reader/document`       | Kyomi Document Model Zod schema and types. |
| `@kyomi/reader/sanitization`   | article HTML policy and sanitizer.              |
| `@kyomi/reader/web`            | React web reader and HTML rendering.       |
| `@kyomi/reader/web/styles.css` | web reader styles.                         |
| `@kyomi/reader/webview`        | WebView HTML generation.                   |
| `@kyomi/reader/native`         | WebView wrapper and React Native KDM renderer. |

## commands

| command                                   | purpose           |
| ----------------------------------------- | ----------------- |
| `bun run --cwd packages/reader typecheck` | type-check.       |
| `bun run --cwd packages/reader lint`      | lint.             |
| `bun run --cwd packages/reader fmt:check` | check formatting. |

## notes

- `core` and `webview` must not import React.
- `web` expects React as a peer dependency.
- `sanitization` must stay browser-safe — no JSDOM or Node-only modules. It owns the article HTML policy shared by web, API, and the worker compiler; `packages/reader` must never import `@kyomi/worker`.
- article HTML is compiled once at ingest by `@kyomi/worker/document`. the web renderer re-applies
  the policy only and reads the compiler's hints instead of re-deriving them: `pre[data-kyomi-lang]`
  and `[data-kyomi-filename]` label code blocks, `figure[data-kyomi-embed][data-kyomi-url]` marks
  an embed, `li[data-kyomi-checked]` carries task-list state, and `#kyomi-*` links are in-page.
- `transformImageUrl` receives every image request (`src`, each `srcset` candidate, `video[poster]`).
  returning `null` keeps the original URL; a non-http result drops it. media files are not
  transformed.
- `web/document` renders a compiled Kyomi Document (`@kyomi/reader/document`) as React blocks on
  `@kyomi/ui`. `ReaderContent` picks it for `bodyKind: "document"` when the version is supported and
  the document validates, and otherwise falls back to the HTML body. it ships no highlighter: code
  tokens and KaTeX html come from the document, and KaTeX css loads only when `features.math`.
  `web` depends on `@kyomi/ui`.

## native KDM renderer

`@kyomi/reader/native` renders a `ReaderDocument` with React Native `Text`/`View`. one renderer serves
iOS and Android. native text carries prose, headings, lists, quotes, callouts, tables, code (stored
tokens, no highlighter), figures, galleries, media-text, embed snapshot cards and link cards. the app
supplies a `ReaderNativeHost` for what the package cannot own: opening links, the image component
(thumbhash placeholders, proxy), the image viewer, the footnote sheet, and a WebView **island** for
`html` blocks, math and unsnapshotted players. without a host island, math degrades to its TeX source,
`html` blocks are skipped, and players become link cards.

```tsx
const theme = createReaderNativeTheme({ scheme, availableWidth, inset, fontSize });
<NativeDocumentBody document={doc} theme={theme} host={host} inset={inset} />;
```

### virtualization vs. selection (trade-off)

the list virtualizes at **block-group** level (`planDocument`): a row is either a run of consecutive
paragraphs or one block. a run is a single native `Text` with nested `Text` per paragraph, so text
selection, copy and a future highlight anchor span paragraphs inside a run. runs are capped
(`MAX_PROSE_RUN_BLOCKS`, `MAX_PROSE_RUN_CHARS`) so very long articles still unmount off-screen text, and
the cap bounds the cost of one huge text layout. consequences:

- selection does not cross a heading, list, quote, figure or run boundary. headings stay separate rows
  because each needs its own `header` role for VoiceOver/TalkBack rotor navigation.
- lists keep their own row so wrapped lines get a hanging indent, which one flat `Text` cannot do.
- paragraph gaps inside a run use a small-line-height newline; verify spacing on both platforms.
- scroll restore saves the first visible row index, not pixels, so it survives font and width changes.

### known limits

no `rowSpan`; table columns use a fixed width (`tableColumnWidth`) times `colSpan`; sub/superscripts
use Unicode glyphs when available (React Native has no baseline shift); inline math shows TeX in mono
(one WebView per formula is too costly); italics on custom fonts without an italic face are
synthesized by the platform.
