import katex from "katex";
import type { ReaderBlock, ReaderInline } from "@kyomi/reader/document";
import { warn, type DocumentDraft, type DocumentPass } from "../document-draft";
import { mapOwnInlines, walkBlockLists } from "../kdm-tree";

const MAX_TEX_LENGTH = 20_000;
const MAX_INLINE_TEX_LENGTH = 2_000;
/**
 * Longer text nodes are not scanned: an unclosed `\[` or `$$` makes the lazy match rescan to the
 * end for every opener, which is quadratic on hostile input.
 */
const MAX_SCANNED_TEXT = 20_000;
/** Beyond this many expressions the rest keep their TeX source without a rendered form. */
const MAX_RENDERED = 500;

/**
 * Explicit delimiters only: `$$…$$`, `\[…\]`, `\(…\)`, top-level math environments, and `$…$`
 * under the Pandoc rule (no space inside the delimiters, no digit right after the closing one),
 * so prices such as "$5 and $10" are left alone. Nothing is inferred from bare TeX in prose.
 */
const DELIMITED = new RegExp(
  [
    String.raw`(?<![\\$])\$\$([\s\S]{1,${MAX_TEX_LENGTH}}?)\$\$`,
    String.raw`\\\[([\s\S]{1,${MAX_TEX_LENGTH}}?)\\\]`,
    String.raw`\\\(([\s\S]{1,${MAX_TEX_LENGTH}}?)\\\)`,
    String.raw`(\\begin\{(equation|align|gather|multline|eqnarray|alignat|flalign)\*?\}[\s\S]{1,${MAX_TEX_LENGTH}}?\\end\{\5\*?\})`,
    String.raw`(?<![\\$])\$(?=[^\s$])((?:\\.|[^$\\\n]){1,${MAX_INLINE_TEX_LENGTH}}?)(?<=[^\s\\])\$(?![\d$])`,
  ].join("|"),
  "g",
);

type Segment = { text: string } | { tex: string; display: boolean };

function splitDelimited(value: string): Segment[] | null {
  if (value.length > MAX_SCANNED_TEXT || !/[$\\]/.test(value)) {
    return null;
  }
  const segments: Segment[] = [];
  let cursor = 0;
  DELIMITED.lastIndex = 0;
  for (let match = DELIMITED.exec(value); match; match = DELIMITED.exec(value)) {
    const display = match[1] !== undefined || match[2] !== undefined || match[4] !== undefined;
    const tex = (match[1] ?? match[2] ?? match[3] ?? match[4] ?? match[6] ?? "").trim();
    if (!tex || tex.length > MAX_TEX_LENGTH) {
      continue;
    }
    if (match.index > cursor) {
      segments.push({ text: value.slice(cursor, match.index) });
    }
    segments.push({ tex, display });
    cursor = match.index + match[0].length;
  }
  if (segments.length === 0) {
    return null;
  }
  if (cursor < value.length) {
    segments.push({ text: value.slice(cursor) });
  }
  return segments;
}

type Renderer = { render: (tex: string, display: boolean) => string | undefined };

function createRenderer(draft: DocumentDraft): Renderer {
  let rendered = 0;
  return {
    render(tex, display) {
      if (rendered >= MAX_RENDERED) {
        return undefined;
      }
      rendered += 1;
      try {
        return katex.renderToString(tex, {
          displayMode: display,
          output: "htmlAndMathml",
          throwOnError: true,
          trust: false,
          strict: "ignore",
          maxExpand: 1_000,
          maxSize: 50,
        });
      } catch {
        warn(draft, "math-render-failed");
        return undefined;
      }
    },
  };
}

function isBlank(inline: ReaderInline): boolean {
  return inline.type === "text" && !inline.value.trim();
}

function convertInlines(inlines: ReaderInline[], renderer: Renderer): ReaderInline[] {
  return inlines.flatMap((inline): ReaderInline[] => {
    if (inline.type === "text") {
      const segments = splitDelimited(inline.value);
      if (!segments) {
        return [inline];
      }
      return segments.map((segment): ReaderInline => {
        if ("text" in segment) {
          return { type: "text", value: segment.text };
        }
        // Display environments such as `align` only render in display mode.
        const rendered = renderer.render(segment.tex, segment.display);
        return { type: "math", tex: segment.tex, ...(rendered ? { rendered } : {}) };
      });
    }
    if (inline.type === "math") {
      if (inline.tex && !inline.rendered) {
        const rendered = renderer.render(inline.tex, false);
        return [{ ...inline, ...(rendered ? { rendered } : {}) }];
      }
      return [inline];
    }
    if ("children" in inline) {
      return [{ ...inline, children: convertInlines(inline.children, renderer) } as ReaderInline];
    }
    return [inline];
  });
}

/** A paragraph that is one display equation (and nothing else) becomes a math block. */
function asDisplayBlock(
  block: ReaderBlock,
  displayTex: Set<string>,
  renderer: Renderer,
): ReaderBlock | null {
  if (block.type !== "paragraph") {
    return null;
  }
  const content = block.children.filter((inline) => !isBlank(inline));
  const only = content.length === 1 ? content[0] : undefined;
  if (only?.type !== "math" || !only.tex || !displayTex.has(only.tex)) {
    return null;
  }
  const rendered = only.rendered ?? renderer.render(only.tex, true);
  return {
    type: "math",
    ...(block.anchor ? { anchor: block.anchor } : {}),
    tex: only.tex,
    ...(rendered ? { rendered } : {}),
  };
}

/**
 * Pass 14. Converts explicit math delimiters in prose (never inside code) into `math` nodes,
 * and renders every TeX source with KaTeX `htmlAndMathml` (`trust: false`, expansion limit).
 * A source that fails to render keeps `tex` only; publisher MathML without TeX is kept as is.
 */
export const math: DocumentPass = (draft) => {
  const renderer = createRenderer(draft);

  const process = (blocks: ReaderBlock[]) => {
    walkBlockLists(blocks, (list) => {
      for (const [index, block] of list.entries()) {
        // `$$` alone in a paragraph is display math; remember which sources were display.
        const displayTex = new Set<string>();
        if (block.type === "paragraph") {
          for (const inline of block.children) {
            if (inline.type === "text") {
              for (const segment of splitDelimited(inline.value) ?? []) {
                if ("tex" in segment && segment.display) {
                  displayTex.add(segment.tex);
                }
              }
            }
          }
        }
        if (block.type === "math") {
          if (block.tex && !block.rendered) {
            const rendered = renderer.render(block.tex, true);
            if (rendered) {
              block.rendered = rendered;
            }
          }
          continue;
        }
        mapOwnInlines(block, (inlines) => convertInlines(inlines, renderer));
        const display = asDisplayBlock(block, displayTex, renderer);
        if (display) {
          list[index] = display;
        }
      }
    });
  };

  process(draft.blocks);
  for (const footnote of draft.footnotes) {
    process(footnote.children);
  }
};
