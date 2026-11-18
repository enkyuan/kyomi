import katex from "katex";
// Registers `\ce` and `\pu` so chemistry renders on the web and draws natively, as in MathJax.
import "katex/contrib/mhchem";
import { mathjax } from "mathjax-full/js/mathjax.js";
import { MathML } from "mathjax-full/js/input/mathml.js";
import { TeX } from "mathjax-full/js/input/tex.js";
import { AllPackages } from "mathjax-full/js/input/tex/AllPackages.js";
import { SVG } from "mathjax-full/js/output/svg.js";
import { liteAdaptor } from "mathjax-full/js/adaptors/liteAdaptor.js";
import { RegisterHTMLHandler } from "mathjax-full/js/handlers/html.js";
import { isSafeMathSvg } from "@kyomi/reader/document/math-svg";
import type { ReaderBlock, ReaderInline } from "@kyomi/reader/document";
import { warn, type DocumentDraft, type DocumentPass } from "../document-draft";
import { mapOwnInlines, walkBlockLists } from "../kdm-tree";
import { KATEX_MACROS_FOR_MATHJAX } from "./math-macros";

const MAX_TEX_LENGTH = 20_000;
const MAX_INLINE_TEX_LENGTH = 2_000;
/** Longer text nodes are not scanned, so no formula in one can be longer than {@link MAX_TEX_LENGTH}. */
const MAX_SCANNED_TEXT = 20_000;
/** Beyond this many expressions the rest keep their TeX source without a rendered form. */
const MAX_RENDERED = 500;

/**
 * Explicit delimiters only: `$$…$$`, `\[…\]`, `\(…\)`, top-level math environments, and `$…$`
 * under the Pandoc rule (no space inside the delimiters, no digit right after the closing one),
 * so prices such as "$5 and $10" are left alone. Nothing is inferred from bare TeX in prose.
 * `$` is also a currency sign, a shell sigil and slang ("$$$"), so `$…$` and `$$…$$` are further
 * checked by {@link looksLikeProse} and fall back to their original text when KaTeX rejects them.
 */
const ENVIRONMENTS = "equation|align|gather|multline|eqnarray|alignat|flalign";
const DELIMITED = new RegExp(
  [
    String.raw`(?<![\\$])\$\$(?!\$)([\s\S]{1,${MAX_TEX_LENGTH}}?)(?<!\$)\$\$(?!\$)`,
    String.raw`\\\[([\s\S]{1,${MAX_TEX_LENGTH}}?)\\\]`,
    String.raw`\\\(([\s\S]{1,${MAX_TEX_LENGTH}}?)\\\)`,
    String.raw`(\\begin\{(${ENVIRONMENTS})\*?\}[\s\S]{1,${MAX_TEX_LENGTH}}?\\end\{\5\*?\})`,
    String.raw`(?<![\\$\w])\$(?=[^\s$])((?:\\.|[^$\\\n]){1,${MAX_INLINE_TEX_LENGTH}}?)(?<=[^\s\\])\$(?![\d$])`,
  ].join("|"),
  "g",
);

/** Commands whose braced argument is text or a name, not math symbols. */
const TEXT_GROUP =
  /\\(?:text[A-Za-z]*|math[A-Za-z]*|operatorname\*?|mbox|hbox|fbox|boldsymbol|bm|ce|pu|verb|class|cssId|href|url)\s*(?:\{[^{}]*\}\s*){1,2}/g;
/** Typographic and currency characters that never occur in TeX written for KaTeX. */
const PROSE_CHARS = /[“”‘’€£¥₹…"]/;
/** Dashes are prose punctuation unless the span has TeX structure (`20^\circ C – 40^\circ C`). */
const PROSE_DASH = /[–—]/;

/**
 * True when `$…$` / `$$…$$` content reads like prose, code or a price list rather than a formula:
 * typographic quotes or currency, two adjacent plain words, a run of four or more bare letters
 * (shell variables, tickers, identifiers), or unbalanced parentheses in a longer span. A wrong
 * formula is worse than plain text, so these stay text.
 */
function looksLikeProse(tex: string, strict: boolean): boolean {
  if (PROSE_CHARS.test(tex) || (PROSE_DASH.test(tex) && !/[\\^_]/.test(tex))) {
    return true;
  }
  let bare = tex;
  for (let previous = ""; previous !== bare; ) {
    previous = bare;
    bare = bare.replace(TEXT_GROUP, " ");
  }
  bare = bare.replace(/\\[A-Za-z]+/g, "#");
  if (/[A-Za-z]{2,}\s+[A-Za-z]{2,}/.test(bare)) {
    return true;
  }
  if (!strict) {
    return false;
  }
  // Shell variables and spreadsheet refs (`$Y,$Z`, `$A3,$D3`) leave a trailing separator, and
  // sigil-only spans (`$@$`, `$($`) have no symbol, digit or command at all.
  if (/[,;:]$/.test(tex) || !/[\p{L}\p{N}\\]/u.test(tex)) {
    return true;
  }
  // Price ranges (`$.57-$.67`) and snake_case shell variables (`$BIN_DIR/`); TeX subscripts
  // use a single letter or braces.
  if (/^[.,]\d|[A-Za-z]{2,}_[A-Za-z]{2,}/.test(tex)) {
    return true;
  }
  if (/[A-Za-z]{4,}/.test(bare)) {
    return true;
  }
  if (bare.length > 12) {
    let depth = 0;
    for (const char of bare) {
      depth += char === "(" ? 1 : char === ")" ? -1 : 0;
      if (depth < 0) {
        return true;
      }
    }
    return depth !== 0;
  }
  return false;
}

type Segment =
  | { text: string }
  | {
      tex: string;
      display: boolean;
      /** The matched source with its delimiters, restored when an ambiguous `$` match fails. */
      raw: string;
      /** `$` delimiters are shared with prices and code, so a failed render is not math. */
      ambiguous: boolean;
    };

const OPENERS = new RegExp(String.raw`\\\[|\\\(|\\begin\{(${ENVIRONMENTS})\*?\}`, "g");
const ENVIRONMENT_END = new RegExp(String.raw`\\end\{(${ENVIRONMENTS})\*?\}`, "g");
/** Stands in for the backslash of an opener nothing closes: it starts no delimiter. */
const HIDDEN = "\uFFFF";

/**
 * `value` with the `\[`, `\(` and `\begin{…}` openers that no closer follows made unable to match.
 * The lazy scan for a closer reads to the end of the text for each such opener, so a text of
 * thousands of them costs its length times their count. A closer after a position is after every
 * earlier one, so the unclosed openers are exactly those past the last closer, and hiding them
 * changes no match: those attempts could only fail. The text keeps its length, so indexes carry over.
 */
function hideUnclosedOpeners(value: string): string {
  const lastBracket = value.lastIndexOf("\\]");
  const lastParen = value.lastIndexOf("\\)");
  let lastEnd: Map<string, number> | undefined;
  return value.replace(OPENERS, (opener: string, environment: string | undefined, at: number) => {
    let closer = opener === "\\[" ? lastBracket : lastParen;
    if (environment !== undefined) {
      if (!lastEnd) {
        lastEnd = new Map();
        for (const end of value.matchAll(ENVIRONMENT_END)) {
          lastEnd.set(end[1] as string, end.index);
        }
      }
      closer = lastEnd.get(environment) ?? -1;
    }
    // A formula has at least one character, so its closer starts at least that far after the opener.
    return closer > at + opener.length ? opener : HIDDEN + opener.slice(1);
  });
}

function splitDelimited(value: string): Segment[] | null {
  if (value.length > MAX_SCANNED_TEXT || !/[$\\]/.test(value)) {
    return null;
  }
  const visible = hideUnclosedOpeners(value);
  const segments: Segment[] = [];
  let cursor = 0;
  DELIMITED.lastIndex = 0;
  for (let match = DELIMITED.exec(visible); match; match = DELIMITED.exec(visible)) {
    const display = match[1] !== undefined || match[2] !== undefined || match[4] !== undefined;
    // The match is read from `value`, not `visible`: a hidden opener inside it is still an opener.
    const raw = value.slice(match.index, match.index + match[0].length);
    // An environment carries its own `\begin` and `\end`, `$` is one character, the rest two.
    const edge = match[4] !== undefined ? 0 : match[6] !== undefined ? 1 : 2;
    const tex = raw.slice(edge, raw.length - edge).trim();
    if (!tex || tex.length > MAX_TEX_LENGTH) {
      continue;
    }
    const ambiguous = match[1] !== undefined || match[6] !== undefined;
    // `\(…\)` is also shell escaping (`find \( -name "*.txt" \)`), so every delimiter but the
    // named environments gets the prose check; only `$` gets the strict one.
    if (match[4] === undefined && looksLikeProse(tex, match[6] !== undefined)) {
      continue;
    }
    if (match.index > cursor) {
      segments.push({ text: value.slice(cursor, match.index) });
    }
    segments.push({ tex, display, raw, ambiguous });
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

/** Inline SVGs are only produced for this many formulas per document. */
const MAX_SVG = 300;
/** Total SVG characters per document, so formulas with large glyph paths cannot bloat it. */
const MAX_SVG_TOTAL = 600_000;
/**
 * Packages that emit links or load other code are left out of the MathJax input, and so are the
 * two that swallow errors: `noerrors` and `noundefined` turn a rejected formula into red source
 * text, which would draw something KaTeX refuses instead of falling back to the TeX source.
 */
const MATHJAX_BLOCKED_PACKAGES = new Set([
  "html",
  "require",
  "href",
  "autoload",
  "bussproofs",
  "noerrors",
  "noundefined",
]);
const MATHJAX_PACKAGES = AllPackages.filter((name) => !MATHJAX_BLOCKED_PACKAGES.has(name));
/** KaTeX macros that MathJax spells differently or lacks (generated; see scripts/katex/macros.ts). */
const MATHJAX_MACROS = { ...KATEX_MACROS_FOR_MATHJAX, bm: ["\\boldsymbol{#1}", 1] };
/** MathML elements that carry presentation only; anything else (HTML in tokens, scripts) is refused. */
const MATHML_TAGS = new Set([
  "math",
  "semantics",
  "annotation",
  "mrow",
  "mi",
  "mn",
  "mo",
  "mtext",
  "mspace",
  "msup",
  "msub",
  "msubsup",
  "mfrac",
  "msqrt",
  "mroot",
  "mover",
  "munder",
  "munderover",
  "mtable",
  "mtr",
  "mtd",
  "mstyle",
  "mpadded",
  "mphantom",
  "menclose",
  "mfenced",
]);

type MathJaxRenderer = {
  tex: (tex: string) => string | undefined;
  mathml: (mathml: string) => string | undefined;
};
let mathjaxRenderer: MathJaxRenderer | undefined;

function extractSvg(html: string): string | undefined {
  const start = html.indexOf("<svg");
  const end = html.lastIndexOf("</svg>");
  return start === -1 || end === -1 ? undefined : html.slice(start, end + "</svg>".length);
}

/**
 * MathJax (liteAdaptor, no DOM, `fontCache: "none"`) so each SVG is self-contained. Every TeX
 * formula gets a fresh input jax, because `\newcommand` and `\def` would otherwise leak into the
 * next formula (and the next article), while KaTeX isolates each call.
 */
function getMathJax(): MathJaxRenderer {
  if (mathjaxRenderer) {
    return mathjaxRenderer;
  }
  const adaptor = liteAdaptor();
  RegisterHTMLHandler(adaptor);
  const output = new SVG({ fontCache: "none" });
  const convert = (
    input: TeX<unknown, unknown, unknown> | MathML<unknown, unknown, unknown>,
    source: string,
  ) =>
    extractSvg(
      adaptor.outerHTML(
        mathjax
          .document("", { InputJax: input, OutputJax: output })
          .convert(source, { display: false }),
      ),
    );
  mathjaxRenderer = {
    tex: (tex) =>
      convert(
        new TeX({
          packages: MATHJAX_PACKAGES,
          macros: MATHJAX_MACROS,
          maxMacros: 1_000,
          maxBuffer: 20_000,
          formatError: (_jax: unknown, error: Error) => {
            throw error;
          },
        }),
        tex,
      ),
    mathml: (mathml) => convert(new MathML(), mathml),
  };
  return mathjaxRenderer;
}

/** True when every element in the MathML string is presentation-only math. */
function isPlainMathml(mathml: string): boolean {
  for (const tag of mathml.matchAll(/<\/?([A-Za-z][\w:-]*)/g)) {
    if (!MATHML_TAGS.has((tag[1] ?? "").toLowerCase())) {
      return false;
    }
  }
  return !/<\s*(?:script|style)|\son\w+\s*=/i.test(mathml);
}

type Rendered = {
  html: string | undefined;
  /** KaTeX rejected the source (as opposed to the render budget running out). */
  failed: boolean;
};

type Renderer = {
  render: (tex: string, display: boolean) => Rendered;
  /** Inline SVG for native renderers; undefined when over budget, failing, or unsafe. */
  svg: (tex: string) => string | undefined;
  mathmlSvg: (mathml: string) => string | undefined;
};

function createRenderer(draft: DocumentDraft): Renderer {
  let rendered = 0;
  let svgs = 0;
  let svgChars = 0;
  const safeSvg = (make: () => string | undefined): string | undefined => {
    if (svgs >= MAX_SVG || svgChars >= MAX_SVG_TOTAL) {
      return undefined;
    }
    svgs += 1;
    try {
      const svg = make();
      if (!svg || svg.includes("merror") || !isSafeMathSvg(svg)) {
        warn(draft, "math-svg-failed");
        return undefined;
      }
      svgChars += svg.length;
      return svg;
    } catch {
      warn(draft, "math-svg-failed");
      return undefined;
    }
  };
  return {
    // The native SVG is only drawn for sources KaTeX accepted, so both renderers agree on which
    // formulas are valid; MathJax's wider macro set must not draw what the web falls back on.
    svg: (tex) =>
      tex.length > MAX_INLINE_TEX_LENGTH ? undefined : safeSvg(() => getMathJax().tex(tex)),
    mathmlSvg: (mathml) =>
      isPlainMathml(mathml) ? safeSvg(() => getMathJax().mathml(mathml)) : undefined,
    render(tex, display) {
      if (rendered >= MAX_RENDERED) {
        return { html: undefined, failed: false };
      }
      rendered += 1;
      try {
        return {
          html: katex.renderToString(tex, {
            displayMode: display,
            output: "htmlAndMathml",
            throwOnError: true,
            trust: false,
            strict: "ignore",
            maxExpand: 1_000,
            maxSize: 50,
          }),
          failed: false,
        };
      } catch {
        warn(draft, "math-render-failed");
        return { html: undefined, failed: true };
      }
    },
  };
}

function isBlank(inline: ReaderInline): boolean {
  return inline.type === "text" && !inline.value.trim();
}

type MathInline = Extract<ReaderInline, { type: "math" }>;

/** A formula's SVG is drawn only for sources KaTeX accepted; MathML-only math has no TeX to check. */
function withSvg(inline: MathInline, renderer: Renderer): MathInline {
  if (inline.svg) {
    return inline;
  }
  const svg = inline.tex
    ? inline.rendered
      ? renderer.svg(inline.tex)
      : undefined
    : inline.mathml
      ? renderer.mathmlSvg(inline.mathml)
      : undefined;
  return svg ? { ...inline, svg } : inline;
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
        const { html, failed } = renderer.render(segment.tex, segment.display);
        if (failed && segment.ambiguous) {
          // `$…$` that is not valid TeX was a price, a shell variable or code: keep it as written.
          return { type: "text", value: segment.raw };
        }
        const node: MathInline = {
          type: "math",
          tex: segment.tex,
          ...(html ? { rendered: html } : {}),
        };
        // Display formulas get their SVG later, only if they stay inline instead of becoming blocks.
        return segment.display ? node : withSvg(node, renderer);
      });
    }
    if (inline.type === "math") {
      if (inline.tex && !inline.rendered) {
        const { html } = renderer.render(inline.tex, false);
        return [withSvg(html ? { ...inline, rendered: html } : inline, renderer)];
      }
      return [withSvg(inline, renderer)];
    }
    if ("children" in inline) {
      return [{ ...inline, children: convertInlines(inline.children, renderer) } as ReaderInline];
    }
    return [inline];
  });
}

/** Draws the SVG of display-mode formulas that stayed inside a paragraph. */
function fillDisplaySvgs(
  inlines: ReaderInline[],
  displayTex: Set<string>,
  renderer: Renderer,
): ReaderInline[] {
  return inlines.map((inline): ReaderInline => {
    if (inline.type === "math") {
      return inline.tex && displayTex.has(inline.tex) ? withSvg(inline, renderer) : inline;
    }
    if ("children" in inline) {
      return {
        ...inline,
        children: fillDisplaySvgs(inline.children, displayTex, renderer),
      } as ReaderInline;
    }
    return inline;
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
  const rendered = only.rendered ?? renderer.render(only.tex, true).html;
  return {
    type: "math",
    ...(block.anchor ? { anchor: block.anchor } : {}),
    tex: only.tex,
    ...(rendered ? { rendered } : {}),
  };
}

/** Sources of every display-mode delimiter in the inlines, including inside emphasis or links. */
function collectDisplayTex(inlines: ReaderInline[], into: Set<string>): void {
  for (const inline of inlines) {
    if (inline.type === "text") {
      for (const segment of splitDelimited(inline.value) ?? []) {
        if ("tex" in segment && segment.display) {
          into.add(segment.tex);
        }
      }
    } else if ("children" in inline) {
      collectDisplayTex(inline.children, into);
    }
  }
}

/** Text with its edge whitespace trimmed; null when nothing is left. */
function trimEdge(inlines: ReaderInline[], side: "start" | "end"): ReaderInline[] {
  const index = side === "start" ? 0 : inlines.length - 1;
  const edge = inlines[index];
  if (edge?.type !== "text") {
    return inlines;
  }
  const value = side === "start" ? edge.value.trimStart() : edge.value.trimEnd();
  const rest = inlines.filter((_, at) => at !== index);
  return value ? inlines.map((inline, at) => (at === index ? { ...edge, value } : inline)) : rest;
}

/**
 * A display equation ends the line, so a paragraph that holds one between other content becomes
 * the text before it, the equation as a block, and the text after it. That lets native renderers
 * draw tall formulas (aligned environments, big operators) as real blocks instead of squeezing
 * them into a line of text.
 */
function splitAroundDisplay(
  block: ReaderBlock,
  displayTex: Set<string>,
  renderer: Renderer,
): ReaderBlock[] | null {
  if (block.type !== "paragraph") {
    return null;
  }
  const isDisplay = (inline: ReaderInline) =>
    inline.type === "math" && inline.tex !== undefined && displayTex.has(inline.tex);
  if (!block.children.some(isDisplay)) {
    return null;
  }
  const pieces: ReaderBlock[] = [];
  let run: ReaderInline[] = [];
  let first = true;
  const flush = () => {
    const children = trimEdge(trimEdge(run, "start"), "end");
    if (children.some((inline) => !isBlank(inline))) {
      pieces.push({
        type: "paragraph",
        ...(first && block.anchor ? { anchor: block.anchor } : {}),
        children,
      });
      first = false;
    }
    run = [];
  };
  for (const inline of block.children) {
    if (inline.type === "math" && isDisplay(inline) && inline.tex !== undefined) {
      flush();
      const rendered = inline.rendered ?? renderer.render(inline.tex, true).html;
      pieces.push({
        type: "math",
        ...(first && block.anchor ? { anchor: block.anchor } : {}),
        tex: inline.tex,
        ...(rendered ? { rendered } : {}),
      });
      first = false;
    } else {
      run.push(inline);
    }
  }
  flush();
  return pieces;
}

/**
 * Pass 14. Converts explicit math delimiters in prose (never inside code) into `math` nodes,
 * and renders every TeX source with KaTeX `htmlAndMathml` (`trust: false`, expansion limit).
 * A source that fails to render keeps `tex` only (an ambiguous `$…$` goes back to plain text);
 * publisher MathML without TeX is kept as is. Inline formulas also get a MathJax SVG for native
 * renderers, but only when KaTeX accepted the same source.
 */
export const math: DocumentPass = (draft) => {
  const renderer = createRenderer(draft);

  const process = (blocks: ReaderBlock[]) => {
    walkBlockLists(blocks, (list) => {
      const next: ReaderBlock[] = [];
      for (const block of list) {
        // `$$` alone in a paragraph is display math; remember which sources were display.
        const displayTex = new Set<string>();
        if (block.type === "paragraph") {
          collectDisplayTex(block.children, displayTex);
        }
        if (block.type === "math") {
          if (block.tex && !block.rendered) {
            const { html } = renderer.render(block.tex, true);
            if (html) {
              block.rendered = html;
            }
          }
          next.push(block);
          continue;
        }
        mapOwnInlines(block, (inlines) => convertInlines(inlines, renderer));
        const display = asDisplayBlock(block, displayTex, renderer);
        if (display) {
          next.push(display);
          continue;
        }
        // Hinted paragraphs (captions, credits) keep their shape: later passes look them up.
        const split = draft.hints.has(block)
          ? null
          : splitAroundDisplay(block, displayTex, renderer);
        if (split) {
          next.push(...split);
          continue;
        }
        if (displayTex.size > 0) {
          mapOwnInlines(block, (inlines) => fillDisplaySvgs(inlines, displayTex, renderer));
        }
        next.push(block);
      }
      list.splice(0, list.length, ...next);
    });
  };

  process(draft.blocks);
  for (const footnote of draft.footnotes) {
    process(footnote.children);
  }
};
