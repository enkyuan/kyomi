"use client";

import type { ReaderContent as ReaderContentModel } from "./reader-types";
import { ReaderFallback } from "./reader-fallback";
import { RenderHtml } from "./render-html";
import { RenderMarkdown } from "./render-markdown";
import { RenderText } from "./render-text";

export function ReaderContent({ reader }: { reader: ReaderContentModel }) {
  const showNotice = reader.notice && reader.bodyKind !== "fallback";

  return (
    <div>
      {showNotice ? <p className="mt-3 text-sm text-muted-foreground">{reader.notice}</p> : null}

      {reader.bodyKind === "html" && reader.contentHtml ? (
        <RenderHtml html={reader.contentHtml} />
      ) : null}

      {reader.bodyKind === "markdown" && reader.contentMarkdown ? (
        <RenderMarkdown markdown={reader.contentMarkdown} />
      ) : null}

      {reader.bodyKind === "text" && reader.contentText ? (
        <RenderText text={reader.contentText} />
      ) : null}

      {reader.bodyKind === "fallback" ||
      (!reader.contentHtml && !reader.contentMarkdown && !reader.contentText) ? (
        <ReaderFallback notice={reader.notice} summary={reader.fallbackSummary} />
      ) : null}
    </div>
  );
}
