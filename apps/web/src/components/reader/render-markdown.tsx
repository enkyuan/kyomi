"use client";

import { Marked, Renderer } from "marked";
import markedKatex from "marked-katex-extension";
import { memo } from "react";
import { normalizeSafeHttpUrl } from "@lib/safe-http-url";
import { RenderHtml } from "./render-html";

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

const markedByBaseUrl = new Map<string, ReturnType<typeof createMarked>>();

function getMarkedForBaseUrl(baseUrl?: string | null): Marked {
  const key = baseUrl ?? "";
  let parser = markedByBaseUrl.get(key);
  if (!parser) {
    parser = createMarked(baseUrl);
    markedByBaseUrl.set(key, parser);
  }
  return parser;
}

export const RenderMarkdown = memo(function RenderMarkdown({
  markdown,
  baseUrl,
}: {
  markdown: string;
  baseUrl?: string | null;
}) {
  const parser = getMarkedForBaseUrl(baseUrl);
  const html = parser.parse(markdown, { async: false }) as string;
  return <RenderHtml html={html} baseUrl={baseUrl} />;
});
