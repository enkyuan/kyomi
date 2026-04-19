"use client";

import type { ReaderContent as ReaderContentModel } from "./reader-types";
import { ReaderFallback } from "./reader-fallback";
import { RenderHtml } from "./render-html";
import { RenderMarkdown } from "./render-markdown";
import { RenderText } from "./render-text";

export function ReaderContent({ reader }: { reader: ReaderContentModel }) {
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
    const body = <RenderHtml html={reader.contentHtml} baseUrl={reader.contentBaseUrl} />;
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
      <RenderMarkdown markdown={reader.contentMarkdown} baseUrl={reader.contentBaseUrl} />
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
