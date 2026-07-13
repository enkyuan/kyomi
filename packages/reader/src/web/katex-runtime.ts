import "katex/dist/katex.min.css";
import renderMathInElement from "katex/dist/contrib/auto-render.mjs";
import { type ReaderMarkdownRenderOptions } from "../shared/markdown-core";
import { readerMarkdownToHtmlWithKatex } from "../shared/markdown-katex";

const HTML_TEX_DELIMITERS = [
  { left: "$$", right: "$$", display: true },
  { left: "\\[", right: "\\]", display: true },
  { left: "\\(", right: "\\)", display: false },
  { left: "\\begin{equation}", right: "\\end{equation}", display: true },
  { left: "\\begin{equation*}", right: "\\end{equation*}", display: true },
  { left: "\\begin{align}", right: "\\end{align}", display: true },
  { left: "\\begin{align*}", right: "\\end{align*}", display: true },
  { left: "\\begin{alignat}", right: "\\end{alignat}", display: true },
  { left: "\\begin{alignat*}", right: "\\end{alignat*}", display: true },
  { left: "\\begin{gather}", right: "\\end{gather}", display: true },
  { left: "\\begin{gather*}", right: "\\end{gather*}", display: true },
  { left: "\\begin{CD}", right: "\\end{CD}", display: true },
];

export function renderMarkdownWithKatex(markdown: string, options?: ReaderMarkdownRenderOptions) {
  return readerMarkdownToHtmlWithKatex(markdown, options);
}

export function renderMathInHtmlElement(element: HTMLElement) {
  renderMathInElement(element, {
    delimiters: HTML_TEX_DELIMITERS,
    errorColor: "currentColor",
    ignoredClasses: ["reader-code-copy-button"],
    ignoredTags: ["script", "noscript", "style", "textarea", "pre", "code"],
    throwOnError: false,
  });
}
