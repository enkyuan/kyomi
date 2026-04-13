"use client";

export function RenderText({ text }: { text: string }) {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  return (
    <div className="article-body space-y-4">
      {paragraphs.length > 0 ? (
        paragraphs.map((paragraph, index) => <p key={`${index}-${paragraph}`}>{paragraph}</p>)
      ) : (
        <p>{text}</p>
      )}
    </div>
  );
}
