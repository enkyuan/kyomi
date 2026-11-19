import type { ArticlePass } from "../context";

/** How far above a `<pre>` a highlighter wrapper may carry the language. */
const MAX_WRAPPER_DEPTH = 3;
const FILENAME_LIKE = /^[\w@./-]{1,200}\.[A-Za-z0-9]{1,10}$/;
/** Wrapper elements highlighters use for a code block's title bar. */
const TITLE_CLASS = /(?:^|[\s_-])(?:filename|file-name|code-?block-?title|codeBlockTitle)/i;

function languageFromClass(className: string): string | null {
  for (const token of className.split(/\s+/)) {
    const hinted = token.match(/^(?:language|lang|highlight-source|highlighter)-([\w#+.-]+)$/i);
    if (hinted?.[1] && !/^(?:rouge|none)$/i.test(hinted[1])) {
      return hinted[1];
    }
  }
  // SyntaxHighlighter: class="brush: php; gutter: false"
  return className.match(/\bbrush:\s*([\w#+-]+)/i)?.[1] ?? null;
}

function languageFromElement(element: Element): string | null {
  return (
    element.getAttribute("data-lang")?.trim() ||
    element.getAttribute("data-language")?.trim() ||
    languageFromClass(element.getAttribute("class") ?? "")
  );
}

function captureLanguage(pre: Element): string | null {
  const code = pre.querySelector("code");
  const own = (code && languageFromElement(code)) || languageFromElement(pre);
  if (own) {
    return own;
  }
  let wrapper = pre.parentElement;
  for (let depth = 0; wrapper && depth < MAX_WRAPPER_DEPTH; depth += 1) {
    const hinted = languageFromElement(wrapper);
    if (hinted) {
      return hinted;
    }
    wrapper = wrapper.parentElement;
  }
  return null;
}

/** What `textContent` is, computed once per element however many code blocks look at it. */
const textOf = new WeakMap<Element, string>();

function trimmedText(element: Element): string {
  let text = textOf.get(element);
  if (text === undefined) {
    text = element.textContent?.trim() ?? "";
    textOf.set(element, text);
  }
  return text;
}

/** How many `<pre>` an element holds, once per element for the same reason. */
const preCounts = new WeakMap<Element, number>();

function preCount(element: Element): number {
  let count = preCounts.get(element);
  if (count === undefined) {
    count = element.querySelectorAll("pre").length;
    preCounts.set(element, count);
  }
  return count;
}

/**
 * A title bar beside the `<pre>` in its wrapper, or a filename-only figure caption. Only the
 * elements directly before and after the block (or the wrapper level that holds it) are looked at:
 * that is where highlighters put the title bar, and scanning every sibling made a page with many
 * code blocks in one container quadratic.
 */
function captureFilename(pre: Element): string | null {
  const explicit =
    pre.getAttribute("data-filename") ?? pre.querySelector("code")?.getAttribute("data-filename");
  if (explicit?.trim()) {
    return explicit.trim();
  }

  let held: Element = pre;
  let wrapper = pre.parentElement;
  for (let depth = 0; wrapper && depth < MAX_WRAPPER_DEPTH; depth += 1) {
    for (const child of [held.previousElementSibling, held.nextElementSibling]) {
      if (!child) {
        continue;
      }
      const isTitle =
        TITLE_CLASS.test(child.getAttribute("class") ?? "") ||
        (child.tagName === "FIGCAPTION" && preCount(wrapper) === 1);
      if (!isTitle) {
        continue;
      }
      const text = trimmedText(child);
      if (FILENAME_LIKE.test(text)) {
        child.remove();
        return text;
      }
    }
    held = wrapper;
    wrapper = wrapper.parentElement;
  }
  return null;
}

/** Prism `data-line="2-3,5"`, or Chroma's `span.line.hl` markers. */
function captureHighlightedLines(pre: Element): string | null {
  const prism = pre.getAttribute("data-line")?.trim();
  if (prism && /^\d[\d,\s-]*$/.test(prism)) {
    return prism;
  }
  const lines = Array.from(pre.querySelectorAll("code > span.line"));
  const highlighted = lines.flatMap((line, index) =>
    line.classList.contains("hl") ? [String(index + 1)] : [],
  );
  return highlighted.length > 0 ? highlighted.join(",") : null;
}

/** Chroma line-number tables: keep the code cell, drop the gutter. */
function unwrapLineNumberTables(root: HTMLElement): void {
  for (const table of Array.from(root.querySelectorAll("table.lntable"))) {
    const code = Array.from(table.querySelectorAll("pre")).at(-1);
    if (code) {
      table.replaceWith(code);
    }
  }
}

/** Task-list items: record the checkbox state before `strip-chrome` drops the input. */
function captureTaskState(root: HTMLElement): void {
  for (const box of Array.from(root.querySelectorAll("li > input[type='checkbox']"))) {
    const item = box.parentElement;
    if (item && !item.hasAttribute("data-kyomi-checked")) {
      item.setAttribute("data-kyomi-checked", box.hasAttribute("checked") ? "true" : "false");
    }
  }
}

/**
 * Pass 6. Records code-block language, filename, and highlighted lines as `data-kyomi-*` on each
 * `<pre>` before the class filter removes the highlighter markup they come from. The language
 * is kept as written; canonical ids are resolved later.
 */
export const captureCodeHints: ArticlePass = (root) => {
  unwrapLineNumberTables(root);
  captureTaskState(root);

  for (const pre of Array.from(root.querySelectorAll("pre"))) {
    // Highlighter colours are re-derived later; publisher token colours break dark mode.
    for (const styled of Array.from(pre.querySelectorAll("[style]"))) {
      styled.removeAttribute("style");
    }
    const language = captureLanguage(pre);
    const filename = captureFilename(pre);
    const lines = captureHighlightedLines(pre);
    if (language) {
      pre.setAttribute("data-kyomi-lang", language);
    }
    if (filename) {
      pre.setAttribute("data-kyomi-filename", filename);
    }
    if (lines) {
      pre.setAttribute("data-kyomi-lines", lines);
    }
  }
};
