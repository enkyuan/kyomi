export type ArticleContentStatus = "ready" | "partial" | "failed" | "pending";
export type ArticleExtractedContentStatus = "pending" | "ready" | "failed";

export type ArticleContentSource =
  | "feed_html"
  | "feed_markdown"
  | "feed_summary"
  | "extracted_html"
  | "text_fallback"
  | "link_only";

export type ArticleReaderStatus = Exclude<ArticleContentStatus, "pending">;

export type ArticleReaderSource = ArticleContentSource;

export type ArticleReaderBodyKind = "html" | "markdown" | "text" | "fallback";

export type ArticleReaderFallbackReason = "extraction_failed" | "timeout" | "missing_content";

export type ArticleReaderContentDto = {
  contentStatus: ArticleContentStatus;
  contentSource: ArticleContentSource;
  bodyKind: ArticleReaderBodyKind;
  title: string | null;
  byline: string | null;
  excerpt: string | null;
  contentHtml: string | null;
  contentMarkdown: string | null;
  contentText: string | null;
  fallbackSummary: string | null;
  fallbackReason: ArticleReaderFallbackReason | null;
  siteName: string | null;
  language: string | null;
  publishedTime: string | null;
  notice: string | null;
  extractionErrorCode: string | null;
  extractionErrorMessage: string | null;
  shouldExtract: boolean;
};

export type ArticleExtractionCandidate = {
  title: string | null;
  byline: string | null;
  excerpt: string | null;
  contentHtml: string | null;
  contentText: string | null;
  siteName: string | null;
  language: string | null;
  publishedTime: string | null;
};

export type ArticleStoredContentDto = {
  contentHtml: string | null;
  contentText: string | null;
  contentMarkdown: string | null;
  contentStatus: ArticleContentStatus;
  contentSource: ArticleContentSource;
  extractionErrorCode: string | null;
  extractionErrorMessage: string | null;
};

export type FetchArticleDocumentResult =
  | {
      ok: true;
      finalUrl: string;
      body: string;
      contentType: string;
    }
  | {
      ok: false;
      errorCode: string;
      errorMessage: string;
    };
