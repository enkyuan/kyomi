import { renderHtml } from "@tanstack/markdown/html";
import { createReaderMarkdownExtension, type ReaderMarkdownRenderOptions } from "./markdown-core";
import { hasLikelyMarkdownMath } from "./math";

export { hasLikelyMarkdownMath };

/** Render Markdown with the shared Kyomi URL and link policy. */
export function readerMarkdownToHtml(
  markdown: string,
  options?: ReaderMarkdownRenderOptions,
): string {
  return renderHtml(markdown, {
    allowHtml: true,
    extensions: [
      createReaderMarkdownExtension(options?.baseUrl, options?.openLinksInNewTab ?? true),
    ],
  });
}
