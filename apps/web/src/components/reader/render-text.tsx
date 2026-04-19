"use client";

function inferMonospaceFriendly(text: string): boolean {
  const lines = text.split("\n").filter((l) => l.trim());
  if (lines.length < 2) {
    return false;
  }
  let hits = 0;
  for (const line of lines) {
    const t = line.trimStart();
    if (
      /^(?:\$|>|#|\[[\d:]+\]|git\s|npm\s|yarn\s|pnpm\s|curl\s|wget\s)/i.test(t) ||
      /^\s{4,}\S/.test(line)
    ) {
      hits++;
    }
  }
  return hits / lines.length >= 0.35;
}

export function RenderText({ text }: { text: string }) {
  const mono = inferMonospaceFriendly(text);
  return (
    <div className="article-body">
      <div
        className={
          mono
            ? "whitespace-pre-wrap break-words font-mono text-[13px] leading-relaxed [tab-size:2]"
            : "whitespace-pre-wrap break-words leading-relaxed [tab-size:2]"
        }
      >
        {text}
      </div>
    </div>
  );
}
