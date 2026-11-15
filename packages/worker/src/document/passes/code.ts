import type { ReaderBlock, ReaderInline } from "@kyomi/reader/document";
import type { DocumentPass } from "../document-draft";
import { detectLanguage, looksLikeOutput } from "../code-detect";
import { languageFromFilename, resolveLanguage } from "../code-language";
import { highlightCode } from "../highlighter";
import { inlinesText, walkBlockLists } from "../kdm-tree";

/**
 * Pass 13. Resolves each code block's language (explicit hint, then filename, then shebang or
 * modeline) and stores dual-theme Shiki tokens so clients ship no highlighter. A block with no
 * signal at all may still get a confidently detected colouring, but never a language label.
 */
/** Words that introduce a block of tool output, as in "gawain check shop.py prints:". */
const OUTPUT_CUE =
  /\b(?:prints?|outputs?|reports?|shows?|produces?|emits?|displays?|results?)\s*:?\s*$/i;
const FILE_NAME = /^[\w@./-]+\.[A-Za-z0-9]+$/;

type Introduction = { filename?: string; output: boolean };

/** What the paragraph right before a code block says about it: a file it holds, or output. */
function introduction(previous: ReaderBlock | undefined): Introduction {
  if (previous?.type !== "paragraph") {
    return { output: false };
  }
  const text = inlinesText(previous.children).trim();
  let filename: string | undefined;
  const visit = (inlines: readonly ReaderInline[]) => {
    for (const inline of inlines) {
      if (inline.type === "code" && FILE_NAME.test(inline.value.trim())) {
        filename = inline.value.trim();
      } else if ("children" in inline) {
        visit(inline.children);
      }
    }
  };
  visit(previous.children);
  return { ...(filename ? { filename } : {}), output: OUTPUT_CUE.test(text) };
}

export const code: DocumentPass = async (draft) => {
  const blocks: { block: Extract<ReaderBlock, { type: "code" }>; intro: Introduction }[] = [];
  walkBlockLists(draft.blocks, (list) => {
    list.forEach((block, index) => {
      if (block.type === "code") {
        blocks.push({ block, intro: introduction(list[index - 1]) });
      }
    });
  });

  for (const { block, intro } of blocks) {
    const hint = draft.hints.get(block)?.codeLanguage;
    let resolved = resolveLanguage(hint, block.filename, block.value);
    // "Given `shop.py`:" names the file the block shows, which is as good as a filename.
    const introduced = intro.filename ? languageFromFilename(intro.filename) : null;
    if (resolved.source === "none" && introduced && !intro.output) {
      resolved = { source: "filename", language: introduced };
    }
    block.languageSource = resolved.source;
    block.language = resolved.language?.id ?? null;
    block.label = resolved.language?.label ?? "Plain text";
    delete block.highlight;
    const skipDetection = intro.output || looksLikeOutput(block.value);
    const colourLanguage =
      resolved.language ??
      (resolved.source === "none" && !skipDetection ? await detectLanguage(block.value) : null);
    if (colourLanguage) {
      const highlight = await highlightCode(block.value, colourLanguage.id);
      if (highlight) {
        block.highlight = highlight;
      }
    }
  }
};
