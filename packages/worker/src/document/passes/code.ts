import type { ReaderBlock } from "@kyomi/reader/document";
import type { DocumentPass } from "../document-draft";
import { detectLanguage } from "../code-detect";
import { resolveLanguage } from "../code-language";
import { highlightCode } from "../highlighter";
import { walkBlocks } from "../kdm-tree";

/**
 * Pass 13. Resolves each code block's language (explicit hint, then filename, then shebang or
 * modeline) and stores dual-theme Shiki tokens so clients ship no highlighter. A block with no
 * signal at all may still get a confidently detected colouring, but never a language label.
 */
export const code: DocumentPass = async (draft) => {
  const blocks: Extract<ReaderBlock, { type: "code" }>[] = [];
  walkBlocks(draft.blocks, (block) => {
    if (block.type === "code") {
      blocks.push(block);
    }
  });

  for (const block of blocks) {
    const hint = draft.hints.get(block)?.codeLanguage;
    const resolved = resolveLanguage(hint, block.filename, block.value);
    block.languageSource = resolved.source;
    block.language = resolved.language?.id ?? null;
    block.label = resolved.language?.label ?? "Plain text";
    delete block.highlight;
    const colourLanguage =
      resolved.language ?? (resolved.source === "none" ? await detectLanguage(block.value) : null);
    if (colourLanguage) {
      const highlight = await highlightCode(block.value, colourLanguage.id);
      if (highlight) {
        block.highlight = highlight;
      }
    }
  }
};
