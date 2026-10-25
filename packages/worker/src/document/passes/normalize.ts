import type { ReaderBlock, ReaderInline } from "@kyomi/reader/document";
import type { DocumentDraft, DocumentPass } from "../document-draft";
import { inlinesText, mapAllInlines, walkBlockLists, walkBlocks } from "../kdm-tree";

const COLLAPSE = /[ \t\n\r\f]{2,}/g;
const IMAGE_SIZE_SUFFIX =
  /(?:[-_]\d{2,5}x\d{2,5}|[-_](?:thumb|small|medium|large|scaled))(?=\.\w+$)/i;
/** The hero image is usually the first block or two; later images are content. */
const MAX_LEAD_SCAN = 3;

function collapseText(value: string): string {
  return value.replace(COLLAPSE, " ");
}

/** Bottom-up cleanup of one inline list. `trim` is true for a block's own (outermost) list. */
function tidy(
  inlines: ReaderInline[],
  anchors: Set<string>,
  insideLink: boolean,
  trim: boolean,
): ReaderInline[] {
  const flat: ReaderInline[] = [];
  for (const inline of inlines) {
    if (inline.type === "text") {
      flat.push(inline);
      continue;
    }
    if (!("children" in inline)) {
      flat.push(inline);
      continue;
    }
    const children = tidy(inline.children, anchors, insideLink || inline.type === "link", false);
    if (inline.type === "link") {
      const dangling = inline.href.startsWith("#") && !anchors.has(inline.href.slice(1));
      if (insideLink || dangling) {
        flat.push(...children);
        continue;
      }
    }
    if (children.length > 0) {
      flat.push({ ...inline, children } as ReaderInline);
    }
  }

  const merged: ReaderInline[] = [];
  for (const inline of flat) {
    const previous = merged.at(-1);
    if (inline.type === "text") {
      if (!inline.value) {
        continue;
      }
      if (previous?.type === "text") {
        merged[merged.length - 1] = {
          type: "text",
          value: collapseText(previous.value + inline.value),
        };
        continue;
      }
      merged.push({ type: "text", value: collapseText(inline.value) });
    } else {
      merged.push(inline);
    }
  }

  // Spaces next to a line break are layout whitespace from the source markup.
  for (const [index, inline] of merged.entries()) {
    if (inline.type !== "text") {
      continue;
    }
    let { value } = inline;
    if (merged[index - 1]?.type === "break") {
      value = value.trimStart();
    }
    if (merged[index + 1]?.type === "break") {
      value = value.trimEnd();
    }
    merged[index] = { type: "text", value };
  }

  if (trim) {
    const first = merged[0];
    if (first?.type === "text") {
      merged[0] = { type: "text", value: first.value.trimStart() };
    }
    const last = merged.at(-1);
    if (last?.type === "text") {
      merged[merged.length - 1] = { type: "text", value: last.value.trimEnd() };
    }
  }
  return merged.filter((inline) => inline.type !== "text" || inline.value !== "");
}

function isEmpty(block: ReaderBlock): boolean {
  switch (block.type) {
    case "paragraph":
    case "heading":
    case "pullQuote":
      return block.children.length === 0;
    case "list":
      return block.items.length === 0;
    case "quote":
      return block.children.length === 0 && !block.attribution;
    case "callout":
      return block.children.length === 0 && !block.title;
    case "mediaText":
      return false;
    case "code":
      return !block.value.trim();
    case "definitionList":
      return block.items.length === 0;
    default:
      return false;
  }
}

/** Keeps the first block that claims an anchor; later duplicates lose theirs. */
function dedupeAnchors(draft: DocumentDraft): Set<string> {
  const seen = new Set<string>();
  const visit = (block: ReaderBlock) => {
    if (!block.anchor) {
      return;
    }
    if (seen.has(block.anchor)) {
      delete block.anchor;
    } else {
      seen.add(block.anchor);
    }
  };
  walkBlocks(draft.blocks, visit);
  for (const footnote of draft.footnotes) {
    walkBlocks(footnote.children, visit);
  }
  return seen;
}

function dropEmptyBlocks(blocks: ReaderBlock[]): void {
  // Children first, so a container emptied by its children is removed too.
  walkBlockLists(blocks, (list) => {
    for (const block of list) {
      if (block.type === "list") {
        block.items = block.items.filter((item) => item.children.length > 0);
      }
    }
  });
  const prune = (list: ReaderBlock[]) => {
    for (const block of list) {
      if (block.type === "list") {
        block.items.forEach((item) => prune(item.children));
      } else if (
        block.type === "quote" ||
        block.type === "callout" ||
        block.type === "details" ||
        block.type === "mediaText"
      ) {
        prune(block.children);
      }
    }
    for (let index = list.length - 1; index >= 0; index -= 1) {
      if (isEmpty(list[index]!)) {
        list.splice(index, 1);
      }
    }
  };
  prune(blocks);
}

function comparable(value: string): string {
  return value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

function dropTitleHeading(draft: DocumentDraft): void {
  const { title } = draft.meta;
  const first = draft.blocks[0];
  if (
    title &&
    first?.type === "heading" &&
    comparable(inlinesText(first.children)) === comparable(title)
  ) {
    draft.blocks.shift();
  }
}

function shiftHeadings(draft: DocumentDraft): void {
  const headings: Extract<ReaderBlock, { type: "heading" }>[] = [];
  const collect = (block: ReaderBlock) => {
    if (block.type === "heading") {
      headings.push(block);
    }
  };
  walkBlocks(draft.blocks, collect);
  for (const footnote of draft.footnotes) {
    walkBlocks(footnote.children, collect);
  }
  if (headings.length === 0) {
    return;
  }
  const shallowest = Math.min(...headings.map((heading) => heading.level));
  const shift = 2 - shallowest;
  for (const heading of headings) {
    heading.level = Math.min(6, Math.max(2, heading.level + shift));
  }
}

function imageKey(src: string): string {
  try {
    const url = new URL(src);
    return `${url.hostname}${url.pathname}`.replace(IMAGE_SIZE_SUFFIX, "").toLowerCase();
  } catch {
    return src;
  }
}

function moveLeadImage(draft: DocumentDraft): void {
  if (!draft.leadImage) {
    return;
  }
  const wanted = imageKey(draft.leadImage.src);
  for (const [index, block] of draft.blocks.slice(0, MAX_LEAD_SCAN).entries()) {
    if (block.type === "figure" && imageKey(block.image.src) === wanted) {
      draft.meta.leadImage = { ...block.image };
      draft.blocks.splice(index, 1);
      return;
    }
    if (block.type !== "heading" && block.type !== "figure") {
      return;
    }
  }
}

/**
 * Pass 16. Merges adjacent text and collapses whitespace, drops empty nodes, unwraps nested
 * links and links to anchors that do not exist, removes a leading heading equal to the article
 * title, shifts headings so the shallowest is level 2, and moves a hero image the article repeats
 * as its first figure into `meta.leadImage`.
 */
export const normalize: DocumentPass = (draft) => {
  const anchors = dedupeAnchors(draft);
  const clean = (inlines: ReaderInline[]) => tidy(inlines, anchors, false, true);
  mapAllInlines(draft.blocks, clean);
  for (const footnote of draft.footnotes) {
    mapAllInlines(footnote.children, clean);
    dropEmptyBlocks(footnote.children);
  }
  dropEmptyBlocks(draft.blocks);
  dropTitleHeading(draft);
  shiftHeadings(draft);
  moveLeadImage(draft);
};
