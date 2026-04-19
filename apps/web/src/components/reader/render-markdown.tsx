"use client";

import { Marked, Renderer } from "marked";
import markedKatex from "marked-katex-extension";
import { memo } from "react";
import { RenderHtml } from "./render-html";

function normalizeSafeHttpUrl(raw: string, baseUrl?: string | null): string | null {
  const candidate = raw.trim();
  if (!candidate) {
    return null;
  }
  try {
    const parsed = new URL(candidate, baseUrl ?? undefined);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.href;
    }
    return null;
  } catch {
    return null;
  }
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function createMarked(baseUrl?: string | null): Marked {
  const renderer = new Renderer();

  renderer.link = function ({ href, title, text }) {
    const resolvedHref = href ? normalizeSafeHttpUrl(href, baseUrl) : null;
    if (!resolvedHref) return text;
    const titleAttr = title ? ` title="${escapeAttr(title)}"` : "";
    return `<a href="${escapeAttr(resolvedHref)}"${titleAttr} rel="noopener noreferrer" target="_blank">${text}</a>`;
  };

  renderer.image = function ({ href, title, text }) {
    const resolvedSrc = href ? normalizeSafeHttpUrl(href, baseUrl) : null;
    if (!resolvedSrc) return text;
    const titleAttr = title ? ` title="${escapeAttr(title)}"` : "";
    return `<img src="${escapeAttr(resolvedSrc)}" alt="${escapeAttr(text)}"${titleAttr}>`;
  };

  renderer.code = function ({ text, lang }) {
    const language = (lang ?? "").trim();
    const classAttr = language ? ` class="language-${escapeAttr(language)}"` : "";
    return `<pre><code${classAttr}>${escapeAttr(text)}</code></pre>`;
  };

  const marked = new Marked();
  marked.use(markedKatex({ throwOnError: false }));
  marked.use({
    gfm: true,
    breaks: false,
    renderer,
  });
  return marked;
}

export const RenderMarkdown = memo(function RenderMarkdown({
  markdown,
  baseUrl,
}: {
  markdown: string;
  baseUrl?: string | null;
}) {
  const parser = createMarked(baseUrl);
  const html = parser.parse(markdown, { async: false }) as string;
  return <RenderHtml html={html} baseUrl={baseUrl} />;
});
