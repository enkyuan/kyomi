# Translation eval metrics

Translations come from `@cf/openai/gpt-oss-120b` and grades from `@cf/deepseek-ai/deepseek-v4-pro-0813` (reasoning effort high, JSON mode), both on Workers AI through the `POST /chat` route of the Kyomi embeddings Worker (`apps/embeddings`).

- **Quality** (judge, 0-100, higher better): the judge reads the source text and the translation's text (both extracted with the reader's `processArticleHtml` pass), lists MQM-style errors, then scores with anchors (0 unusable, 50 gist with major errors, 75 complete with minor issues, 90 fluent and accurate, 100 professional).
- **Major err/1k** (lower better): major + critical errors from the judge's list per 1,000 source words.
- **Markup intact** (0/1): after sanitizing the output, the sequence of block elements matches the source, every `href`/`src` survives, inline tag counts match, and `<pre>` text is byte-identical.
- **URLs kept** (0-1): share of the source's `href`/`src` values present in the output.

Not judged: `alt`/`title` attribute text, and the Japanese-source article into Japanese (skipped, as production would skip same-language).

Cost: token counts come from Workers AI's `usage` (prompt/completion tokens, reasoning included) and are priced from `_state.json` `prices` at Cloudflare's published per-model rates. The Worker echoes the requested model id; Workers AI does not report a served model separately.

Judge strength: DeepSeek V4 Pro is the strongest judge on the Workers AI catalog that is not the model under test, but an open-model judge is less reliable than a frontier one. Read a handful of transcripts before trusting small Quality differences.
