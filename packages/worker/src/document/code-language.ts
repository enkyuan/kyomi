import { bundledLanguagesInfo } from "shiki";

export type CodeLanguage = { id: string; label: string };

const PLAIN_TEXT = new Set(["text", "plain", "plaintext", "txt", "none", "nohighlight", "output"]);

/** Extensions whose shiki alias differs from the extension itself. */
const EXTENSION_ALIASES: Record<string, string> = {
  cc: "cpp",
  cjs: "javascript",
  h: "c",
  hh: "cpp",
  hpp: "cpp",
  htm: "html",
  mjs: "javascript",
  ps1: "powershell",
  psm1: "powershell",
  patch: "diff",
};

/** Whole-file names that carry no extension. */
const FILENAME_LANGUAGES: Record<string, string> = {
  dockerfile: "docker",
  makefile: "make",
  gemfile: "ruby",
  rakefile: "ruby",
  ".bashrc": "bash",
  ".zshrc": "bash",
  ".profile": "bash",
  ".gitignore": "ini",
};

const INTERPRETERS: Record<string, string> = {
  node: "javascript",
  deno: "typescript",
  bun: "typescript",
  sh: "bash",
  dash: "bash",
  zsh: "bash",
  ksh: "bash",
  pwsh: "powershell",
};

const byKey = new Map<string, CodeLanguage>();
for (const info of bundledLanguagesInfo) {
  const language = { id: info.id, label: info.name };
  for (const key of [info.id, info.name, ...(info.aliases ?? [])]) {
    const normalized = key.toLowerCase();
    if (!byKey.has(normalized)) {
      byKey.set(normalized, language);
    }
  }
}

export function lookupLanguage(key: string): CodeLanguage | null {
  return byKey.get(key.trim().toLowerCase()) ?? null;
}

/** `true` when a hint explicitly asks for no highlighting. */
export function isPlainTextHint(hint: string): boolean {
  return PLAIN_TEXT.has(hint.trim().toLowerCase());
}

function fromHint(hint: string): CodeLanguage | null {
  const key = hint
    .trim()
    .toLowerCase()
    .replace(/^(?:language|lang|highlight-source)-/, "");
  return lookupLanguage(key);
}

export function languageFromFilename(filename: string): CodeLanguage | null {
  const base = filename.split(/[\\/]/).pop()?.toLowerCase() ?? "";
  const whole = FILENAME_LANGUAGES[base];
  if (whole) {
    return lookupLanguage(whole);
  }
  const extension = base.includes(".") ? base.slice(base.lastIndexOf(".") + 1) : "";
  if (!extension) {
    return null;
  }
  return lookupLanguage(EXTENSION_ALIASES[extension] ?? extension);
}

/** `#!/usr/bin/env python3`, `#!/bin/bash`, then vim and emacs modelines in the first lines. */
export function languageFromContent(value: string): CodeLanguage | null {
  const head = value.split("\n", 5);
  const shebang = head[0]?.match(/^#!\s*(?:\/usr\/bin\/env\s+(?:-\S+\s+)*|\S*\/)([\w.+-]+)/);
  if (shebang?.[1]) {
    const interpreter = shebang[1].toLowerCase().replace(/[\d.]+$/, "");
    return lookupLanguage(INTERPRETERS[interpreter] ?? interpreter);
  }
  for (const line of head) {
    const modeline =
      line.match(/\bvim?:.*\b(?:ft|filetype)=([\w+-]+)/) ?? line.match(/-\*-.*\bmode:\s*([\w+-]+)/);
    if (modeline?.[1]) {
      return lookupLanguage(modeline[1]);
    }
  }
  return null;
}

export type ResolvedLanguage =
  | { source: "explicit" | "filename" | "shebang"; language: CodeLanguage | null }
  | { source: "none"; language: null };

/**
 * Explicit hint first, then filename, then shebang or modeline. There is no classifier: a
 * snippet without any of these stays plain text.
 */
export function resolveLanguage(
  hint: string | undefined,
  filename: string | undefined,
  value: string,
): ResolvedLanguage {
  if (hint) {
    if (isPlainTextHint(hint)) {
      return { source: "explicit", language: null };
    }
    const language = fromHint(hint);
    if (language) {
      return { source: "explicit", language };
    }
  }
  const named = filename ? languageFromFilename(filename) : null;
  if (named) {
    return { source: "filename", language: named };
  }
  const inferred = languageFromContent(value);
  if (inferred) {
    return { source: "shebang", language: inferred };
  }
  return { source: "none", language: null };
}
