import { createReaderMarked, type ReaderMarkdownRenderOptions } from "./reader-markdown-html-core";

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

function hasInlineMathDelimiter(markdown: string) {
  const matches = markdown.matchAll(/(^|[^\\])\$([^$\n]+?)\$/g);
  for (const match of matches) {
    const candidate = match[2]?.trim();
    if (!candidate) {
      continue;
    }
    if (/[\\^_=]/.test(candidate) || /\d\s*[-+*/=]\s*\d/.test(candidate)) {
      return true;
    }
  }
  return false;
}

export function hasLikelyMarkdownMath(markdown: string) {
  return (
    /(^|[^\\])\$\$[\s\S]+?(^|[^\\])\$\$/m.test(markdown) ||
    /\\\([\s\S]+?\\\)/.test(markdown) ||
    /\\\[[\s\S]+?\\\]/.test(markdown) ||
    /\\begin\{[a-zA-Z*]+\}/.test(markdown) ||
    hasInlineMathDelimiter(markdown)
  );
}

/** Markdown -> HTML using the same non-math rules as the web reader. */
export function readerMarkdownToHtml(
  markdown: string,
  options?: ReaderMarkdownRenderOptions,
): string {
  const parser = getMarkedForBaseUrl(options?.baseUrl, options?.openLinksInNewTab ?? true);
  return parser.parse(markdown, { async: false }) as string;
}
