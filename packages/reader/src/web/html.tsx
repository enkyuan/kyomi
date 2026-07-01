"use client";

import { useCallback, useEffect, useEffectEvent, useMemo, useRef } from "react";
import type { ReaderLayoutMode } from "../core/types";
import { mountReaderLinkPreviewCards } from "./components/link-preview-card";
import { prepareArticleHtml } from "./html/string-prep";
import { runReaderDomEnhancements } from "./html/dom-enhancements";
import { enhanceCodeBlocks } from "./lib/code-block";

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
  showLinkPreviews = true,
  layoutMode = "normalized",
}: {
  html: string;
  baseUrl?: string | null;
  openLinksInNewTab?: boolean;
  showLinkPreviews?: boolean;
  layoutMode?: ReaderLayoutMode;
}) {
  const articleBodyRef = useRef<HTMLDivElement | null>(null);
  const enhancementRunRef = useRef(0);
  const cancelScheduledEnhancementRef = useRef<(() => void) | null>(null);
  const linkPreviewCleanupsRef = useRef<(() => void)[]>([]);
  const prepared = useMemo(() => prepareArticleHtml(html, baseUrl), [html, baseUrl]);

  const disposeAllLinkPreviewMounts = useCallback(() => {
    for (let i = linkPreviewCleanupsRef.current.length - 1; i >= 0; i -= 1) {
      linkPreviewCleanupsRef.current[i]();
    }
    linkPreviewCleanupsRef.current = [];
  }, []);

  const runAllEnhancements = useCallback(
    (node: HTMLElement) => {
      enhanceCodeBlocks(node);
      runReaderDomEnhancements(node, { layoutMode });
      updateReaderLinkTargets(node, openLinksInNewTab);
      if (showLinkPreviews) {
        linkPreviewCleanupsRef.current.push(mountReaderLinkPreviewCards(node));
      }
    },
    [layoutMode, openLinksInNewTab, showLinkPreviews],
  );

  const scheduleEnhancements = useCallback(
    (node: HTMLElement) => {
      cancelScheduledEnhancementRef.current?.();
      cancelScheduledEnhancementRef.current = null;

      const runId = enhancementRunRef.current + 1;
      enhancementRunRef.current = runId;
      let timeoutId: number | null = null;
      let frameId: number | null = null;

      const runIfCurrent = () => {
        if (articleBodyRef.current === node && enhancementRunRef.current === runId) {
          runAllEnhancements(node);
        }
      };

      const scheduleVisibleFrame = () => {
        frameId = window.requestAnimationFrame(() => {
          frameId = null;
          timeoutId = window.setTimeout(() => {
            timeoutId = null;
            runIfCurrent();
          }, 0);
        });
      };

      const onVisibilityChange = () => {
        if (document.hidden) {
          return;
        }
        document.removeEventListener("visibilitychange", onVisibilityChange);
        scheduleVisibleFrame();
      };

      if (document.hidden) {
        document.addEventListener("visibilitychange", onVisibilityChange);
      } else {
        scheduleVisibleFrame();
      }

      const cancel = () => {
        document.removeEventListener("visibilitychange", onVisibilityChange);
        if (frameId !== null) {
          window.cancelAnimationFrame(frameId);
        }
        if (timeoutId !== null) {
          window.clearTimeout(timeoutId);
        }
      };

      cancelScheduledEnhancementRef.current = cancel;
      return cancel;
    },
    [runAllEnhancements],
  );

  useEffect(() => {
    disposeAllLinkPreviewMounts();
  }, [prepared, disposeAllLinkPreviewMounts]);

  useEffect(() => {
    const node = articleBodyRef.current;
    if (!node || typeof window === "undefined" || typeof document === "undefined") {
      return;
    }

    return scheduleEnhancements(node);
  }, [layoutMode, openLinksInNewTab, prepared, showLinkPreviews, scheduleEnhancements]);

  // oxlint-disable-next-line react-doctor/exhaustive-deps -- unmount cleanup only reads refs; runs once on unmount
  useEffect(() => {
    return () => {
      cancelScheduledEnhancementRef.current?.();
      cancelScheduledEnhancementRef.current = null;
      for (let i = linkPreviewCleanupsRef.current.length - 1; i >= 0; i -= 1) {
        linkPreviewCleanupsRef.current[i]();
      }
      linkPreviewCleanupsRef.current = [];
    };
  }, []);

  const scheduleEnhancementsAfterMutation = useEffectEvent((node: HTMLElement) => {
    scheduleEnhancements(node);
  });

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
            scheduleEnhancementsAfterMutation(current);
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
      data-reader-layout-mode={layoutMode}
      suppressHydrationWarning
      ref={articleBodyRef}
      dangerouslySetInnerHTML={{ __html: prepared }}
    />
  );
}
