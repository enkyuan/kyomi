import hljs from "highlight.js/lib/core";
import bash from "highlight.js/lib/languages/bash";
import graphql from "highlight.js/lib/languages/graphql";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import kotlin from "highlight.js/lib/languages/kotlin";
import markdown from "highlight.js/lib/languages/markdown";
import plaintext from "highlight.js/lib/languages/plaintext";
import python from "highlight.js/lib/languages/python";
import ruby from "highlight.js/lib/languages/ruby";
import rust from "highlight.js/lib/languages/rust";
import sql from "highlight.js/lib/languages/sql";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";
import yaml from "highlight.js/lib/languages/yaml";
import { detectCodeLanguage } from "../../core/code-language";

const WRAPPER = "data-reader-code-block";
const COPY_MOUNTED = "data-reader-copy-mounted";
const BUTTON_ICON_SIZE = 12;
const BUTTON_ICON_PADDING = 16;

// SVG paths (Mingcute-style), viewBox 0 0 24 24.
const COPY_ICON_PATH =
  "M9 2a2 2 0 0 0-2 2v2h2V4h11v11h-2v2h2a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2zM4 7a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z";
const CHECK_ICON_PATH =
  "M12 2c5.523 0 10 4.477 10 10s-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2m3.535 6.381-4.95 4.95-2.12-2.121a1 1 0 0 0-1.415 1.414l2.758 2.758a1.1 1.1 0 0 0 1.556 0l5.586-5.586a1 1 0 0 0-1.415-1.415";

hljs.registerLanguage("bash", bash);
hljs.registerLanguage("graphql", graphql);
hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("json", json);
hljs.registerLanguage("kotlin", kotlin);
hljs.registerLanguage("markdown", markdown);
hljs.registerLanguage("plaintext", plaintext);
hljs.registerLanguage("python", python);
hljs.registerLanguage("ruby", ruby);
hljs.registerLanguage("rust", rust);
hljs.registerLanguage("sql", sql);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("xml", xml);
hljs.registerLanguage("yaml", yaml);

function classListFenceLanguage(classList: DOMTokenList): string | undefined {
  for (const cls of classList) {
    if (cls.startsWith("language-")) {
      return cls.slice("language-".length).trim();
    }
    if (cls.startsWith("lang-")) {
      return cls.slice("lang-".length).trim();
    }
  }
  return undefined;
}

function extractFenceLanguage(pre: HTMLPreElement, code: HTMLElement): string | undefined {
  return classListFenceLanguage(code.classList) ?? classListFenceLanguage(pre.classList);
}

function languageClassFromClassName(className: string): string | undefined {
  for (const token of className.trim().split(/\s+/)) {
    if (token.startsWith("language-") || token.startsWith("lang-")) {
      return token;
    }
  }
  return undefined;
}

const HIGHLIGHT_LANGUAGE_ALIASES: Record<string, string> = {
  html: "xml",
  htm: "xml",
  svg: "xml",
  shell: "bash",
  sh: "bash",
  zsh: "bash",
  yml: "yaml",
};

function resolveHighlightLanguage(raw: string): string | undefined {
  const id = raw.trim().toLowerCase();
  if (!id) {
    return undefined;
  }
  if (hljs.getLanguage(id)) {
    return id;
  }
  const mapped = HIGHLIGHT_LANGUAGE_ALIASES[id];
  if (mapped && hljs.getLanguage(mapped)) {
    return mapped;
  }
  return undefined;
}

function highlightCode(
  text: string,
  fenceLang: string | undefined,
): {
  value: string;
  language: string | undefined;
  detection: ReturnType<typeof detectCodeLanguage>;
} {
  const detection = detectCodeLanguage(text, fenceLang);
  const resolved = resolveHighlightLanguage(detection.language);

  if (detection.confidence === "plain" || !resolved) {
    const plain = hljs.highlight(text, { language: "plaintext" });
    return {
      value: plain.value,
      language: undefined,
      detection,
    };
  }

  try {
    const highlighted = hljs.highlight(text, { language: resolved });
    return {
      value: highlighted.value,
      language: highlighted.language ?? resolved,
      detection,
    };
  } catch {
    const plain = hljs.highlight(text, { language: "plaintext" });
    return {
      value: plain.value,
      language: undefined,
      detection,
    };
  }
}

function normalizeStandaloneCodeElements(container: HTMLElement): void {
  for (const code of container.querySelectorAll<HTMLElement>("code")) {
    if (code.closest("pre") || code.closest(`[${WRAPPER}]`)) {
      continue;
    }
    const text = code.textContent ?? "";
    if (!text.includes("\n")) {
      continue;
    }
    const pre = document.createElement("pre");
    const languageClass = languageClassFromClassName(code.className);
    if (languageClass) {
      pre.classList.add(languageClass);
    }
    const nextCode = document.createElement("code");
    if (languageClass) {
      nextCode.classList.add(languageClass);
    }
    nextCode.textContent = text;
    pre.appendChild(nextCode);
    code.replaceWith(pre);
  }
}

function makeSvgIcon(pathD: string): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", String(BUTTON_ICON_SIZE));
  svg.setAttribute("height", String(BUTTON_ICON_SIZE));
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("fill", "currentColor");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", pathD);
  svg.appendChild(path);
  return svg;
}

function mountCopyButton(host: HTMLElement, text: string): void {
  if (host.getAttribute(COPY_MOUNTED) === "true") {
    return;
  }

  const button = document.createElement("button");
  button.type = "button";
  button.className = "reader-code-copy-button";
  button.setAttribute("aria-label", "Copy code");
  button.style.setProperty("--rcb-icon-size", `${BUTTON_ICON_SIZE}px`);
  button.style.setProperty("--rcb-button-size", `${BUTTON_ICON_SIZE + BUTTON_ICON_PADDING}px`);

  const copyIcon = makeSvgIcon(COPY_ICON_PATH);
  copyIcon.setAttribute("class", "rcb-icon rcb-icon-copy");

  const checkIcon = makeSvgIcon(CHECK_ICON_PATH);
  checkIcon.setAttribute("class", "rcb-icon rcb-icon-check");

  button.appendChild(copyIcon);
  button.appendChild(checkIcon);

  button.addEventListener("click", () => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        button.classList.add("is-copied");
        button.setAttribute("aria-label", "Copied");
        window.setTimeout(() => {
          button.classList.remove("is-copied");
          button.setAttribute("aria-label", "Copy code");
        }, 2000);
      })
      .catch(() => {
        /* clipboard unavailable — silently ignore */
      });
  });

  host.appendChild(button);
  host.setAttribute(COPY_MOUNTED, "true");
}

function remountExistingCopyButtons(container: HTMLElement): void {
  for (const wrapper of container.querySelectorAll<HTMLElement>(`[${WRAPPER}]`)) {
    const host = wrapper.querySelector<HTMLElement>(".reader-code-copy-host");
    const code = wrapper.querySelector<HTMLElement>("pre code");
    if (!host || !code) {
      continue;
    }

    const text = code.textContent ?? "";
    if (!text.trim()) {
      continue;
    }

    mountCopyButton(host, text);
  }
}

function ensurePreCode(pre: HTMLPreElement): HTMLElement {
  const existingCode = pre.querySelector<HTMLElement>("code");
  if (existingCode) {
    return existingCode;
  }

  // Some publisher HTML uses bare `<pre>` without a nested `<code>`.
  const nextCode = document.createElement("code");
  nextCode.textContent = pre.textContent ?? "";
  pre.replaceChildren(nextCode);
  return nextCode;
}

function createCodeBlockChrome(labelText: string) {
  const chrome = document.createElement("div");
  chrome.className = "reader-code-chrome";
  chrome.setAttribute("role", "group");
  chrome.setAttribute("aria-label", `Code sample (${labelText})`);

  const labelEl = document.createElement("span");
  labelEl.className = "reader-code-lang-label";
  labelEl.textContent = labelText;

  const host = document.createElement("div");
  host.className = "reader-code-copy-host";

  chrome.appendChild(labelEl);
  chrome.appendChild(host);
  return { chrome, host };
}

function enhancePreCodeBlock(pre: HTMLPreElement): void {
  if (pre.closest(`[${WRAPPER}]`)) {
    return;
  }

  const code = ensurePreCode(pre);
  const text = code.textContent ?? "";
  if (!text.trim()) {
    return;
  }

  const fenceLang = extractFenceLanguage(pre, code);
  const { value, language: hlLanguage, detection } = highlightCode(text, fenceLang);

  const wrapper = document.createElement("div");
  wrapper.setAttribute(WRAPPER, "");

  const parent = pre.parentNode;
  if (!parent) {
    return;
  }
  parent.insertBefore(wrapper, pre);

  const { chrome, host } = createCodeBlockChrome(detection.label);
  wrapper.appendChild(chrome);
  wrapper.appendChild(pre);

  code.innerHTML = value;
  code.classList.add("hljs");
  if (fenceLang) {
    code.classList.add(`language-${fenceLang}`);
  } else if (detection.confidence === "deterministic" && hlLanguage) {
    code.classList.add(`language-${hlLanguage}`);
  }

  pre.classList.add("reader-code-pre");
  mountCopyButton(host, text);
}

/**
 * Wraps `pre > code` fences, applies syntax highlighting, and mounts a pure-DOM copy button.
 * No nested React roots are created so the enhancement survives React reconciliation of the
 * parent `dangerouslySetInnerHTML` container.
 */
export function enhanceCodeBlocks(container: HTMLElement): void {
  normalizeStandaloneCodeElements(container);

  // Idempotent pass: re-mount copy controls on already-wrapped blocks (e.g. after StrictMode
  // double-invoke or when the effect runs a second time on the same DOM node).
  remountExistingCopyButtons(container);

  for (const pre of container.querySelectorAll<HTMLPreElement>("pre")) {
    enhancePreCodeBlock(pre);
  }
}
