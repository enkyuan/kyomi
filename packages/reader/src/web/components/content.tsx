"use client";

import { memo, useMemo, type ReactNode } from "react";
import type {
  ReaderContent as ReaderContentModel,
  ReaderImageLoading,
  ReaderLayoutMode,
} from "../../core/types";
import { RenderDocument } from "../document";
import { parseReaderDocument } from "../document/resolve";
import { RenderHtml } from "../html";
import { ReaderFallback } from "./fallback";
import { RenderMarkdown } from "./markdown";
import { RenderText } from "./text";
import type { ReaderImageUrlTransformer } from "../html/url-resolve";

// oxlint-disable-next-line react-doctor/no-multi-comp -- tiny sibling fallback for content variants
function ContractViolationFallback({
  notice,
  fallbackSummary,
}: {
  notice: string | null | undefined;
  fallbackSummary: string | null | undefined;
}) {
  return (
    <ReaderFallback
      notice={
        notice ??
        "Saved content could not be rendered with the expected format. Showing fallback view."
      }
      summary={fallbackSummary ?? null}
    />
  );
}

/**
 * Wire shape of an article body the API compiled into a Kyomi Document. `document` stays
 * `unknown` until validated here, so a document from a newer schema falls back to the HTML body.
 */
export type ReaderDocumentContent = Omit<ReaderContentModel, "bodyKind" | "contentHtml"> & {
  bodyKind: "document";
  document?: unknown;
  documentVersion?: number | null;
  /** The sanitized HTML body served alongside the document; null when it compiled from markdown or text. */
  contentHtml: string | null;
};

type ReaderContentProps = {
  reader: ReaderContentModel | ReaderDocumentContent;
  openLinksInNewTab?: boolean;
  showLinkPreviews?: boolean;
  layoutMode?: ReaderLayoutMode;
  imageLoading?: ReaderImageLoading;
  transformImageUrl?: ReaderImageUrlTransformer;
};

// oxlint-disable-next-line react-doctor/no-multi-comp -- sibling of ReaderContent: validates, then falls back
function DocumentBody({
  reader,
  ...options
}: Omit<ReaderContentProps, "reader"> & { reader: ReaderDocumentContent }) {
  const document = useMemo(() => parseReaderDocument(reader.document), [reader.document]);
  // Memoized so the memoized `ReaderContent` below does not re-render on every parent render.
  const fallbackReader = useMemo((): ReaderContentProps["reader"] | null => {
    if (document) {
      return null;
    }
    // Unsupported version, malformed, or absent: the HTML body is always served alongside.
    const { document: _document, documentVersion: _documentVersion, ...rest } = reader;
    return rest.contentHtml
      ? { ...rest, contentHtml: rest.contentHtml, bodyKind: "html" }
      : { ...rest, bodyKind: "fallback" };
  }, [document, reader]);

  if (!document) {
    return fallbackReader ? <ReaderContent {...options} reader={fallbackReader} /> : null;
  }

  const body = (
    <RenderDocument
      baseUrl={reader.contentBaseUrl ?? document.source.baseUrl}
      document={document}
      // Switching between the original and extracted body, or to a recompiled document, remounts
      // the tree so block-local state (image load status, open details) never carries over.
      key={`${reader.contentSource}:${document.compiler.version}`}
      imageLoading={options.imageLoading}
      layoutMode={options.layoutMode}
      openLinksInNewTab={options.openLinksInNewTab}
      showLinkPreviews={options.showLinkPreviews}
      transformImageUrl={options.transformImageUrl}
    />
  );
  if (!reader.notice) {
    return body;
  }
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{reader.notice}</p>
      {body}
    </div>
  );
}

type ReaderBodyOptions = Required<
  Pick<ReaderContentProps, "openLinksInNewTab" | "showLinkPreviews" | "layoutMode">
> &
  Pick<ReaderContentProps, "imageLoading" | "transformImageUrl">;

/** The rendered html, markdown, or text body; null when the matching content field is empty. */
function renderTextualBody(
  reader: ReaderContentProps["reader"],
  options: ReaderBodyOptions,
): ReactNode {
  switch (reader.bodyKind) {
    case "html":
      return reader.contentHtml ? (
        <RenderHtml html={reader.contentHtml} baseUrl={reader.contentBaseUrl} {...options} />
      ) : null;
    case "markdown":
      return reader.contentMarkdown ? (
        <RenderMarkdown
          markdown={reader.contentMarkdown}
          baseUrl={reader.contentBaseUrl}
          {...options}
        />
      ) : null;
    case "text":
      return reader.contentText ? <RenderText text={reader.contentText} /> : null;
    default:
      return null;
  }
}

export const ReaderContent = memo(function ReaderContent({
  reader,
  openLinksInNewTab = true,
  showLinkPreviews = true,
  layoutMode = "normalized",
  imageLoading,
  transformImageUrl,
}: ReaderContentProps) {
  if (reader.bodyKind === "document") {
    return (
      <DocumentBody
        imageLoading={imageLoading}
        layoutMode={layoutMode}
        openLinksInNewTab={openLinksInNewTab}
        reader={reader}
        showLinkPreviews={showLinkPreviews}
        transformImageUrl={transformImageUrl}
      />
    );
  }

  if (reader.bodyKind === "html" || reader.bodyKind === "markdown" || reader.bodyKind === "text") {
    const body = renderTextualBody(reader, {
      imageLoading,
      layoutMode,
      openLinksInNewTab,
      showLinkPreviews,
      transformImageUrl,
    });
    if (!body) {
      return (
        <ContractViolationFallback
          notice={reader.notice}
          fallbackSummary={reader.fallbackSummary}
        />
      );
    }
    if (!reader.notice) {
      return body;
    }
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">{reader.notice}</p>
        {body}
      </div>
    );
  }

  return (
    <div>
      <ReaderFallback notice={reader.notice ?? null} summary={reader.fallbackSummary ?? null} />
    </div>
  );
});
