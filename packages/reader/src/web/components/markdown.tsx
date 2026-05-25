"use client";

import { memo, useEffect, useMemo, useState } from "react";
import type { ReaderLayoutMode } from "../../core";
import { hasLikelyMarkdownMath, readerMarkdownToHtml } from "../../shared/reader-markdown-html";
import { RenderHtml } from "../html";

let katexRuntimePromise:
  | Promise<Pick<typeof import("../katex-runtime"), "renderMarkdownWithKatex">>
  | undefined;

function getKatexRuntime() {
  katexRuntimePromise ??= import("../katex-runtime").then((module) => ({
    renderMarkdownWithKatex: module.renderMarkdownWithKatex,
  }));
  return katexRuntimePromise;
}

export const RenderMarkdown = memo(function RenderMarkdown({
  markdown,
  baseUrl,
  openLinksInNewTab = true,
  showLinkPreviews = true,
  layoutMode = "normalized",
}: {
  markdown: string;
  baseUrl?: string | null;
  openLinksInNewTab?: boolean;
  showLinkPreviews?: boolean;
  layoutMode?: ReaderLayoutMode;
}) {
  const [mathHtml, setMathHtml] = useState<string | null>(null);
  const shouldLoadKatex = useMemo(() => hasLikelyMarkdownMath(markdown), [markdown]);
  const plainHtml = useMemo(
    () => readerMarkdownToHtml(markdown, { baseUrl, openLinksInNewTab }),
    [markdown, baseUrl, openLinksInNewTab],
  );

  useEffect(() => {
    if (!shouldLoadKatex) {
      setMathHtml(null);
      return;
    }

    let isCancelled = false;
    setMathHtml(null);

    void getKatexRuntime().then(({ renderMarkdownWithKatex }) => {
      if (isCancelled) {
        return;
      }
      setMathHtml(renderMarkdownWithKatex(markdown, { baseUrl, openLinksInNewTab }));
    });

    return () => {
      isCancelled = true;
    };
  }, [shouldLoadKatex, markdown, baseUrl, openLinksInNewTab]);

  const html = mathHtml ?? plainHtml;

  return (
    <RenderHtml
      html={html}
      baseUrl={baseUrl}
      openLinksInNewTab={openLinksInNewTab}
      showLinkPreviews={showLinkPreviews}
      layoutMode={layoutMode}
    />
  );
});
