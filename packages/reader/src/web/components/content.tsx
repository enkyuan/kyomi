"use client";

import { memo } from "react";
import type { ReaderContent as ReaderContentModel, ReaderLayoutMode } from "../../core";
import { RenderHtml } from "../html";
import { ReaderFallback } from "./fallback";
import { RenderMarkdown } from "./markdown";
import { RenderText } from "./text";

export const ReaderContent = memo(function ReaderContent({
  reader,
  openLinksInNewTab = true,
  showLinkPreviews = true,
  layoutMode = "normalized",
}: {
  reader: ReaderContentModel;
  openLinksInNewTab?: boolean;
  showLinkPreviews?: boolean;
  layoutMode?: ReaderLayoutMode;
}) {
  // Client invariant: only render the server-selected `bodyKind`; never re-classify content format.
  function ContractViolationFallback() {
    return (
      <ReaderFallback
        notice={
          reader.notice ??
          "Saved content could not be rendered with the expected format. Showing fallback view."
        }
        summary={reader.fallbackSummary ?? null}
      />
    );
  }

  if (reader.bodyKind === "html") {
    if (!reader.contentHtml) {
      return <ContractViolationFallback />;
    }
    const body = (
      <RenderHtml
        html={reader.contentHtml}
        baseUrl={reader.contentBaseUrl}
        openLinksInNewTab={openLinksInNewTab}
        showLinkPreviews={showLinkPreviews}
        layoutMode={layoutMode}
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
      return <ContractViolationFallback />;
    }
    const body = (
      <RenderMarkdown
        markdown={reader.contentMarkdown}
        baseUrl={reader.contentBaseUrl}
        openLinksInNewTab={openLinksInNewTab}
        showLinkPreviews={showLinkPreviews}
        layoutMode={layoutMode}
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
      return <ContractViolationFallback />;
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
