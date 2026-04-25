"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { enhanceArticleCodeBlocks } from "./article-code-blocks";
import { prepareArticleHtml } from "./article-html/string-prep";
import { runReaderDomEnhancements } from "./article-html/dom-enhancements";
import "katex/dist/katex.min.css";

function updateReaderLinkTargets(node: HTMLElement, openLinksInNewTab: boolean) {
  const anchors = node.querySelectorAll("a[href]");
  anchors.forEach((anchor) => {
    if (openLinksInNewTab) {
      anchor.setAttribute("target", "_blank");
      anchor.setAttribute("rel", "noopener noreferrer");
      return;
    }
    anchor.removeAttribute("target");
  });
}

export function RenderHtml({
  html,
  baseUrl,
  openLinksInNewTab = true,
}: {
  html: string;
  baseUrl?: string | null;
  openLinksInNewTab?: boolean;
}) {
  const articleBodyRef = useRef<HTMLDivElement | null>(null);
  const prepared = useMemo(() => prepareArticleHtml(html, baseUrl), [html, baseUrl]);

  const runAllEnhancements = (node: HTMLElement) => {
    enhanceArticleCodeBlocks(node);

    queueMicrotask(() => {
      // Guard against stale closure: only run if this node is still mounted.
      if (articleBodyRef.current === node) {
        runReaderDomEnhancements(node);
        updateReaderLinkTargets(node, openLinksInNewTab);
      }
    });
  };

  useLayoutEffect(() => {
    const node = articleBodyRef.current;
    if (!node || typeof document === "undefined") {
      return;
    }

    runAllEnhancements(node);
  }, [openLinksInNewTab, prepared]);

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
  }, [openLinksInNewTab, prepared]);

  return (
    <div
      className="article-body"
      suppressHydrationWarning
      ref={articleBodyRef}
      dangerouslySetInnerHTML={{ __html: prepared }}
    />
  );
}
