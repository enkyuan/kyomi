import type { DocumentPass } from "../document-draft";
import { classifyCode, collectCodeEntries, priorFrom } from "../code-classify";
import { resolveLanguage } from "../code-language";
import { highlightCode } from "../highlighter";

/**
 * Pass 13. Resolves each code block's language (explicit hint, then filename, then shebang or
 * modeline) and stores dual-theme Shiki tokens so clients ship no highlighter. A block with no
 * signal at all gets the classifier's language (colour and label together) when it is confident,
 * and is plain text otherwise.
 * The decision itself lives in `classifyCode`.
 */
export const code: DocumentPass = async (draft) => {
  const entries = collectCodeEntries(draft.blocks);
  // What the author declared for the article's other blocks says what the undeclared ones are.
  const declared = entries.map(({ block }) =>
    resolveLanguage(draft.hints.get(block)?.codeLanguage, block.filename, block.value),
  );
  for (const [index, { block, previous, next, heading }] of entries.entries()) {
    const prior = priorFrom(
      declared.flatMap((other, at) =>
        at !== index && other.source !== "shebang" && other.language ? [other.language.id] : [],
      ),
    );
    const result = await classifyCode({
      value: block.value,
      hint: draft.hints.get(block)?.codeLanguage,
      filename: block.filename,
      previous,
      next,
      heading,
      prior,
    });
    // The label and the colour come from one decision, so a coloured block always says what it is:
    // a language the classifier committed to is named, and a block it could not place is plain text.
    const named = result.language ?? result.colour;
    block.languageSource = result.language ? result.source : result.colour ? "classifier" : result.source;
    block.language = named?.id ?? null;
    block.label = named?.label ?? "Plain text";
    delete block.highlight;
    if (result.colour) {
      const highlight = await highlightCode(block.value, result.colour.id);
      if (highlight) {
        block.highlight = highlight;
      }
    }
  }
};
