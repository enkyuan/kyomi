import { Marked, Renderer } from "marked";
import { normalizeSafeHttpUrl } from "../core";

export type ReaderMarkdownRenderOptions = {
  baseUrl?: string | null;
  openLinksInNewTab?: boolean;
};

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function createReaderMarkdownRenderer(
  baseUrl?: string | null,
  openLinksInNewTab = true,
): Renderer {
  const renderer = new Renderer();

  renderer.link = function ({ href, title, text }) {
    const resolvedHref = href ? normalizeSafeHttpUrl(href, baseUrl) : null;
    if (!resolvedHref) {
      return text;
    }
    const titleAttr = title ? ` title="${escapeAttr(title)}"` : "";
    if (!openLinksInNewTab) {
      return `<a href="${escapeAttr(resolvedHref)}"${titleAttr}>${text}</a>`;
    }
    return `<a href="${escapeAttr(resolvedHref)}"${titleAttr} rel="noopener noreferrer" target="_blank">${text}</a>`;
  };

  renderer.image = function ({ href, title, text }) {
    const resolvedSrc = href ? normalizeSafeHttpUrl(href, baseUrl) : null;
    if (!resolvedSrc) {
      return text;
    }
    const titleAttr = title ? ` title="${escapeAttr(title)}"` : "";
    return `<img src="${escapeAttr(resolvedSrc)}" alt="${escapeAttr(text)}"${titleAttr}>`;
  };

  renderer.code = function ({ text, lang }) {
    const language = (lang ?? "").trim();
    const classAttr = language ? ` class="language-${escapeAttr(language)}"` : "";
    return `<pre><code${classAttr}>${escapeAttr(text)}</code></pre>`;
  };

  return renderer;
}

export function createReaderMarked(baseUrl?: string | null, openLinksInNewTab = true): Marked {
  const marked = new Marked();
  marked.use({
    gfm: true,
    breaks: false,
    renderer: createReaderMarkdownRenderer(baseUrl, openLinksInNewTab),
  });
  return marked;
}
