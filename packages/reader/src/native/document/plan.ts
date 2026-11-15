import type { ReaderBlock, ReaderDocument } from "../../core/document";

/** A paragraph-only run is capped so one `Text` never grows without bound. */
export const MAX_PROSE_RUN_BLOCKS = 24;
export const MAX_PROSE_RUN_CHARS = 9_000;

type ParagraphBlock = Extract<ReaderBlock, { type: "paragraph" }>;

export type ReaderSegment =
  | { kind: "prose"; key: string; blocks: ParagraphBlock[] }
  | { kind: "block"; key: string; block: ReaderBlock };

export type ReaderPlan = {
  segments: ReaderSegment[];
  /** Block anchor to the index of the segment that contains it. */
  anchorIndex: Record<string, number>;
  footnotes: Record<string, ReaderDocument["footnotes"][number]>;
};

function nestedBlocks(block: ReaderBlock): ReaderBlock[] {
  switch (block.type) {
    case "list":
      return block.items.flatMap((item) => item.children);
    case "quote":
    case "callout":
    case "details":
    case "mediaText":
      return block.children;
    case "definitionList":
      return block.items.flatMap((item) => item.definitions.flat());
    case "table":
      return [...block.head, ...block.body, ...(block.foot ?? [])].flatMap((row) =>
        row.flatMap((cell) => cell.children),
      );
    default:
      return [];
  }
}

function indexAnchors(block: ReaderBlock, index: number, into: Record<string, number>) {
  if (block.anchor) into[block.anchor] = index;
  for (const child of nestedBlocks(block)) indexAnchors(child, index, into);
}

function approximateLength(block: ParagraphBlock): number {
  let length = 0;
  const walk = (nodes: ParagraphBlock["children"]) => {
    for (const node of nodes) {
      if (node.type === "text" || node.type === "code") length += node.value.length;
      else if ("children" in node) walk(node.children);
      else length += 4;
    }
  };
  walk(block.children);
  return length;
}

/**
 * Splits a document into virtualization units.
 *
 * Consecutive paragraphs form one segment rendered as a single native `Text`, so selection,
 * copy and highlight anchoring span paragraphs. Every other block is its own segment because it
 * needs its own view (media, tables, code) or its own accessibility role (headings). Runs are
 * capped so a very long article still virtualizes.
 */
export function planDocument(document: ReaderDocument): ReaderPlan {
  const segments: ReaderSegment[] = [];
  const anchorIndex: Record<string, number> = {};
  let run: ParagraphBlock[] = [];
  let runChars = 0;

  const flush = () => {
    if (run.length === 0) return;
    const index = segments.length;
    for (const block of run) if (block.anchor) anchorIndex[block.anchor] = index;
    segments.push({ kind: "prose", key: `p${index}`, blocks: run });
    run = [];
    runChars = 0;
  };

  for (const block of document.blocks) {
    if (block.type === "paragraph") {
      const length = approximateLength(block);
      if (
        run.length >= MAX_PROSE_RUN_BLOCKS ||
        (run.length > 0 && runChars + length > MAX_PROSE_RUN_CHARS)
      ) {
        flush();
      }
      run.push(block);
      runChars += length;
      continue;
    }
    flush();
    const index = segments.length;
    indexAnchors(block, index, anchorIndex);
    segments.push({ kind: "block", key: `b${index}`, block });
  }
  flush();

  return {
    segments,
    anchorIndex,
    footnotes: Object.fromEntries(document.footnotes.map((footnote) => [footnote.id, footnote])),
  };
}
