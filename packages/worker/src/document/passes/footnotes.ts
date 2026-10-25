import type { ReaderInline } from "@kyomi/reader/document";
import type { DocumentPass, DraftFootnote } from "../document-draft";
import { mapAllInlines, mapInlineTree } from "../kdm-tree";

const isBlankText = (inline: ReaderInline) => inline.type === "text" && !inline.value.trim();

/**
 * Pass 12. Matches footnote bodies collected by lowering (`.footnotes` lists, Substack
 * footnotes, Markdown `[^n]`, authored sidenotes) with the links that point at them, replaces
 * those links with `footnoteRef`, and assigns stable `fn-N` anchors in first-reference order.
 * Bodies nothing references are kept after the referenced ones.
 */
export const footnotes: DocumentPass = (draft) => {
  const byAnchor = new Map<string, DraftFootnote>();
  for (const definition of draft.defs) {
    for (const anchor of definition.anchors) {
      if (!byAnchor.has(anchor)) {
        byAnchor.set(anchor, definition);
      }
    }
  }
  if (byAnchor.size === 0) {
    draft.defs = [];
    return;
  }

  const numbered = new Map<DraftFootnote, number>();
  const order: DraftFootnote[] = [];

  const number = (definition: DraftFootnote) => {
    let value = numbered.get(definition);
    if (value === undefined) {
      value = order.length + 1;
      numbered.set(definition, value);
      order.push(definition);
    }
    return value;
  };

  const replaceRefs = (inlines: ReaderInline[]): ReaderInline[] =>
    mapInlineTree(inlines, (list) =>
      list.flatMap((inline): ReaderInline[] => {
        if (inline.type === "link" && inline.href.startsWith("#")) {
          const definition = byAnchor.get(inline.href.slice(1));
          if (definition) {
            const value = number(definition);
            return [{ type: "footnoteRef", id: `fn-${value}`, label: String(value) }];
          }
        }
        // `<sup><a href="#fn1">1</a></sup>`: the reference already renders as a superscript.
        if (inline.type === "format" && inline.format === "superscript") {
          const content = inline.children.filter((child) => !isBlankText(child));
          if (content.length === 1 && content[0]?.type === "footnoteRef") {
            return content;
          }
        }
        return [inline];
      }),
    );

  mapAllInlines(draft.blocks, replaceRefs);

  // Definitions can reference each other, so keep going until no new one is discovered.
  for (let index = 0; index < order.length; index += 1) {
    mapAllInlines(order[index]!.children, replaceRefs);
  }
  const referenced = order.length;
  for (const definition of draft.defs) {
    number(definition);
  }
  for (let index = referenced; index < order.length; index += 1) {
    mapAllInlines(order[index]!.children, replaceRefs);
  }

  draft.footnotes = order.map((definition, index) => ({
    id: `fn-${index + 1}`,
    label: String(index + 1),
    presentation: definition.presentation,
    children: definition.children,
  }));
  draft.defs = [];
};
