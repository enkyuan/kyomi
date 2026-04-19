"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { enhanceArticleCodeBlocks } from "./article-code-blocks";
import { prepareArticleHtml } from "./article-html/string-prep";
import { runReaderDomEnhancements } from "./article-html/dom-enhancements";
import "katex/dist/katex.min.css";

export function RenderHtml({ html, baseUrl }: { html: string; baseUrl?: string | null }) {
  const articleBodyRef = useRef<HTMLDivElement | null>(null);
  const prepared = useMemo(() => prepareArticleHtml(html, baseUrl), [html, baseUrl]);

  const runAllEnhancements = (node: HTMLElement) => {
    enhanceArticleCodeBlocks(node);

    queueMicrotask(() => {
      // Guard against stale closure: only run if this node is still mounted.
      if (articleBodyRef.current === node) {
        runReaderDomEnhancements(node);
      }
    });
  };

  useLayoutEffect(() => {
    const node = articleBodyRef.current;
    if (!node || typeof document === "undefined") {
      return;
    }

    runAllEnhancements(node);
  }, [prepared]);

  useEffect(() => {
    const node = articleBodyRef.current;
    if (!node || typeof MutationObserver === "undefined") {
      return;
    }

    let scheduled = false;

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "childList") {
          if (scheduled) {
            return;
          }
          scheduled = true;
          queueMicrotask(() => {
            scheduled = false;
            const current = articleBodyRef.current;
            if (!current) {
              return;
            }
            observer.disconnect();
            runAllEnhancements(current);
            observer.observe(current, { childList: true, subtree: true });
          });
          break;
        }
      }
    });

    observer.observe(node, { childList: true, subtree: true });
    return () => observer.disconnect();
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
