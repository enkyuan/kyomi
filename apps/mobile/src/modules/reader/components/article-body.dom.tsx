"use dom";

import { useEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import type { DOMProps } from "expo/dom";
import type { ReaderContent as ReaderContentModel } from "@kyomi/reader";
import { progressFromScroll, scrollTopForProgress } from "@kyomi/reader/core";
import { ReaderContent } from "@kyomi/reader/web";
import { RssIcon } from "@kyomi/ui/icons/blode";
import "@kyomi/reader/web/styles.css";
import "@kyomi/ui/styles/reader.css";
import { mobileColors } from "@/theme/colors";
import { FONT_FAMILIES, FONT_WEIGHTS } from "@/theme/fonts";
import { mobileReaderLayout } from "../lib/layout";
import { readerCanvas } from "../lib/theme";
import { resolveMobileApiUrl } from "@/lib/api";

const MOBILE_READER_STYLES = String.raw`
  :root {
    color-scheme: light dark;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }

  * {
    box-sizing: border-box;
  }

  html,
  body,
  #root {
    width: 100%;
    min-width: 0;
    min-height: 100%;
    margin: 0;
    overflow-x: clip;
  }

  .mobile-reader {
    --reader-background: ${readerCanvas.light};
    --reader-foreground: #303030;
    --reader-muted: #757575;
    --reader-card: #ffffff;
    --foreground: var(--reader-foreground);
    --card: var(--reader-card);
    --ring: ${mobileColors.mutedIcon};
    width: 100%;
    min-width: 0;
    max-width: 100%;
    min-height: 100vh;
    padding: ${mobileReaderLayout.contentInsetPx}px ${mobileReaderLayout.contentInsetPx}px var(--mobile-reader-bottom-inset, 112px);
    background: var(--reader-background);
    color: var(--reader-foreground);
    overflow-x: clip;
  }

  .mobile-reader[data-color-scheme="dark"] {
    --reader-background: ${readerCanvas.dark};
    --reader-foreground: #f7f7f7;
    --reader-muted: ${mobileColors.mutedIcon};
    --reader-card: #292929;
    --ring: #71717a;
  }

  .mobile-reader__header {
    width: 100%;
    min-width: 0;
    max-width: 44rem;
    margin: 0 auto ${mobileReaderLayout.headerBottomMarginPx}px;
  }

  .mobile-reader__source {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin: 0 0 ${mobileReaderLayout.source.marginBottomPx}px;
    color: var(--reader-muted);
    font-family: "${FONT_FAMILIES.inter.semibold}", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    font-size: ${mobileReaderLayout.source.fontSizePx}px;
    font-weight: ${FONT_WEIGHTS.semibold};
    letter-spacing: 0.01em;
  }

  .mobile-reader__source-favicon {
    width: 1.25rem;
    height: 1.25rem;
    flex: none;
    border-radius: 3px;
    background: var(--reader-card);
    object-fit: contain;
  }

  .mobile-reader__title {
    margin: 0;
    color: var(--reader-foreground);
    font-family: "${FONT_FAMILIES.inter.bold}", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    font-size: clamp(${mobileReaderLayout.title.minFontSizePx}px, 7vw, ${mobileReaderLayout.title.maxFontSizePx}px);
    font-weight: ${FONT_WEIGHTS.bold};
    letter-spacing: -0.035em;
    line-height: ${mobileReaderLayout.title.lineHeight};
    overflow-wrap: anywhere;
    text-wrap: balance;
  }

  .mobile-reader__content {
    width: 100%;
    min-width: 0;
    max-width: 44rem;
    margin: 0 auto;
  }

  .mobile-reader .reader-content {
    --font-reader: "${FONT_FAMILIES.dmSans.regular}", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    --font-sans: "${FONT_FAMILIES.inter.regular}", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    --font-mono: "SF Mono", SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    --font-code: var(--font-mono);
    width: 100%;
    min-width: 0;
    max-width: 100%;
  }

  .mobile-reader .reader-content .article-body {
    min-width: 0;
    max-width: 100%;
    color: color-mix(in srgb, var(--reader-foreground) 92%, transparent);
    font-size: var(--reader-font-size, ${mobileReaderLayout.body.fontSizePx}px);
    line-height: ${mobileReaderLayout.body.lineHeight};
  }

  .mobile-reader .reader-content .article-body :is(p, li, blockquote, td, th) {
    overflow-wrap: anywhere;
  }

  .mobile-reader .reader-content .article-body :is(p, ul, ol, blockquote, pre, figure, table) {
    margin: 0 0 ${mobileReaderLayout.body.paragraphGapEm}em;
  }

  .mobile-reader .reader-content .article-body :is(ul, ol) {
    padding-inline-start: 1.3em;
  }

  .mobile-reader .reader-content .article-body table {
    display: block;
    max-width: 100%;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }

  .mobile-reader .reader-content img {
    outline: 1px solid rgba(0, 0, 0, 0.1);
    outline-offset: -1px;
  }

  .mobile-reader[data-color-scheme="dark"] .reader-content img {
    outline-color: rgba(255, 255, 255, 0.1);
  }

  .mobile-reader .reader-content .article-body a {
    color: inherit;
    text-decoration-color: color-mix(in srgb, var(--reader-foreground) 45%, transparent);
    text-underline-offset: 0.16em;
  }

  .mobile-reader .reader-content .article-body blockquote {
    margin-left: 0;
    border-left: 3px solid color-mix(in srgb, var(--reader-foreground) 22%, transparent);
    padding-left: 1rem;
    color: var(--reader-muted);
  }

  .mobile-reader .reader-content .article-body :is(h1, h2, h3, h4, h5, h6) {
    color: var(--reader-foreground);
  }

`;

type ArticleBodyProps = {
  readonly bottomInset: number;
  readonly colorScheme: "dark" | "light";
  readonly faviconUrls: readonly string[];
  readonly feedTitle: string;
  readonly fontSizePx: number;
  /** Where to put the reader once the body is laid out, as a fraction of the article (0..1). */
  readonly initialProgress?: number;
  readonly onReady?: () => void;
  /** Sent at most every 2 s while reading, and when scrolling ends. */
  readonly onReadingProgress?: (sample: { progress: number; completed: boolean }) => void;
  readonly reader: ReaderContentModel;
  readonly title: string;
  readonly dom?: DOMProps;
};

function ReaderSource({
  faviconUrls,
  feedTitle,
}: Pick<ArticleBodyProps, "faviconUrls" | "feedTitle">) {
  const [faviconIndex, setFaviconIndex] = useState(0);
  const faviconUrl = faviconUrls[faviconIndex];

  return (
    <p className="mobile-reader__source">
      {faviconUrl ? (
        <img
          alt=""
          aria-hidden="true"
          className="mobile-reader__source-favicon"
          key={faviconUrl}
          loading="eager"
          onError={() => {
            setFaviconIndex((current) => Math.min(current + 1, faviconUrls.length));
          }}
          src={faviconUrl}
        />
      ) : faviconIndex >= faviconUrls.length ? (
        <RssIcon aria-hidden="true" className="mobile-reader__source-favicon" size={20} />
      ) : null}
      <span>{feedTitle}</span>
    </p>
  );
}

const READING_SAMPLE_INTERVAL_MS = 2_000;
const READING_SCROLL_END_MS = 150;
/** Images and fonts keep resizing the body after first layout; a restore follows them this long. */
const RESTORE_SETTLE_MS = 4_000;

type ReadingTracking = {
  /** Samples wait for a pending restore so the top of the article never overwrites a saved position. */
  held: boolean;
  userScrolled: boolean;
  emit: () => void;
};

/**
 * Restores `initialProgress` and reports reading progress. The page scrolls inside its own WebView,
 * so scroll position, viewport and article geometry are read here and only samples cross the bridge.
 */
function useReadingProgressTracking(
  articleRef: RefObject<HTMLElement | null>,
  initialProgress: number | undefined,
  onReadingProgress: ArticleBodyProps["onReadingProgress"],
) {
  const reportRef = useRef(onReadingProgress);
  useEffect(() => {
    reportRef.current = onReadingProgress;
  }, [onReadingProgress]);
  const tracking = useRef<ReadingTracking>({
    emit: () => undefined,
    held: initialProgress !== undefined,
    userScrolled: false,
  });

  useEffect(() => {
    const article = articleRef.current;
    if (!article) return;
    const state = tracking.current;

    let lastEmitAt = 0;
    let trailing: number | undefined;
    let scrollEnd: number | undefined;

    const emit = () => {
      if (state.held || !reportRef.current) return;
      const scrollTop = window.scrollY;
      const progress = progressFromScroll({
        contentHeight: article.offsetHeight,
        contentTop: article.getBoundingClientRect().top + scrollTop,
        scrollTop,
        viewportHeight: window.innerHeight,
      });
      // The reading line never reaches the end of the body, so the end is checked directly: the
      // last of the article is on screen after the reader has scrolled.
      const completed =
        scrollTop > 0 && article.getBoundingClientRect().bottom <= window.innerHeight + 2;
      lastEmitAt = Date.now();
      reportRef.current({ completed, progress });
    };
    state.emit = emit;

    const onScroll = () => {
      const wait = READING_SAMPLE_INTERVAL_MS - (Date.now() - lastEmitAt);
      if (wait <= 0) {
        emit();
      } else {
        if (trailing === undefined) {
          trailing = window.setTimeout(() => {
            trailing = undefined;
            emit();
          }, wait);
        }
      }
      window.clearTimeout(scrollEnd);
      scrollEnd = window.setTimeout(emit, READING_SCROLL_END_MS);
    };
    const onUserInput = () => {
      state.userScrolled = true;
    };

    // One signal owns every listener, so a single abort removes them all.
    const listeners = new AbortController();
    window.addEventListener("scroll", onScroll, { passive: true, signal: listeners.signal });
    for (const type of ["touchstart", "wheel", "keydown"] as const) {
      window.addEventListener(type, onUserInput, {
        capture: true,
        passive: true,
        signal: listeners.signal,
      });
    }
    return () => {
      listeners.abort();
      window.clearTimeout(trailing);
      window.clearTimeout(scrollEnd);
      state.emit = () => undefined;
    };
  }, [articleRef]);

  useEffect(() => {
    const article = articleRef.current;
    const state = tracking.current;
    if (!article) return;

    if (initialProgress === undefined) {
      // Nothing to restore: the first scroll is the first sample.
      state.held = false;
      return;
    }
    if (state.userScrolled) return;

    const restore = () => {
      if (state.userScrolled) return;
      const top = scrollTopForProgress(initialProgress, {
        contentHeight: article.offsetHeight,
        contentTop: article.getBoundingClientRect().top + window.scrollY,
        viewportHeight: window.innerHeight,
      });
      window.scrollTo({ behavior: "instant", top });
      if (state.held) {
        state.held = false;
        state.emit();
      }
    };

    restore();
    const observer = new ResizeObserver(restore);
    observer.observe(article);
    const stop = window.setTimeout(() => observer.disconnect(), RESTORE_SETTLE_MS);
    return () => {
      observer.disconnect();
      window.clearTimeout(stop);
    };
  }, [articleRef, initialProgress]);
}

function createReaderImageProxyUrl(sourceUrl: string): string {
  return resolveMobileApiUrl(`/api/reader-image?url=${encodeURIComponent(sourceUrl)}`);
}

export default function ArticleBody({
  bottomInset,
  colorScheme,
  faviconUrls,
  feedTitle,
  fontSizePx,
  initialProgress,
  onReady,
  onReadingProgress,
  reader,
  title,
}: ArticleBodyProps) {
  const didNotifyReady = useRef(false);
  const articleRef = useRef<HTMLElement>(null);
  useReadingProgressTracking(articleRef, initialProgress, onReadingProgress);

  useEffect(() => {
    didNotifyReady.current = false;
    const frameId = window.requestAnimationFrame(() => {
      if (!didNotifyReady.current) {
        didNotifyReady.current = true;
        onReady?.();
      }
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [onReady, reader]);

  return (
    <main
      className="mobile-reader"
      data-color-scheme={colorScheme}
      style={
        {
          "--reader-font-size": `${fontSizePx}px`,
          "--mobile-reader-bottom-inset": `${bottomInset}px`,
        } as CSSProperties
      }
    >
      <style>{MOBILE_READER_STYLES}</style>
      <header className="mobile-reader__header">
        <ReaderSource
          key={faviconUrls.join("\n")}
          faviconUrls={faviconUrls}
          feedTitle={feedTitle}
        />
        <h1 className="mobile-reader__title">{title}</h1>
      </header>
      <article className="mobile-reader__content reader-content" ref={articleRef}>
        <ReaderContent
          layoutMode="fidelity"
          openLinksInNewTab
          reader={reader}
          showLinkPreviews={false}
          transformImageUrl={createReaderImageProxyUrl}
          imageLoading="eager"
        />
      </article>
    </main>
  );
}
