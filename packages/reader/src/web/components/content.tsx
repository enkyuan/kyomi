"use client";

import { memo, useMemo } from "react";
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
export type ReaderDocumentContent = Omit<ReaderContentModel, "bodyKind"> & {
  bodyKind: "document";
  document?: unknown;
  documentVersion?: number | null;
};

type ReaderContentProps = {
  reader: ReaderContentModel | ReaderDocumentContent;
  openLinksInNewTab?: boolean;
  showLinkPreviews?: boolean;
  layoutMode?: ReaderLayoutMode;
  imageLoading?: ReaderImageLoading;
  transformImageUrl?: ReaderImageUrlTransformer;
};

/** Whether `reader` has something to show, for callers that hide empty bodies. */
export function hasReaderContentBody(reader: ReaderContentModel | ReaderDocumentContent): boolean {
  switch (reader.bodyKind) {
    case "document":
      return parseReaderDocument(reader.document) !== null || Boolean(reader.contentHtml?.trim());
    case "html":
      return Boolean(reader.contentHtml?.trim());
    case "markdown":
      return Boolean(reader.contentMarkdown?.trim());
    case "text":
      return Boolean(reader.contentText?.trim());
    default:
      return false;
  }
}

// oxlint-disable-next-line react-doctor/no-multi-comp -- sibling of ReaderContent: validates, then falls back
function DocumentBody({
  reader,
  ...options
}: Omit<ReaderContentProps, "reader"> & { reader: ReaderDocumentContent }) {
  const document = useMemo(() => parseReaderDocument(reader.document), [reader.document]);

  if (!document) {
    // Unsupported version, malformed, or absent: the HTML body is always served alongside.
    const { document: _document, documentVersion: _documentVersion, ...rest } = reader;
    return (
      <ReaderContent
        {...options}
        reader={{
          ...rest,
          bodyKind: reader.contentHtml ? "html" : "fallback",
        }}
      />
    );
  }

  const body = (
    <RenderDocument
      baseUrl={reader.contentBaseUrl ?? document.source.baseUrl}
      document={document}
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

  if (reader.bodyKind === "html") {
    if (!reader.contentHtml) {
      return (
        <ContractViolationFallback
          notice={reader.notice}
          fallbackSummary={reader.fallbackSummary}
        />
      );
    }
    const body = (
      <RenderHtml
        html={reader.contentHtml}
        baseUrl={reader.contentBaseUrl}
        openLinksInNewTab={openLinksInNewTab}
        showLinkPreviews={showLinkPreviews}
        layoutMode={layoutMode}
        imageLoading={imageLoading}
        transformImageUrl={transformImageUrl}
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

  if (reader.bodyKind === "markdown") {
    if (!reader.contentMarkdown) {
      return (
        <ContractViolationFallback
          notice={reader.notice}
          fallbackSummary={reader.fallbackSummary}
        />
      );
    }
    const body = (
      <RenderMarkdown
        markdown={reader.contentMarkdown}
        baseUrl={reader.contentBaseUrl}
        openLinksInNewTab={openLinksInNewTab}
        showLinkPreviews={showLinkPreviews}
        layoutMode={layoutMode}
        imageLoading={imageLoading}
        transformImageUrl={transformImageUrl}
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

  if (reader.bodyKind === "text") {
    if (!reader.contentText) {
      return (
        <ContractViolationFallback
          notice={reader.notice}
          fallbackSummary={reader.fallbackSummary}
        />
      );
    }
    const body = <RenderText text={reader.contentText} />;
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
