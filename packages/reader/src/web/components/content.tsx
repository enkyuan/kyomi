"use client";

import { memo } from "react";
import type {
  ReaderContent as ReaderContentModel,
  ReaderImageLoading,
  ReaderLayoutMode,
} from "../../core/types";
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

export const ReaderContent = memo(function ReaderContent({
  reader,
  openLinksInNewTab = true,
  showLinkPreviews = true,
  layoutMode = "normalized",
  imageLoading,
  transformImageUrl,
}: {
  reader: ReaderContentModel;
  openLinksInNewTab?: boolean;
  showLinkPreviews?: boolean;
  layoutMode?: ReaderLayoutMode;
  imageLoading?: ReaderImageLoading;
  transformImageUrl?: ReaderImageUrlTransformer;
}) {
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
