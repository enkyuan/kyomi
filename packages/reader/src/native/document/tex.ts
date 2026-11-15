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
      const symbol = SYMBOLS[match[0]];
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

/** MathJax sizes in `ex`; one ex is about 0.44em in the reader body font. */
const EX_PER_EM = 0.44;

export type MathSvgLayout = {
  /** Compiler SVG with numeric sizes and the foreground colour applied. */
  readonly xml: string;
  readonly width: number;
  readonly height: number;
  /** How far the formula's baseline sits above its bottom edge. */
  readonly descent: number;
};

const EX_VALUE = /^-?\d+(?:\.\d+)?/;

/**
 * Converts a compiler-validated MathJax SVG into point sizes for `SvgXml`. Returns null when the
 * root sizes cannot be read, so the caller falls back to Unicode or TeX.
 */
export function layoutMathSvg(svg: string, fontSize: number, color: string): MathSvgLayout | null {
  const ex = fontSize * EX_PER_EM;
  const read = (name: string): number | null => {
    const value = new RegExp(`<svg[^>]*\\s${name}="(-?\\d+(?:\\.\\d+)?)ex"`).exec(svg)?.[1];
    return value === undefined ? null : Number(value) * ex;
  };
  const width = read("width");
  const height = read("height");
  if (width === null || height === null || width <= 0 || height <= 0) {
    return null;
  }
  const vertical = /<svg[^>]*\sstyle="vertical-align:\s*(-?\d+(?:\.\d+)?)ex;?"/.exec(svg)?.[1];
  const descent = vertical !== undefined && EX_VALUE.test(vertical) ? -Number(vertical) * ex : 0;
  const safeColor = /^[#\w(),.%\s-]{1,64}$/.test(color) ? color : "#000000";
  return {
    xml: svg.replaceAll("currentColor", safeColor),
    width,
    height,
    descent,
  };
}
