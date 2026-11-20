import type { DocumentPass } from "../document-draft";
import { classifyCode, collectCodeEntries, priorFrom } from "../code-classify";
import { MAX_DOCUMENT_MODEL_DETECTIONS } from "../code-detect";
import { resolveLanguage } from "../code-language";
import {
  highlightCode,
  MAX_DOCUMENT_HIGHLIGHT_CHARS,
  MAX_DOCUMENT_HIGHLIGHT_MS,
} from "../highlighter";

/**
 * Pass 13. Resolves each code block's language (explicit hint, then filename, then shebang or
 * modeline) and stores dual-theme Shiki tokens so clients ship no highlighter. A block with no
 * signal at all gets the classifier's language (colour and label together) when it is confident,
 * and is plain text otherwise.
 * The decision itself lives in `classifyCode`. Highlighting spends from two per-document budgets,
 * characters and tokenizing time; a block that no longer fits stays plain.
 */
export const code: DocumentPass = async (draft) => {
  const entries = collectCodeEntries(draft.blocks);
  let highlightBudget = MAX_DOCUMENT_HIGHLIGHT_CHARS;
  const highlightClock = { remainingMs: MAX_DOCUMENT_HIGHLIGHT_MS };
  const modelCalls = { remaining: MAX_DOCUMENT_MODEL_DETECTIONS };
  // What the author declared for the article's blocks says what the undeclared ones are. A block
  // that reads it declared nothing itself, so one list, built once, serves every block.
  const prior = priorFrom(
    entries.flatMap(({ block }) => {
      const declared = resolveLanguage(
        draft.hints.get(block)?.codeLanguage,
        block.filename,
        block.value,
      );
      return declared.source !== "shebang" && declared.language ? [declared.language.id] : [];
    }),
  );
  for (const { block, previous, next, heading } of entries) {
    const result = await classifyCode({
      value: block.value,
      hint: draft.hints.get(block)?.codeLanguage,
      filename: block.filename,
      previous,
      next,
      heading,
      prior,
      modelCalls,
    });
    // The label and the colour come from one decision, so a coloured block always says what it is:
    // a language the classifier committed to is named, and a block it could not place is plain text.
    const named = result.language ?? result.colour;
    block.languageSource = result.language
      ? result.source
      : result.colour
        ? "classifier"
        : result.source;
    block.language = named?.id ?? null;
    block.label = named?.label ?? "Plain text";
    delete block.highlight;
    if (result.colour && block.value.length <= highlightBudget) {
      highlightBudget -= block.value.length;
      const highlight = await highlightCode(block.value, result.colour.id, highlightClock);
      if (highlight) {
        block.highlight = highlight;
      }
    }
  }
};
