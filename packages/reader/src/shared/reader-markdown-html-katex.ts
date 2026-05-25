import markedKatex from "marked-katex-extension";
import { createReaderMarked, type ReaderMarkdownRenderOptions } from "./reader-markdown-html-core";

const markedWithKatexByBaseUrl = new Map<string, ReturnType<typeof createReaderMarked>>();

function getMarkedWithKatex(baseUrl?: string | null, openLinksInNewTab = true) {
  const key = `${baseUrl ?? ""}|${openLinksInNewTab ? "blank" : "same"}`;
  let parser = markedWithKatexByBaseUrl.get(key);
  if (!parser) {
    parser = createReaderMarked(baseUrl, openLinksInNewTab);
    parser.use(markedKatex({ throwOnError: false }));
    markedWithKatexByBaseUrl.set(key, parser);
  }
  return parser;
}

/** Markdown -> HTML using the same rules as the web reader, including KaTeX math. */
export function readerMarkdownToHtmlWithKatex(
  markdown: string,
  options?: ReaderMarkdownRenderOptions,
): string {
  const parser = getMarkedWithKatex(options?.baseUrl, options?.openLinksInNewTab ?? true);
  return parser.parse(markdown, { async: false }) as string;
}
