"use client";

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
        <div className="article-body space-y-4">
          {summary
            .split(/\n{2,}/)
            .map((paragraph) => paragraph.trim())
            .filter(Boolean)
            .map((paragraph, index) => (
              <p key={`${index}-${paragraph}`}>{paragraph}</p>
            ))}
        </div>
      ) : !notice ? (
        <p className="text-sm text-muted-foreground">
          This source could not be previewed in the reader.
        </p>
      ) : null}
    </div>
  );
}
