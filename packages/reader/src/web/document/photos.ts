import type { ReaderBlock, ReaderDocument } from "../../core/document";
import type { ReaderImageUrlTransformer } from "../html/url-resolve";
import type { ReaderPhoto } from "../components/photo-slider";
import { resolveImageUrl } from "./lib";

/** Nested block groups of a container block, in reading order. */
function childGroups(block: ReaderBlock): ReaderBlock[][] {
  switch (block.type) {
    case "quote":
    case "callout":
    case "details":
    case "mediaText":
      return [block.children];
    case "list":
      return block.items.map((item) => item.children);
    case "table":
      return [...block.head, ...block.body, ...(block.foot ?? [])].flatMap((row) =>
        row.map((cell) => cell.children),
      );
    case "definitionList":
      return block.items.flatMap((item) => item.definitions);
    default:
      return [];
  }
}

function visitBlocks(blocks: ReaderBlock[], visit: (block: ReaderBlock) => void): void {
  for (const block of blocks) {
    visit(block);
    for (const group of childGroups(block)) {
      visitBlocks(group, visit);
    }
  }
}

/** Every image the photo viewer can open, in reading order, deduplicated by resolved URL. */
export function collectDocumentPhotos(
  document: ReaderDocument,
  transformImageUrl: ReaderImageUrlTransformer | undefined,
): ReaderPhoto[] {
  const photos: ReaderPhoto[] = [];
  const seen = new Set<string>();
  const add = (image: { src: string; alt: string }) => {
    const src = resolveImageUrl(image.src, transformImageUrl);
    if (!src || seen.has(src)) {
      return;
    }
    seen.add(src);
    photos.push({ key: `${photos.length}:${src}`, src, alt: image.alt.trim() || undefined });
  };

  const collect = (blocks: ReaderBlock[]) =>
    visitBlocks(blocks, (block) => {
      if (block.type === "figure" || block.type === "mediaText") {
        add(block.image);
      } else if (block.type === "gallery") {
        for (const item of block.items) {
          add(item.image);
        }
      } else if (block.type === "embed") {
        for (const image of block.snapshot?.media ?? []) {
          add(image);
        }
      }
    });

  collect(document.blocks);
  for (const footnote of document.footnotes) {
    collect(footnote.children);
  }
  return photos;
}
