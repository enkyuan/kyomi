/**
 * Normalizes common feed/Markdown presentation noise before reader classification.
 * Does not alter fenced code blocks (lines starting with ``` are skipped in hash cleanup).
 */

function trimTrailingAtxHashes(line: string): string {
  const m = line.match(/^(\s{0,3})(#{1,6}\s+)(.+)$/);
  if (!m) {
    return line;
  }
  const body = m[3];
  const trimmed = body.replace(/\s+#+\s*$/u, "");
  return `${m[1]}${m[2]}${trimmed}`;
}

export function normalizeMarkdownFeedArtifacts(source: string): string {
  const lines = source.split("\n");
  let inFence = false;
  const out: string[] = [];

  for (const line of lines) {
    const fence = line.match(/^\s*(`{3,}|~{3,})/);
    if (fence) {
      inFence = !inFence;
      out.push(line);
      continue;
    }
    if (inFence) {
      out.push(line);
      continue;
    }
    out.push(trimTrailingAtxHashes(line));
  }

  return out.join("\n");
}
