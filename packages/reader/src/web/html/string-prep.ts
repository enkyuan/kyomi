import { sanitizeReaderArticleHtml } from "./purify";
import { resolveRelativeAssetUrls } from "./url-resolve";

const MEDIUM_IMAGE_PLACEHOLDER_TEXT = "Press enter or click to view image in full size";
const SUBSCRIPT_OR_SUPERSCRIPT = String.raw`(?:[_^](?:\{[^}\n]{1,48}\}|[A-Za-z0-9'’′]{1,8}))`;
const GREEK_IMPLICIT_TEX = String.raw`[\u0370-\u03FF]${SUBSCRIPT_OR_SUPERSCRIPT}+`;
const LATIN_BRACED_TEX = String.raw`[A-Za-z](?:[_^]\{[A-Za-z0-9,\s'’′+\-*/=<>≤≥]{1,48}\})+`;
const TEX_COMMAND = String.raw`\\(?:frac|sqrt|sum|prod|int|lim|log|ln|sin|cos|tan|alpha|beta|gamma|delta|epsilon|varepsilon|zeta|eta|theta|vartheta|iota|kappa|lambda|mu|nu|xi|pi|rho|sigma|tau|upsilon|phi|varphi|chi|psi|omega|mathrm|mathbf|mathit|operatorname)\b(?:\s*(?:\{[^}\n]{1,80}\}|${SUBSCRIPT_OR_SUPERSCRIPT})){0,4}`;
const IMPLICIT_TEX_TOKEN_RE = new RegExp(
  String.raw`(^|[^\p{L}\p{N}_\\])(${GREEK_IMPLICIT_TEX}|${LATIN_BRACED_TEX}|${TEX_COMMAND})(?=$|[^\p{L}\p{N}_])`,
  "gu",
);
const EXPLICIT_TEX_DELIMITER_RE =
  /(^|[^\\])\$\$[\s\S]+?(^|[^\\])\$\$|\\\([\s\S]+?\\\)|\\\[[\s\S]+?\\\]|\\begin\{[a-zA-Z*]+\}/;
const MATH_TEXT_IGNORED_ANCESTOR_SELECTOR =
  "a, code, pre, kbd, samp, script, style, textarea, math, .katex";

export function normalizeCaptionText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeFigureCaptionSpacing(value: string): string {
  return value
    .replace(/\s*;\s*/g, "; ")
    .replace(/\s*:\s*/g, ": ")
    .replace(/\s+/g, " ")
    .trim();
}

function isMediumImagePlaceholderText(value: string): boolean {
  return normalizeCaptionText(value).toLowerCase() === MEDIUM_IMAGE_PLACEHOLDER_TEXT.toLowerCase();
}

function normalizeMathToken(value: string): string {
  return value.replace(/[’′]/g, "'");
}

function replaceTextNodeWithImplicitMath(node: Text): boolean {
  const value = node.nodeValue ?? "";
  if (
    !value.includes("_") &&
    !value.includes("^") &&
    !value.includes("\\") &&
    !/[\u0370-\u03FF]/u.test(value)
  ) {
    return false;
  }
  if (EXPLICIT_TEX_DELIMITER_RE.test(value)) {
    return false;
  }

  IMPLICIT_TEX_TOKEN_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  let cursor = 0;
  let changed = false;
  const fragment = document.createDocumentFragment();

  while ((match = IMPLICIT_TEX_TOKEN_RE.exec(value))) {
    const prefix = match[1] ?? "";
    const token = match[2] ?? "";
    if (!token) {
      continue;
    }

    const tokenStart = match.index + prefix.length;
    if (tokenStart > cursor) {
      fragment.append(document.createTextNode(value.slice(cursor, tokenStart)));
    }

    const mathDelimiterText = document.createTextNode(`\\(${normalizeMathToken(token)}\\)`);
    fragment.append(mathDelimiterText);
    cursor = tokenStart + token.length;
    changed = true;
  }

  if (!changed) {
    return false;
  }

  if (cursor < value.length) {
    fragment.append(document.createTextNode(value.slice(cursor)));
  }
  node.replaceWith(fragment);
  return true;
}

function normalizeImplicitTexText(root: ParentNode): boolean {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent || parent.closest(MATH_TEXT_IGNORED_ANCESTOR_SELECTOR)) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const textNodes: Text[] = [];
  while (walker.nextNode()) {
    textNodes.push(walker.currentNode as Text);
  }

  let changed = false;
  for (const node of textNodes) {
    changed = replaceTextNodeWithImplicitMath(node) || changed;
  }
  return changed;
}

/**
 * Many publishers repeat the same string in `img[alt]` and `<figcaption>`.
 * When both match, clear `alt` so the caption is the single visible description
 * and screen readers are not given duplicate announcements.
 */
function normalizeFigureContent(html: string): string {
  if (typeof document === "undefined") {
    return html;
  }
  if (!html.includes("<figure") && !html.includes("<img")) {
    return html;
  }
  const tpl = document.createElement("template");
  tpl.innerHTML = html;
  for (const figure of tpl.content.querySelectorAll("figure")) {
    const cap = figure.querySelector("figcaption");
    if (!cap) {
      continue;
    }
    const normalizedCaption = normalizeFigureCaptionSpacing(cap.textContent ?? "");
    cap.textContent = normalizedCaption;
    const capNorm = normalizeCaptionText(normalizedCaption);
    if (!capNorm) {
      continue;
    }
    for (const img of figure.querySelectorAll("img")) {
      img.removeAttribute("width");
      img.removeAttribute("height");
      const alt = img.getAttribute("alt") ?? "";
      if (isMediumImagePlaceholderText(alt)) {
        img.setAttribute("alt", "");
        img.removeAttribute("title");
        continue;
      }
      const altNorm = normalizeCaptionText(alt);
      if (altNorm && altNorm === capNorm) {
        img.setAttribute("alt", "");
      }
    }
  }

  for (const img of tpl.content.querySelectorAll("img")) {
    img.removeAttribute("width");
    img.removeAttribute("height");
    if (isMediumImagePlaceholderText(img.getAttribute("alt") ?? "")) {
      img.setAttribute("alt", "");
      img.removeAttribute("title");
    }
  }

  for (const el of tpl.content.querySelectorAll("p, figcaption")) {
    if (el.querySelector("img, picture, video, iframe")) {
      continue;
    }
    if (isMediumImagePlaceholderText(el.textContent ?? "")) {
      el.remove();
    }
  }

  return tpl.innerHTML;
}

/**
 * When markdown uses inline backticks around a literal `<code>…</code>` fragment
 * (e.g. `` `<code>AllocationRecord</code>` ``), marked emits one outer `<code>` whose
 * text is the entity-encoded tags. Collapse that to a single inline code with the inner text only.
 */
function unwrapRedundantInlineCodeMarkup(html: string): string {
  return html
    .replace(/<code>&lt;code&gt;([\s\S]*?)&lt;\/code&gt;<\/code>/gi, "<code>$1</code>")
    .replace(/<code><code>([\s\S]*?)<\/code><\/code>/gi, "<code>$1</code>");
}

export function prepareArticleHtml(html: string, baseUrl?: string | null): string {
  const normalized = unwrapRedundantInlineCodeMarkup(html);
  const withResolvedUrls = resolveRelativeAssetUrls(normalized, baseUrl);
  const safe = sanitizeReaderArticleHtml(withResolvedUrls);
  const figureNormalized = normalizeFigureContent(safe);
  if (typeof document === "undefined") {
    return figureNormalized;
  }

  const tpl = document.createElement("template");
  tpl.innerHTML = figureNormalized;
  return normalizeImplicitTexText(tpl.content) ? tpl.innerHTML : figureNormalized;
}
