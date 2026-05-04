"use client";

import { memo } from "react";
import type { ReaderLayoutMode } from "../../core";
import { readerMarkdownToHtml } from "../../shared/reader-markdown-html";
import { RenderHtml } from "../html";

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
  const html = readerMarkdownToHtml(markdown, { baseUrl, openLinksInNewTab });
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
