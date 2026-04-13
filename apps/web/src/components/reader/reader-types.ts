export type ReaderContent = {
  contentStatus: "ready" | "partial" | "failed" | "pending";
  contentSource:
    | "feed_html"
    | "feed_markdown"
    | "feed_summary"
    | "extracted_html"
    | "text_fallback"
    | "link_only";
  bodyKind: "html" | "markdown" | "text" | "fallback";
  title: string | null;
  byline: string | null;
  excerpt: string | null;
  contentHtml: string | null;
  contentMarkdown: string | null;
  contentText: string | null;
  fallbackSummary: string | null;
  fallbackReason: "extraction_failed" | "timeout" | "missing_content" | null;
  siteName: string | null;
  language: string | null;
  publishedTime: string | null;
  notice: string | null;
  extractionErrorCode: string | null;
  extractionErrorMessage: string | null;
  shouldExtract: boolean;
};
