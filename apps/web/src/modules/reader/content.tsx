"use client";

import type { ReaderContent as ReaderContentModel } from "./types";
import { ReaderFallback } from "./fallback";
import { RenderHtml } from "./html";
import { RenderMarkdown } from "./markdown";
import { RenderText } from "./text";

export function ReaderContent({
  reader,
  openLinksInNewTab = true,
}: {
  reader: ReaderContentModel;
  openLinksInNewTab?: boolean;
}) {
  // Client invariant: only render the server-selected `bodyKind`; never re-classify content format.
  function ContractViolationFallback() {
    return (
      <ReaderFallback
        notice={
          reader.notice ??
          "Saved content could not be rendered with the expected format. Showing fallback view."
        }
        summary={reader.fallbackSummary}
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
      <ReaderFallback notice={reader.notice} summary={reader.fallbackSummary} />
    </div>
  );
}
