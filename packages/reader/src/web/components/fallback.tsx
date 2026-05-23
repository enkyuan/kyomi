"use client";

function renderSummaryParagraphs(summary: string) {
  const duplicateCounts = new Map<string, number>();
  const paragraphs = [];
  for (const raw of summary.split(/\n{2,}/)) {
    const paragraph = raw.trim();
    if (!paragraph) {
      continue;
    }
    const seen = duplicateCounts.get(paragraph) ?? 0;
    duplicateCounts.set(paragraph, seen + 1);
    const key = seen === 0 ? paragraph : `${paragraph}--${seen}`;
    paragraphs.push(<p key={key}>{paragraph}</p>);
  }
  return paragraphs;
}

export function ReaderFallback({
  notice,
  summary,
}: {
  notice: string | null;
  summary: string | null;
}) {
  return (
    <div className="mt-3 space-y-3">
      {notice ? <p className="text-sm text-muted-foreground">{notice}</p> : null}
      {summary ? (
        <div className="article-body space-y-4">{renderSummaryParagraphs(summary)}</div>
      ) : !notice ? (
        <p className="text-sm text-muted-foreground">
          This source could not be previewed in the reader.
        </p>
      ) : null}
    </div>
  );
}
