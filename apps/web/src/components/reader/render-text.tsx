"use client";

export function RenderText({ text }: { text: string }) {
  return (
    <div className="article-body">
      <div className="whitespace-pre-wrap break-words [tab-size:2]">{text}</div>
    </div>
  );
}
