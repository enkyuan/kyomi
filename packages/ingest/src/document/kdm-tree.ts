import type { ReaderBlock, ReaderInline } from "@kyomi/reader/document";

/** Every nested block list a block owns, so passes can recurse without knowing each type. */
export function childBlockLists(block: ReaderBlock): ReaderBlock[][] {
  switch (block.type) {
    case "list":
      return block.items.map((item) => item.children);
    case "quote":
    case "callout":
    case "details":
    case "mediaText":
      return [block.children];
    case "table":
      return [block.head, block.body, block.foot ?? []].flatMap((rows) =>
        rows.flatMap((row) => row.map((cell) => cell.children)),
      );
    case "definitionList":
      return block.items.flatMap((item) => item.definitions);
    default:
      return [];
  }
}

/** Visits every block list in the tree, the given one first. */
export function walkBlockLists(blocks: ReaderBlock[], visit: (list: ReaderBlock[]) => void): void {
  visit(blocks);
  for (const block of blocks) {
    for (const list of childBlockLists(block)) {
      walkBlockLists(list, visit);
    }
  }
}

/** Visits every block in document order, nested blocks after their parent. */
export function walkBlocks(blocks: ReaderBlock[], visit: (block: ReaderBlock) => void): void {
  for (const block of blocks) {
    visit(block);
    for (const list of childBlockLists(block)) {
      walkBlocks(list, visit);
    }
  }
}

type InlineMapper = (inlines: ReaderInline[]) => ReaderInline[];

/** Applies `map` to every inline list a block owns directly (not to nested blocks). */
export function mapOwnInlines(block: ReaderBlock, map: InlineMapper): void {
  switch (block.type) {
    case "paragraph":
    case "heading":
      block.children = map(block.children);
      break;
    case "pullQuote":
      block.children = map(block.children);
      if (block.attribution) {
        block.attribution = map(block.attribution);
      }
      break;
    case "quote":
      if (block.attribution) {
        block.attribution = map(block.attribution);
      }
      break;
    case "figure":
      if (block.caption) {
        block.caption = map(block.caption);
      }
      if (block.credit) {
        block.credit = map(block.credit);
      }
      break;
    case "gallery":
      for (const item of block.items) {
        if (item.caption) {
          item.caption = map(item.caption);
        }
      }
      if (block.caption) {
        block.caption = map(block.caption);
      }
      break;
    case "table":
      if (block.caption) {
        block.caption = map(block.caption);
      }
      break;
    case "callout":
      if (block.title) {
        block.title = map(block.title);
      }
      break;
    case "details":
      block.summary = map(block.summary);
      break;
    case "definitionList":
      for (const item of block.items) {
        item.terms = item.terms.map(map);
      }
      break;
    case "video":
    case "audio":
    case "embed":
      if (block.caption) {
        block.caption = map(block.caption);
      }
      break;
    default:
      break;
  }
}

/** Applies `map` to every inline list in the tree, including blocks nested in blocks. */
export function mapAllInlines(blocks: ReaderBlock[], map: InlineMapper): void {
  walkBlocks(blocks, (block) => mapOwnInlines(block, map));
}

/** Applies `map` to each inline list bottom-up, descending into formatting, links, and abbrs. */
export function mapInlineTree(inlines: ReaderInline[], map: InlineMapper): ReaderInline[] {
  const next = inlines.map((inline) =>
    "children" in inline
      ? ({ ...inline, children: mapInlineTree(inline.children, map) } as ReaderInline)
      : inline,
  );
  return map(next);
}

export function inlinesText(inlines: readonly ReaderInline[]): string {
  let text = "";
  for (const inline of inlines) {
    switch (inline.type) {
      case "text":
      case "code":
        text += inline.value;
        break;
      case "break":
        text += " ";
        break;
      case "math":
        text += inline.tex ?? "";
        break;
      case "image":
        text += inline.image.alt;
        break;
      case "footnoteRef":
        break;
      default:
        text += inlinesText(inline.children);
    }
  }
  return text;
}

/** Plain text of a block list in reading order, for recall and word counts. */
export function blocksText(blocks: readonly ReaderBlock[]): string {
  const parts: string[] = [];
  walkBlocks(blocks as ReaderBlock[], (block) => {
    const own: ReaderInline[][] = [];
    mapOwnInlines(structuredCloneShallow(block), (inlines) => {
      own.push(inlines);
      return inlines;
    });
    for (const inlines of own) {
      parts.push(inlinesText(inlines));
    }
    if (block.type === "code") {
      parts.push(block.value);
    }
    if (block.type === "math") {
      parts.push(block.tex ?? "");
    }
  });
  return parts.join("\n");
}

function structuredCloneShallow(block: ReaderBlock): ReaderBlock {
  return { ...block } as ReaderBlock;
}
