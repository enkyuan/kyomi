"use client";

import "katex/dist/katex.min.css";

export function RenderHtml({ html }: { html: string }) {
  return <div className="article-body" dangerouslySetInnerHTML={{ __html: html }} />;
}
