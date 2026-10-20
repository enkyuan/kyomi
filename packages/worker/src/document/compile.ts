import { ARTICLE_HTML_SANITIZER_VERSION } from "../sanitization/article-policy";
import { parseArticleFragment, type ArticlePass, type CompileDiagnostics } from "./context";
import { captureCodeHints } from "./passes/capture-code-hints";
import { recognizeEmbeds } from "./passes/recognize-embeds";
import { resolveUrls } from "./passes/resolve-urls";
import { sanitize } from "./passes/sanitize";
import { stripChrome } from "./passes/strip-chrome";
import { stripReserved } from "./passes/strip-reserved";
import { unlazyMedia } from "./passes/unlazy-media";

/**
 * Ingest passes in run order, named as in `docs/architecture/reader-document-compiler.md`.
 * `unlazy-media` (4) runs before `resolve-urls` (3) so promoted lazy URLs are resolved too.
 */
export const ARTICLE_COMPILE_PASSES = [
  { name: "strip-reserved", run: stripReserved },
  { name: "unlazy-media", run: unlazyMedia },
  { name: "resolve-urls", run: resolveUrls },
  { name: "recognize-embeds", run: recognizeEmbeds },
  { name: "capture-code-hints", run: captureCodeHints },
  { name: "strip-chrome", run: stripChrome },
  { name: "sanitize", run: sanitize },
] as const satisfies readonly { name: string; run: ArticlePass }[];

export type ArticleCompilePassName = (typeof ARTICLE_COMPILE_PASSES)[number]["name"];

export type CompiledArticleHtml = {
  html: string;
  sanitizerVersion: typeof ARTICLE_HTML_SANITIZER_VERSION;
  diagnostics: CompileDiagnostics;
};

/**
 * Compiles untrusted article HTML once, at ingest. The result is safe to store and serve; read
 * paths only re-apply the sanitizer policy, never these passes, because `strip-reserved` would
 * remove the compiler's own hints.
 */
export function compileArticleHtml(
  raw: string,
  options?: { baseUrl?: string | null },
): CompiledArticleHtml {
  const { root, context } = parseArticleFragment(raw, options);
  for (const pass of ARTICLE_COMPILE_PASSES) {
    pass.run(root, context);
  }
  return {
    html: root.innerHTML.trim(),
    sanitizerVersion: ARTICLE_HTML_SANITIZER_VERSION,
    diagnostics: context.diagnostics,
  };
}
