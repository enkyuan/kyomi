import { replaceSpans } from "../../shared/scan";
import { shiftScript } from "./text";

const SYMBOLS: Record<string, string> = {
  alpha: "α",
  beta: "β",
  gamma: "γ",
  delta: "δ",
  epsilon: "ε",
  varepsilon: "ε",
  zeta: "ζ",
  eta: "η",
  theta: "θ",
  lambda: "λ",
  mu: "μ",
  nu: "ν",
  xi: "ξ",
  pi: "π",
  rho: "ρ",
  sigma: "σ",
  tau: "τ",
  phi: "φ",
  varphi: "φ",
  chi: "χ",
  psi: "ψ",
  omega: "ω",
  Gamma: "Γ",
  Delta: "Δ",
  Theta: "Θ",
  Lambda: "Λ",
  Pi: "Π",
  Sigma: "Σ",
  Phi: "Φ",
  Psi: "Ψ",
  Omega: "Ω",
  times: "×",
  cdot: "·",
  div: "÷",
  pm: "±",
  mp: "∓",
  leq: "≤",
  le: "≤",
  geq: "≥",
  ge: "≥",
  neq: "≠",
  ne: "≠",
  approx: "≈",
  equiv: "≡",
  sim: "∼",
  infty: "∞",
  partial: "∂",
  nabla: "∇",
  sum: "∑",
  prod: "∏",
  int: "∫",
  in: "∈",
  notin: "∉",
  subset: "⊂",
  subseteq: "⊆",
  cup: "∪",
  cap: "∩",
  forall: "∀",
  exists: "∃",
  to: "→",
  rightarrow: "→",
  leftarrow: "←",
  Rightarrow: "⇒",
  Leftarrow: "⇐",
  leftrightarrow: "↔",
  ldots: "…",
  dots: "…",
  cdots: "⋯",
  degree: "°",
  circ: "∘",
};

/**
 * Converts a simple inline formula to plain Unicode, or `null` when it needs real layout
 * (`\frac`, `\sqrt`, matrices, unknown commands, scripts with no Unicode form). The caller keeps
 * the TeX source in mono for those, so a formula is never shown wrong.
 */
export function texToUnicode(tex: string): string | null {
  let out = "";
  let index = 0;
  const readGroup = (): string | null => {
    if (tex[index] === "{") {
      const end = tex.indexOf("}", index);
      if (end === -1) return null;
      const body = tex.slice(index + 1, end);
      index = end + 1;
      return body;
    }
    const char = tex[index];
    if (char === undefined) return null;
    index += 1;
    return char;
  };
  while (index < tex.length) {
    const char = tex[index] as string;
    if (char === "\\") {
      const match = /^[A-Za-z]+/.exec(tex.slice(index + 1));
      if (!match) return null;
      const symbol = Object.hasOwn(SYMBOLS, match[0]) ? SYMBOLS[match[0]] : undefined;
      if (symbol === undefined) return null;
      out += symbol;
      index += 1 + match[0].length;
    } else if (char === "^" || char === "_") {
      index += 1;
      const body = readGroup();
      if (body === null || body.includes("\\") || body.includes("{")) return null;
      const shifted = shiftScript(body, char === "^" ? "super" : "sub");
      if (shifted === null) return null;
      out += shifted;
    } else if (char === "{" || char === "}") {
      return null;
    } else {
      out += char === "-" ? "−" : char;
      index += 1;
    }
  }
  return out;
}

/**
 * MathJax measures in `ex`, and its TeX font has an x-height of 0.442em (`x_height` in the
 * MathJax font parameters), so one ex is 0.442 of the reader body size.
 */
const EX_PER_EM = 0.442;
/** Smallest uniform scale for a formula wider than the column; narrower than this it scrolls. */
const MIN_MATH_SCALE = 0.6;

export type MathSvgLayout = {
  /** Compiler SVG with numeric sizes and the foreground colour applied. */
  readonly xml: string;
  readonly width: number;
  readonly height: number;
  /** How far the formula's baseline sits above its bottom edge. */
  readonly descent: number;
};

/** A plain or e-notation number, as MathJax prints it (`1.5`, `-0.452`, `2e-7`). */
const NUMBER = String.raw`-?\d+(?:\.\d+)?(?:e-?\d+)?`;

/**
 * Converts a compiler-validated MathJax SVG into point sizes for `SvgXml`. Returns null when the
 * root sizes cannot be read, so the caller falls back to Unicode or TeX. `vertical-align` is
 * absent, a bare `0`, or a (possibly negative, possibly e-notation) `ex` length.
 */
export function layoutMathSvg(svg: string, fontSize: number, color: string): MathSvgLayout | null {
  const ex = fontSize * EX_PER_EM;
  const root = /^<svg\b[^>]*>/.exec(svg)?.[0] ?? "";
  const read = (name: string): number | null => {
    const value = new RegExp(String.raw`\s${name}="(${NUMBER})ex"`).exec(root)?.[1];
    const parsed = value === undefined ? Number.NaN : Number(value) * ex;
    return Number.isFinite(parsed) ? parsed : null;
  };
  const width = read("width");
  const height = read("height");
  if (width === null || height === null || width <= 0 || height <= 0) {
    return null;
  }
  const vertical = new RegExp(String.raw`\sstyle="vertical-align:\s*(?:(${NUMBER})ex|0);?"`).exec(
    root,
  )?.[1];
  const descent = vertical === undefined ? 0 : -Number(vertical) * ex;
  const safeColor = /^[#\w(),.%\s-]{1,64}$/.test(color) ? color : "#000000";
  return {
    // `\rule` and `\color{black}` paint literal black, which vanishes on the dark theme.
    xml: svg
      .replaceAll("currentColor", safeColor)
      .replace(/(fill|stroke)="black"/g, `$1="${safeColor}"`),
    width,
    height,
    descent: Number.isFinite(descent) ? descent : 0,
  };
}

export type MathFit = {
  /** Size of the box the formula occupies in the text line. */
  readonly layout: MathSvgLayout;
  /** True when the formula is too wide to shrink legibly: it keeps its size in a scroll box. */
  readonly scroll: boolean;
  /** Natural size, drawn inside the scroll box. */
  readonly natural: MathSvgLayout;
};

/**
 * Fits an inline formula into the text column. A formula that fits is untouched; a wider one is
 * scaled down uniformly while it stays at least {@link MIN_MATH_SCALE} of its size, and otherwise
 * becomes a column-wide box that scrolls horizontally, so it never overflows or clips.
 */
export function fitMathLayout(layout: MathSvgLayout, maxWidth: number): MathFit {
  if (!(maxWidth > 0) || layout.width <= maxWidth) {
    return { layout, scroll: false, natural: layout };
  }
  const scale = maxWidth / layout.width;
  if (scale >= MIN_MATH_SCALE) {
    return {
      layout: {
        ...layout,
        width: maxWidth,
        height: layout.height * scale,
        descent: layout.descent * scale,
      },
      scroll: false,
      natural: layout,
    };
  }
  return { layout: { ...layout, width: maxWidth }, scroll: true, natural: layout };
}

const MATHML_LAYOUT_TAGS =
  /<(?:msup|msub|msubsup|mfrac|msqrt|mroot|mover|munder|munderover|mtable)\b/;

/**
 * Removes every `<…>` run with at least one character inside. `/<[^>]+>/g` rescans to the end of
 * the text for every `<` that has no `>` after it, which is quadratic on a hostile document.
 */
function stripTags(text: string): string {
  let out = "";
  let cursor = 0;
  for (let open = text.indexOf("<"); open !== -1; ) {
    const close = text.indexOf(">", open + 1);
    if (close === -1) {
      break;
    }
    if (close > open + 1) {
      out += text.slice(cursor, open);
      cursor = close + 1;
      open = text.indexOf("<", cursor);
    } else {
      open = text.indexOf("<", open + 1);
    }
  }
  return out + text.slice(cursor);
}

/**
 * Text for MathML-only math when no SVG could be drawn. Only flat token runs (`x = 1`) have an
 * honest plain-text form; anything with scripts, fractions or roots would read wrong flattened
 * (`2^20` as "220"), so those return null and the caller shows a placeholder.
 */
export function mathmlToPlainText(mathml: string): string | null {
  if (MATHML_LAYOUT_TAGS.test(mathml)) {
    return null;
  }
  const text = stripTags(
    replaceSpans(mathml, { open: /<annotation\b/g, close: /<\/annotation>/g }, () => ""),
  )
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/[⁡-⁤​]/g, "")
    .trim();
  return text.length > 0 ? text : null;
}
