import hljs from "highlight.js";

import "highlight.js/styles/github-dark.css";

const WRAPPER = "data-reader-code-block";
const COPY_MOUNTED = "data-reader-copy-mounted";

// SVG path data extracted from @mingcute/react (Copy2Fill / CheckFill), viewBox 0 0 24 24.
const COPY_ICON_PATH =
  "M9 2a2 2 0 0 0-2 2v2h2V4h11v11h-2v2h2a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2zM4 7a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z";
const CHECK_ICON_PATH =
  "M21.546 5.111a1.5 1.5 0 0 1 0 2.121L10.303 18.475a1.6 1.6 0 0 1-2.263 0L2.454 12.89a1.5 1.5 0 1 1 2.121-2.121l4.596 4.596L19.424 5.111a1.5 1.5 0 0 1 2.122 0";

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
    const className = code.className.trim();
    const languageClass = className
      .split(/\s+/)
      .find((token) => token.startsWith("language-") || token.startsWith("lang-"));
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
  svg.setAttribute("width", "16");
  svg.setAttribute("height", "16");
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

/**
 * Wraps `pre > code` fences, applies syntax highlighting, and mounts a pure-DOM copy button.
 * No nested React roots are created so the enhancement survives React reconciliation of the
 * parent `dangerouslySetInnerHTML` container.
 */
export function enhanceArticleCodeBlocks(container: HTMLElement): void {
  normalizeStandaloneCodeElements(container);

  // Idempotent pass: re-mount copy controls on already-wrapped blocks (e.g. after StrictMode
  // double-invoke or when the effect runs a second time on the same DOM node).
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

  for (const pre of container.querySelectorAll<HTMLPreElement>("pre")) {
    if (pre.closest(`[${WRAPPER}]`)) {
      continue;
    }

    let code = pre.querySelector<HTMLElement>("code");
    if (!code) {
      // Some publisher HTML uses bare `<pre>` without a nested `<code>`.
      code = document.createElement("code");
      code.textContent = pre.textContent ?? "";
      pre.replaceChildren(code);
    }

    const text = code.textContent ?? "";
    if (!text.trim()) {
      continue;
    }

    const fenceLang = extractFenceLanguage(pre, code);
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

    mountCopyButton(host, text);
  }
}
