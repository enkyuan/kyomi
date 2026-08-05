"use client";

import { memo, useEffect, useMemo, useState } from "react";
import type { ReaderImageLoading, ReaderLayoutMode } from "../../core/types";
import { hasLikelyMarkdownMath, readerMarkdownToHtml } from "../../shared/markdown-html";
import { RenderHtml } from "../html";
import type { ReaderImageUrlTransformer } from "../html/url-resolve";

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
  imageLoading,
  transformImageUrl,
}: {
  markdown: string;
  baseUrl?: string | null;
  openLinksInNewTab?: boolean;
  showLinkPreviews?: boolean;
  layoutMode?: ReaderLayoutMode;
  imageLoading?: ReaderImageLoading;
  transformImageUrl?: ReaderImageUrlTransformer;
}) {
  const [mathHtml, setMathHtml] = useState<string | null>(null);
  const shouldLoadKatex = useMemo(() => hasLikelyMarkdownMath(markdown), [markdown]);
  const plainHtml = useMemo(
    () => readerMarkdownToHtml(markdown, { baseUrl, openLinksInNewTab }),
    [markdown, baseUrl, openLinksInNewTab],
  );

  // oxlint-disable-next-line react-doctor/no-cascading-set-state -- three setState calls are guarded by shouldLoadKatex and cancellation; they don't cascade in one commit
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
      imageLoading={imageLoading}
      transformImageUrl={transformImageUrl}
    />
  );
});
