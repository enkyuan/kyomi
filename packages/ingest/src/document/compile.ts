import { ARTICLE_HTML_SANITIZER_VERSION } from "@kyomi/reader/sanitization";
import {
  parseArticleFragment,
  type ArticlePass,
  type CompileContext,
  type CompileDiagnostics,
} from "./context";
import { captureCodeHints } from "./passes/capture-code-hints";
import { captureLayout } from "./passes/capture-layout";
import { recognizeEmbeds } from "./passes/recognize-embeds";
import { resolveUrls } from "./passes/resolve-urls";
import { sanitize } from "./passes/sanitize";
import { stripChrome } from "./passes/strip-chrome";
import { stripReserved } from "./passes/strip-reserved";
import {
  isTreeWithinStructureBudget,
  isWithinStructureBudget,
  textOnlyHtml,
} from "./structure-budget";
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
  { name: "capture-layout", run: captureLayout },
  { name: "strip-chrome", run: stripChrome },
  { name: "sanitize", run: sanitize },
] as const satisfies readonly { name: string; run: ArticlePass }[];

export type ArticleCompilePassName = (typeof ARTICLE_COMPILE_PASSES)[number]["name"];

export type CompiledArticleHtml = {
  html: string;
  sanitizerVersion: typeof ARTICLE_HTML_SANITIZER_VERSION;
  diagnostics: CompileDiagnostics;
};

type CompileOptions = { baseUrl?: string | null; generator?: string | null };

/**
 * Parses `raw`, or its text when its shape is past `structure-budget`. The shape is read twice:
 * from the text before the parser sees it, and from the tree the parser built before any pass
 * does. A parser stack overflow, which a shape the first read missed would cause, reads as text.
 */
function parseWithinBudget(raw: string, options?: CompileOptions) {
  if (isWithinStructureBudget(raw)) {
    try {
      const parsed = parseArticleFragment(raw, options);
      if (isTreeWithinStructureBudget(parsed.root)) {
        return parsed;
      }
    } catch (error) {
      if (!(error instanceof RangeError)) {
        throw error;
      }
    }
  }
  return parseArticleFragment(textOnlyHtml(raw), options);
}

/**
 * Runs the ingest passes (strip-reserved through sanitize) and returns the sanitized tree, which
 * is also the input to the lowering pass. A body nested or populated beyond `structure-budget`
 * is compiled as its text, so a hostile shape costs a bounded amount of work and never throws.
 */
export function compileArticleRoot(
  raw: string,
  options?: CompileOptions,
): { root: HTMLElement; context: CompileContext } {
  const { root, context } = parseWithinBudget(raw, options);
  for (const pass of ARTICLE_COMPILE_PASSES) {
    pass.run(root, context);
  }
  return { root, context };
}

/**
 * Compiles untrusted article HTML once, at ingest. The result is safe to store and serve; read
 * paths only re-apply the sanitizer policy, never these passes, because `strip-reserved` would
 * remove the compiler's own hints.
 */
export function compileArticleHtml(raw: string, options?: CompileOptions): CompiledArticleHtml {
  const { root, context } = compileArticleRoot(raw, options);
  return {
    html: root.innerHTML.trim(),
    sanitizerVersion: ARTICLE_HTML_SANITIZER_VERSION,
    diagnostics: context.diagnostics,
  };
}
