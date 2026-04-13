"use client";

import { marked } from "marked";
import markedKatex from "marked-katex-extension";
import { RenderHtml } from "./render-html";

marked.use(markedKatex({ throwOnError: false }));

function escapeRawHtml(input: string): string {
  return input.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function RenderMarkdown({ markdown }: { markdown: string }) {
  const html = marked.parse(escapeRawHtml(markdown), { async: false }) as string;

  return <RenderHtml html={html} />;
}
