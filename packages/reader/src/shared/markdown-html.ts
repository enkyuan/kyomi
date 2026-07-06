import { createReaderMarked, type ReaderMarkdownRenderOptions } from "./markdown-core";
import { hasLikelyMarkdownMath } from "./math";

const markedByBaseUrl = new Map<string, ReturnType<typeof createReaderMarked>>();

function getMarkedForBaseUrl(baseUrl?: string | null, openLinksInNewTab = true) {
  const key = `${baseUrl ?? ""}|${openLinksInNewTab ? "blank" : "same"}`;
  let parser = markedByBaseUrl.get(key);
  if (!parser) {
    parser = createReaderMarked(baseUrl, openLinksInNewTab);
    markedByBaseUrl.set(key, parser);
  }
  return parser;
}

export { hasLikelyMarkdownMath };

/** Markdown -> HTML using the same non-math rules as the web reader. */
export function readerMarkdownToHtml(
  markdown: string,
  options?: ReaderMarkdownRenderOptions,
): string {
  const parser = getMarkedForBaseUrl(options?.baseUrl, options?.openLinksInNewTab ?? true);
  return parser.parse(markdown, { async: false }) as string;
}
