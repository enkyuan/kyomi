"use client";

import {
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react";
import type { ReaderLayoutMode } from "../core/types";
import { hasLikelyDelimitedTex } from "../shared/math";
import { mountReaderLinkPreviewCards } from "./components/link-card";
import { prepareArticleHtml } from "./html/string-prep";
import { runReaderDomEnhancements } from "./html/dom-enhancements";
import { enhanceCodeBlocks } from "./lib/code-block";

let katexRuntimePromise:
  | Promise<Pick<typeof import("./katex-runtime"), "renderMathInHtmlElement">>
  | undefined;

function getKatexRuntime() {
  katexRuntimePromise ??= import("./katex-runtime").then((module) => ({
    renderMathInHtmlElement: module.renderMathInHtmlElement,
  }));
  return katexRuntimePromise;
}

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

function subscribeHydration() {
  return () => {};
}

function getClientHydratedSnapshot() {
  return true;
}

function getServerHydratedSnapshot() {
  return false;
}

function useHydrated() {
  return useSyncExternalStore(
    subscribeHydration,
    getClientHydratedSnapshot,
    getServerHydratedSnapshot,
  );
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
  const mathRenderedHtmlRef = useRef<string | null>(null);
  const cancelScheduledEnhancementRef = useRef<(() => void) | null>(null);
  const linkPreviewCleanupsRef = useRef<(() => void)[]>([]);
  const isHydrated = useHydrated();
  const prepared = useMemo(
    () => (isHydrated ? prepareArticleHtml(html, baseUrl) : ""),
    [baseUrl, html, isHydrated],
  );
  const shouldRenderMath = useMemo(() => hasLikelyDelimitedTex(prepared), [prepared]);

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
      if (shouldRenderMath && mathRenderedHtmlRef.current !== prepared) {
        mathRenderedHtmlRef.current = prepared;
        void getKatexRuntime().then(({ renderMathInHtmlElement }) => {
          if (articleBodyRef.current === node && mathRenderedHtmlRef.current === prepared) {
            renderMathInHtmlElement(node);
          }
        });
      }
      if (showLinkPreviews) {
        linkPreviewCleanupsRef.current.push(mountReaderLinkPreviewCards(node));
      }
    },
    [layoutMode, openLinksInNewTab, prepared, shouldRenderMath, showLinkPreviews],
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
    mathRenderedHtmlRef.current = null;
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
