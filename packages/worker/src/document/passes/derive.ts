import type { ReaderDocument, ReaderEmbedProvider, ReaderInline } from "@kyomi/reader/document";
import type { DocumentDraft, DocumentPass } from "../document-draft";
import { blocksText, mapOwnInlines, mapInlineTree, walkBlocks } from "../kdm-tree";

const WORDS_PER_MINUTE = 238;
const segmenter = new Intl.Segmenter(undefined, { granularity: "word" });

export function countWords(text: string): number {
  let count = 0;
  for (const segment of segmenter.segment(text)) {
    if (segment.isWordLike) {
      count += 1;
    }
  }
  return count;
}

type Tree = Pick<DocumentDraft, "blocks" | "footnotes">;

/** `features` and the html-block count, computed from the tree alone (also used by `validate`). */
export function describeTree(tree: Tree): {
  features: ReaderDocument["features"];
  htmlBlocks: number;
} {
  let math = false;
  let htmlBlocks = 0;
  const codeLanguages: string[] = [];
  const embedProviders: ReaderEmbedProvider[] = [];

  const visit = (block: Parameters<Parameters<typeof walkBlocks>[1]>[0]) => {
    if (block.type === "math") {
      math = true;
    } else if (block.type === "html") {
      htmlBlocks += 1;
    } else if (block.type === "code" && block.language && !codeLanguages.includes(block.language)) {
      codeLanguages.push(block.language);
    } else if (block.type === "embed" && !embedProviders.includes(block.provider)) {
      embedProviders.push(block.provider);
    }
    mapOwnInlines({ ...block }, (inlines) => {
      mapInlineTree(inlines, (list) => {
        if (list.some((inline: ReaderInline) => inline.type === "math")) {
          math = true;
        }
        return list;
      });
      return inlines;
    });
  };
  walkBlocks(tree.blocks, visit);
  for (const footnote of tree.footnotes) {
    walkBlocks(footnote.children, visit);
  }
  return { features: { math, codeLanguages, embedProviders }, htmlBlocks };
}

/** Pass 17. Fills `features`, `wordCount`, `readingMinutes`, and `diagnostics.htmlBlocks`. */
export const derive: DocumentPass = (draft) => {
  const { features, htmlBlocks } = describeTree(draft);
  draft.features = features;
  draft.diagnostics.htmlBlocks = htmlBlocks;
  const words = countWords(blocksText(draft.blocks));
  draft.meta.wordCount = words;
  draft.meta.readingMinutes = words === 0 ? 0 : Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));
};
