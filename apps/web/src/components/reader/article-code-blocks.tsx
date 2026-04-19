import hljs from "highlight.js";
import { createRoot, type Root } from "react-dom/client";
import { ArticleCodeCopyButton } from "./article-code-copy-button";

import "highlight.js/styles/github-dark.css";

const WRAPPER = "data-reader-code-block";

/** Markdown ` ```ts ` → `language-ts`; map to highlight.js ids where needed. */
const LANGUAGE_ALIASES: Record<string, string> = {
  ts: "typescript",
  tsx: "typescript",
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  sh: "bash",
  zsh: "bash",
  yml: "yaml",
  md: "markdown",
  py: "python",
  rb: "ruby",
  rs: "rust",
  kt: "kotlin",
  kts: "kotlin",
  html: "xml",
  htm: "xml",
  vue: "xml",
};

/** Short fence ids → readable label (when they differ from hljs id title-case). */
const FENCE_LABEL: Record<string, string> = {
  ts: "TypeScript",
  tsx: "TSX",
  js: "JavaScript",
  jsx: "JSX",
  mjs: "JavaScript",
  cjs: "JavaScript",
  py: "Python",
  rb: "Ruby",
  rs: "Rust",
  sh: "Bash",
  zsh: "Zsh",
  yml: "YAML",
  md: "Markdown",
  kt: "Kotlin",
  kts: "Kotlin",
  html: "HTML",
  htm: "HTML",
  vue: "Vue",
  wasm: "WebAssembly",
  gql: "GraphQL",
};

/** highlight.js canonical language id → display label */
const HL_ID_LABEL: Record<string, string> = {
  typescript: "TypeScript",
  javascript: "JavaScript",
  python: "Python",
  ruby: "Ruby",
  rust: "Rust",
  java: "Java",
  go: "Go",
  c: "C",
  cpp: "C++",
  csharp: "C#",
  css: "CSS",
  scss: "SCSS",
  json: "JSON",
  xml: "XML",
  markdown: "Markdown",
  bash: "Bash",
  shell: "Shell",
  sql: "SQL",
  yaml: "YAML",
  php: "PHP",
  swift: "Swift",
  kotlin: "Kotlin",
  diff: "Diff",
  ini: "INI",
  graphql: "GraphQL",
  wasm: "WebAssembly",
  plaintext: "Plain text",
  perl: "Perl",
  lua: "Lua",
  r: "R",
  objectivec: "Objective-C",
  vbnet: "VB.NET",
  less: "Less",
  makefile: "Makefile",
  "php-template": "PHP",
  "python-repl": "Python",
};

function titleCaseId(id: string): string {
  const asOne = id.trim().toLowerCase();
  if (asOne && HL_ID_LABEL[asOne]) {
    return HL_ID_LABEL[asOne];
  }
  return id
    .split(/[-_]/)
    .filter(Boolean)
    .map((w) => {
      const wl = w.toLowerCase();
      if (HL_ID_LABEL[wl]) {
        return HL_ID_LABEL[wl];
      }
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(" ");
}

/**
 * Prefer explicit fence label when present; otherwise hljs result; fallback auto id.
 */
function languageToDisplayName(
  fenceRaw: string | undefined,
  hlCanonical: string | undefined,
): string {
  const fence = fenceRaw?.trim().toLowerCase();
  if (fence) {
    if (FENCE_LABEL[fence]) {
      return FENCE_LABEL[fence];
    }
    const resolved = resolveHighlightLanguage(fence);
    if (resolved && HL_ID_LABEL[resolved]) {
      return HL_ID_LABEL[resolved];
    }
    if (resolved) {
      return titleCaseId(resolved);
    }
    return titleCaseId(fence);
  }
  const hl = hlCanonical?.trim().toLowerCase();
  if (hl) {
    if (HL_ID_LABEL[hl]) {
      return HL_ID_LABEL[hl];
    }
    return titleCaseId(hl);
  }
  return "Plain text";
}

function extractFenceLanguage(code: HTMLElement): string | undefined {
  for (const cls of code.classList) {
    if (cls.startsWith("language-")) {
      return cls.slice("language-".length).trim();
    }
  }
  return undefined;
}

function resolveHighlightLanguage(raw: string): string | undefined {
  const id = raw.trim().toLowerCase();
  if (!id) {
    return undefined;
  }
  if (hljs.getLanguage(id)) {
    return id;
  }
  const mapped = LANGUAGE_ALIASES[id];
  if (mapped && hljs.getLanguage(mapped)) {
    return mapped;
  }
  return undefined;
}

function highlightCode(
  text: string,
  fenceLang: string | undefined,
): { value: string; language: string | undefined } {
  const resolved = fenceLang ? resolveHighlightLanguage(fenceLang) : undefined;
  try {
    if (resolved) {
      const r = hljs.highlight(text, { language: resolved });
      return { value: r.value, language: r.language ?? resolved };
    }
    const r = hljs.highlightAuto(text);
    return { value: r.value, language: r.language ?? undefined };
  } catch {
    const r = hljs.highlight(text, { language: "plaintext" });
    return { value: r.value, language: r.language ?? "plaintext" };
  }
}

/**
 * Wraps `pre > code` fences, applies syntax highlighting, and mounts a React copy control.
 * Returns roots to unmount when the article body is torn down.
 */
export function enhanceArticleCodeBlocks(container: HTMLElement): Root[] {
  const roots: Root[] = [];

  for (const pre of container.querySelectorAll<HTMLPreElement>("pre")) {
    if (pre.closest(`[${WRAPPER}]`)) {
      continue;
    }

    const code = pre.querySelector<HTMLElement>("code");
    if (!code) {
      continue;
    }

    const text = code.textContent ?? "";
    if (!text.trim()) {
      continue;
    }

    const fenceLang = extractFenceLanguage(code);
    const { value, language: hlLanguage } = highlightCode(text, fenceLang);
    const labelText = languageToDisplayName(fenceLang, hlLanguage);

    const wrapper = document.createElement("div");
    wrapper.setAttribute(WRAPPER, "");

    const parent = pre.parentNode;
    if (!parent) {
      continue;
    }
    parent.insertBefore(wrapper, pre);

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
    wrapper.appendChild(chrome);
    wrapper.appendChild(pre);

    code.innerHTML = value;
    code.classList.add("hljs");
    if (fenceLang) {
      code.classList.add(`language-${fenceLang}`);
    } else if (hlLanguage) {
      code.classList.add(`language-${hlLanguage}`);
    }

    pre.classList.add("reader-code-pre");

    const root = createRoot(host);
    root.render(<ArticleCodeCopyButton text={text} />);
    roots.push(root);
  }

  return roots;
}
