import "katex/dist/katex.min.css";
import { type ReaderMarkdownRenderOptions } from "../shared/markdown-core";
import { readerMarkdownToHtmlWithKatex } from "../shared/markdown-katex";

export function renderMarkdownWithKatex(markdown: string, options?: ReaderMarkdownRenderOptions) {
  return readerMarkdownToHtmlWithKatex(markdown, options);
}
