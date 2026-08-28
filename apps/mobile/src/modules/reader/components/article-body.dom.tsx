"use dom";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { DOMProps } from "expo/dom";
import type { ReaderContent as ReaderContentModel } from "@kyomi/reader";
import { ReaderContent } from "@kyomi/reader/web";
import { RssIcon } from "@kyomi/ui/icons/rss";
import "@kyomi/reader/web/styles.css";
import "@kyomi/ui/styles/reader.css";
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
    --ring: #a1a1aa;
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
    --reader-muted: #a1a1aa;
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
    font-family: "${FONT_FAMILIES.inter.medium}", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
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

  .mobile-reader .reader-content .article-body [data-reader-search-match] {
    border-radius: 0.15em;
    background: color-mix(in srgb, #a8d480 56%, transparent);
    color: inherit;
  }
`;

type ArticleBodyProps = {
  readonly bottomInset: number;
  readonly colorScheme: "dark" | "light";
  readonly faviconUrls: readonly string[];
  readonly feedTitle: string;
  readonly fontSizePx: number;
  readonly onReady?: () => void;
  readonly reader: ReaderContentModel;
  readonly searchQuery: string;
  readonly title: string;
  readonly dom?: DOMProps;
};

function ReaderSource({
  faviconUrls,
  feedTitle,
}: Pick<ArticleBodyProps, "faviconUrls" | "feedTitle">) {
  const faviconKey = faviconUrls.join("\n");
  const [faviconIndex, setFaviconIndex] = useState(0);
  const faviconUrl = faviconUrls[faviconIndex];

  useEffect(() => {
    setFaviconIndex(0);
  }, [faviconKey]);

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

function clearSearchMatches(root: HTMLElement) {
  for (const match of root.querySelectorAll<HTMLElement>("[data-reader-search-match]")) {
    const parent = match.parentNode;
    if (!parent) {
      continue;
    }
    while (match.firstChild) {
      parent.insertBefore(match.firstChild, match);
    }
    match.remove();
    parent.normalize();
  }
}

function createReaderImageProxyUrl(sourceUrl: string): string {
  return resolveMobileApiUrl(`/api/reader-image?url=${encodeURIComponent(sourceUrl)}`);
}

function highlightSearchMatches(root: HTMLElement, query: string) {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) {
    return [] as HTMLElement[];
  }

  const matches: HTMLElement[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent || !node.nodeValue?.trim()) {
        return NodeFilter.FILTER_REJECT;
      }
      if (parent.closest("mark, script, style, noscript")) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const textNodes: Text[] = [];
  let currentNode = walker.nextNode();
  while (currentNode) {
    textNodes.push(currentNode as Text);
    currentNode = walker.nextNode();
  }

  for (const textNode of textNodes) {
    const value = textNode.nodeValue ?? "";
    const normalizedValue = value.toLocaleLowerCase();
    if (!normalizedValue.includes(normalizedQuery)) {
      continue;
    }

    const fragment = document.createDocumentFragment();
    let index = 0;
    let matchIndex = normalizedValue.indexOf(normalizedQuery, index);
    while (matchIndex !== -1) {
      if (matchIndex > index) {
        fragment.append(value.slice(index, matchIndex));
      }
      const match = document.createElement("mark");
      match.dataset.readerSearchMatch = "";
      match.textContent = value.slice(matchIndex, matchIndex + normalizedQuery.length);
      fragment.append(match);
      matches.push(match);
      index = matchIndex + normalizedQuery.length;
      matchIndex = normalizedValue.indexOf(normalizedQuery, index);
    }
    if (index < value.length) {
      fragment.append(value.slice(index));
    }
    textNode.replaceWith(fragment);
  }

  return matches;
}

export default function ArticleBody({
  bottomInset,
  colorScheme,
  faviconUrls,
  feedTitle,
  fontSizePx,
  onReady,
  reader,
  searchQuery,
  title,
}: ArticleBodyProps) {
  const didNotifyReady = useRef(false);

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

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      const root = document.querySelector<HTMLElement>(".mobile-reader .article-body");
      if (!root) {
        return;
      }

      clearSearchMatches(root);
      const matches = highlightSearchMatches(root, searchQuery);
      const firstMatch = matches[0];
      if (firstMatch) {
        firstMatch.scrollIntoView({
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "auto"
            : "smooth",
          block: "center",
        });
      }
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [reader, searchQuery]);

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
        <ReaderSource faviconUrls={faviconUrls} feedTitle={feedTitle} />
        <h1 className="mobile-reader__title">{title}</h1>
      </header>
      <article className="mobile-reader__content reader-content">
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
