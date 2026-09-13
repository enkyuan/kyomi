/**
 * Normalizes common feed and Markdown presentation noise before reader classification.
 * It preserves existing fenced code blocks and converts supported indented blocks to fences.
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

function expandedIndent(line: string): number {
  let columns = 0;
  for (const character of line) {
    if (character === " ") {
      columns += 1;
    } else if (character === "\t") {
      columns += 4;
    } else {
      break;
    }
  }
  return columns;
}

function expandTabs(line: string): string {
  return line.replace(/\t/g, "    ");
}

function isListMarker(line: string): boolean {
  return /^\s{0,3}(?:[-+*]|\d+[.)])\s+/.test(line);
}

function previousNonBlankLine(lines: string[], index: number): string | undefined {
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    if (lines[cursor]?.trim()) {
      return lines[cursor];
    }
  }
  return undefined;
}

function convertIndentedCodeBlocks(lines: string[]): string[] {
  const out: string[] = [];
  let index = 0;
  let inFence = false;

  while (index < lines.length) {
    const line = lines[index] ?? "";
    const fence = line.match(/^ {0,3}(`{3,}|~{3,})/);
    if (fence) {
      inFence = !inFence;
      out.push(line);
      index += 1;
      continue;
    }
    const startsBlock =
      !inFence &&
      expandedIndent(line) >= 4 &&
      (index === 0 || !lines[index - 1]?.trim()) &&
      !isListMarker(previousNonBlankLine(lines, index) ?? "");

    if (!startsBlock) {
      out.push(line);
      index += 1;
      continue;
    }

    const block: string[] = [];
    while (index < lines.length) {
      const current = lines[index] ?? "";
      if (!current.trim()) {
        const next = lines[index + 1] ?? "";
        if (expandedIndent(next) >= 4) {
          block.push(current);
          index += 1;
          continue;
        }
        break;
      }
      if (expandedIndent(current) < 4) {
        break;
      }
      block.push(expandTabs(current).slice(4));
      index += 1;
    }

    const generatedFence = block.some((entry) => entry.trimStart().startsWith("```"))
      ? "~~~"
      : "```";
    out.push(generatedFence, ...block, generatedFence);
  }

  return out;
}

export function normalizeMarkdownFeedArtifacts(source: string): string {
  const lines = convertIndentedCodeBlocks(source.split("\n"));
  let inFence = false;
  const out: string[] = [];

  for (const line of lines) {
    const fence = line.match(/^ {0,3}(`{3,}|~{3,})/);
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
