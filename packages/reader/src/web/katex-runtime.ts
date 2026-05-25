import "katex/dist/katex.min.css";
import { type ReaderMarkdownRenderOptions } from "../shared/reader-markdown-html-core";
import { readerMarkdownToHtmlWithKatex } from "../shared/reader-markdown-html-katex";

export function renderMarkdownWithKatex(markdown: string, options?: ReaderMarkdownRenderOptions) {
  return readerMarkdownToHtmlWithKatex(markdown, options);
}
