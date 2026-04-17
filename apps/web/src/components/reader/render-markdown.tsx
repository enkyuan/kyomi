"use client";

import { Renderer, marked } from "marked";
import markedKatex from "marked-katex-extension";
import { RenderHtml } from "./render-html";

function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url, "https://example.com");
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

const renderer = new Renderer();

renderer.link = function ({ href, title, text }) {
  if (!isSafeUrl(href)) return text;
  const titleAttr = title ? ` title="${escapeAttr(title)}"` : "";
  return `<a href="${escapeAttr(href)}"${titleAttr} rel="noopener noreferrer">${text}</a>`;
};

renderer.image = function ({ href, title, text }) {
  if (!isSafeUrl(href)) return text;
  const titleAttr = title ? ` title="${escapeAttr(title)}"` : "";
  return `<img src="${escapeAttr(href)}" alt="${escapeAttr(text)}"${titleAttr}>`;
};

renderer.html = function ({ text }) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
};

marked.use(markedKatex({ throwOnError: false }));
marked.use({ renderer });

export function RenderMarkdown({ markdown }: { markdown: string }) {
  return <RenderHtml html={marked.parse(markdown, { async: false }) as string} />;
}
