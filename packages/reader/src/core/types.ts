export type ReaderBodyKind = "html" | "markdown" | "text" | "fallback";

export type ReaderContentStatus = "ready" | "partial" | "failed" | "pending";

export type ReaderContentSource =
  | "feed_html"
  | "feed_markdown"
  | "feed_summary"
  | "extracted_html"
  | "text_fallback"
  | "link_only";

export type ReaderFallbackReason = "extraction_failed" | "timeout" | "missing_content";

export type ReaderLayoutMode = "fidelity" | "normalized";

export type ReaderDefaultMode = "original" | "extracted" | "smart";

export type ReaderContentWidth = "narrow" | "wide";

export type ReaderContent = {
  bodyKind: ReaderBodyKind;
  contentHtml?: string | null;
  contentMarkdown?: string | null;
  contentText?: string | null;
  contentBaseUrl?: string | null;
  fallbackSummary?: string | null;
  notice?: string | null;
  contentStatus?: ReaderContentStatus | null;
  contentSource?: ReaderContentSource | null;
  fallbackReason?: ReaderFallbackReason | null;
  extractionErrorCode?: string | null;
  extractionErrorMessage?: string | null;
  title?: string | null;
  byline?: string | null;
  excerpt?: string | null;
  siteName?: string | null;
  language?: string | null;
  publishedTime?: string | null;
  shouldExtract?: boolean;
};

export type ReaderPreferences = {
  defaultMode: ReaderDefaultMode;
  fontSizePx: number;
  contentWidth: ReaderContentWidth;
  openLinksInNewTab: boolean;
  showLinkPreviews: boolean;
  showImages: boolean;
};
