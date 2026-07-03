export type ArticleContentStatus = "ready" | "partial" | "failed" | "pending";

/** On-demand source-page extraction lifecycle (stored separately from feed content). */
export type ExtractedContentStatus = "pending" | "ready" | "failed";

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

type ArticleReaderCommon = {
  contentStatus: ArticleReaderStatus;
  contentSource: ArticleContentSource;
  bodyKind: ArticleReaderBodyKind;
  /** Absolute http(s) URL used to resolve relative links/images in content. */
  contentBaseUrl: string | null;
  title: string | null;
  byline: string | null;
  excerpt: string | null;
  siteName: string | null;
  language: string | null;
  publishedTime: string | null;
  notice: string | null;
  extractionErrorCode: string | null;
  extractionErrorMessage: string | null;
  shouldExtract: boolean;
};

type ArticleReaderHtml = ArticleReaderCommon & {
  bodyKind: "html";
  contentHtml: string;
  contentMarkdown: null;
  contentText: string | null;
  fallbackSummary: null;
  fallbackReason: null;
};

type ArticleReaderMarkdown = ArticleReaderCommon & {
  bodyKind: "markdown";
  contentHtml: null;
  contentMarkdown: string;
  contentText: string | null;
  fallbackSummary: null;
  fallbackReason: null;
};

type ArticleReaderText = ArticleReaderCommon & {
  bodyKind: "text";
  contentHtml: null;
  contentMarkdown: null;
  contentText: string;
  fallbackSummary: null;
  fallbackReason: null;
};

type ArticleReaderFallback = ArticleReaderCommon & {
  bodyKind: "fallback";
  contentHtml: null;
  contentMarkdown: null;
  contentText: null;
  fallbackSummary: string | null;
  fallbackReason: ArticleReaderFallbackReason;
};

export type ArticleReaderContentDto =
  | ArticleReaderHtml
  | ArticleReaderMarkdown
  | ArticleReaderText
  | ArticleReaderFallback;

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
