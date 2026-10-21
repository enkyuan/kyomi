import { JSDOM } from "jsdom";
import {
  ARTICLE_COMPILE_PASSES,
  parseArticleFragment,
  type ArticleCompilePassName,
  type CompileDiagnostics,
} from "@kyomi/worker/document";

/**
 * Re-serializes HTML through a browser-grade parser with attributes sorted by name, so
 * assertions do not depend on the order the compiler happened to set them in.
 */
export function canonicalHtml(html: string): string {
  const { document } = new JSDOM(`<!doctype html><body>${html}</body>`).window;
  for (const element of Array.from(document.body.querySelectorAll("*"))) {
    const attributes = Array.from(element.attributes)
      .map((attribute) => [attribute.name, attribute.value] as const)
      .sort(([a], [b]) => a.localeCompare(b));
    for (const [name] of attributes) {
      element.removeAttribute(name);
    }
    for (const [name, value] of attributes) {
      element.setAttribute(name, value);
    }
  }
  return document.body.innerHTML.trim();
}

/** Runs one compiler pass on a fragment and returns canonical HTML and diagnostics. */
export function runPass(
  name: ArticleCompilePassName,
  html: string,
  baseUrl: string | null = "https://example.com/posts/entry",
): { html: string; diagnostics: CompileDiagnostics } {
  const pass = ARTICLE_COMPILE_PASSES.find((candidate) => candidate.name === name);
  if (!pass) {
    throw new Error(`Unknown compiler pass ${name}`);
  }
  const { root, context } = parseArticleFragment(html, { baseUrl });
  pass.run(root, context);
  return { html: canonicalHtml(root.innerHTML), diagnostics: context.diagnostics };
}
