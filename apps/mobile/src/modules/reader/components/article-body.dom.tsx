"use dom";

import { useEffect, type CSSProperties } from "react";
import type { DOMProps } from "expo/dom";
import type { ReaderContent as ReaderContentModel } from "@kyomi/reader";
import { ReaderContent } from "@kyomi/reader/web";
import "@kyomi/reader/web/styles.css";
import { readerCanvas } from "../lib/theme";

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
    min-height: 100%;
    margin: 0;
  }

  .mobile-reader {
    --reader-background: ${readerCanvas.light};
    --reader-foreground: #303030;
    --reader-muted: #757575;
    --reader-card: #ffffff;
    --foreground: var(--reader-foreground);
    --card: var(--reader-card);
    --ring: #a1a1aa;
    min-height: 100vh;
    padding: 20px 20px var(--mobile-reader-bottom-inset, 112px);
    background: var(--reader-background);
    color: var(--reader-foreground);
  }

  .mobile-reader[data-color-scheme="dark"] {
    --reader-background: ${readerCanvas.dark};
    --reader-foreground: #f7f7f7;
    --reader-muted: #a1a1aa;
    --reader-card: #292929;
    --ring: #71717a;
  }

  .mobile-reader__header {
    max-width: 44rem;
    margin: 0 auto 2rem;
  }

  .mobile-reader__source {
    margin: 0 0 0.75rem;
    color: var(--reader-muted);
    font-size: 0.875rem;
    font-weight: 600;
    letter-spacing: 0.01em;
  }

  .mobile-reader__title {
    margin: 0;
    color: var(--reader-foreground);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    font-size: clamp(1.875rem, 7vw, 2.5rem);
    font-weight: 700;
    letter-spacing: -0.035em;
    line-height: 1.08;
  }

  .mobile-reader__summary {
    margin: 1rem 0 0;
    color: var(--reader-muted);
    font-size: 1.0625rem;
    line-height: 1.55;
  }

  .mobile-reader__content {
    max-width: 44rem;
    margin: 0 auto;
  }

  .mobile-reader .reader-content {
    --font-reader: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    --font-mono: "SF Mono", SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  }

  .mobile-reader .reader-content .article-body {
    color: color-mix(in srgb, var(--reader-foreground) 92%, transparent);
    font-size: var(--reader-font-size, 17px);
    line-height: 1.68;
  }

  .mobile-reader .reader-content .article-body :is(p, ul, ol, blockquote, pre, figure, table) {
    margin: 0 0 1.15em;
  }

  .mobile-reader .reader-content .article-body :is(ul, ol) {
    padding-inline-start: 1.3em;
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
  readonly feedTitle: string;
  readonly fontSizePx: number;
  readonly reader: ReaderContentModel;
  readonly searchQuery: string;
  readonly summary: string | null;
  readonly title: string;
  readonly dom?: DOMProps;
};

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
  feedTitle,
  fontSizePx,
  reader,
  searchQuery,
  summary,
  title,
}: ArticleBodyProps) {
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
        <p className="mobile-reader__source">{feedTitle}</p>
        <h1 className="mobile-reader__title">{title}</h1>
        {summary ? <p className="mobile-reader__summary">{summary}</p> : null}
      </header>
      <article className="mobile-reader__content reader-content">
        <ReaderContent
          layoutMode="fidelity"
          openLinksInNewTab
          reader={reader}
          showLinkPreviews={false}
        />
      </article>
    </main>
  );
}
