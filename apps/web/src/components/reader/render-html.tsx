"use client";

import { useLayoutEffect, useRef } from "react";
import { enhanceArticleCodeBlocks } from "./article-code-blocks";
import { prepareArticleHtml } from "./article-html/string-prep";
import { runReaderDomEnhancements } from "./article-html/dom-enhancements";
import "katex/dist/katex.min.css";

export function RenderHtml({ html, baseUrl }: { html: string; baseUrl?: string | null }) {
  const articleBodyRef = useRef<HTMLDivElement | null>(null);
  const prepared = prepareArticleHtml(html, baseUrl);

  useLayoutEffect(() => {
    const node = articleBodyRef.current;
    if (!node || typeof document === "undefined") {
      return;
    }

    enhanceArticleCodeBlocks(node);

    queueMicrotask(() => {
      // Guard against stale closure: only run if this node is still mounted.
      if (articleBodyRef.current === node) {
        runReaderDomEnhancements(node);
      }
    });
  }, [prepared]);

  return (
    <div
      className="article-body"
      suppressHydrationWarning
      ref={articleBodyRef}
      dangerouslySetInnerHTML={{ __html: prepared }}
    />
  );
}
