export type CodeLanguageConfidence = "explicit" | "deterministic" | "plain";

export type CodeLanguageDetection = {
  language: string;
  label: string;
  confidence: CodeLanguageConfidence;
  reason: string;
};

/**
 * The pattern heuristics below read at most this many characters. Several of them backtrack, so
 * their cost grows with the square of the text; an unlabeled code block is rarely longer, and a
 * hostile one cannot turn a whole article into minutes of work.
 */
const MAX_HEURISTIC_CHARS = 20_000;

const PLAIN_LANGUAGE = "plaintext";
const PLAIN_LABEL = "Plain text";

const LANGUAGE_ALIASES: Record<string, string> = {
  ts: "typescript",
  tsx: "typescript",
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  sh: "bash",
  zsh: "bash",
  shell: "bash",
  yml: "yaml",
  md: "markdown",
  py: "python",
  rb: "ruby",
  rs: "rust",
  kt: "kotlin",
  kts: "kotlin",
  html: "xml",
  htm: "xml",
  svg: "xml",
  vue: "xml",
  gql: "graphql",
};

const LANGUAGE_LABELS: Record<string, string> = {
  plaintext: "Plain text",
  typescript: "TypeScript",
  javascript: "JavaScript",
  bash: "Bash",
  yaml: "YAML",
  markdown: "Markdown",
  python: "Python",
  ruby: "Ruby",
  rust: "Rust",
  kotlin: "Kotlin",
  xml: "HTML",
  json: "JSON",
  sql: "SQL",
  graphql: "GraphQL",
};

/** Own keys only: a publisher-supplied hint such as `constructor` must not find a prototype member. */
function lookup(map: Record<string, string>, key: string): string | undefined {
  return Object.hasOwn(map, key) ? map[key] : undefined;
}

function toLanguageId(raw: string | undefined): string | undefined {
  const trimmed = raw?.trim().toLowerCase();
  if (!trimmed) {
    return undefined;
  }
  return lookup(LANGUAGE_ALIASES, trimmed) ?? trimmed;
}

function toLanguageLabel(language: string): string {
  const normalized = language.trim().toLowerCase();
  const known = lookup(LANGUAGE_LABELS, normalized);
  if (known) {
    return known;
  }
  const parts: string[] = [];
  for (const chunk of normalized.split(/[-_]/)) {
    if (!chunk) {
      continue;
    }
    parts.push(chunk.charAt(0).toUpperCase() + chunk.slice(1));
  }
  return parts.join(" ");
}

function asPlain(reason: string): CodeLanguageDetection {
  return {
    language: PLAIN_LANGUAGE,
    label: PLAIN_LABEL,
    confidence: "plain",
    reason,
  };
}

function looksLikePlainText(text: string): boolean {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return true;
  }

  const lines: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed) {
      lines.push(trimmed);
    }
  }
  const words = normalized.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const hasSentenceEnding = /[.!?](?:\s|$)/.test(normalized);
  const codeMarkerHits = (
    normalized.match(/[{}[\]()<>;$=\\`|]|=>|::|\/\/|#include|function\s*\(|SELECT\s+/gi) ?? []
  ).length;
  const hasIndentedBlock = /\n\s{2,}\S/.test(text);
  const hasListPrefix = lines.some((line) => /^[-*]\s+/.test(line));
  const mostlyNaturalWords = words.filter((word) => /^[A-Za-z][A-Za-z'-]*$/.test(word)).length;

  return (
    wordCount >= 6 &&
    mostlyNaturalWords >= Math.floor(wordCount * 0.7) &&
    codeMarkerHits === 0 &&
    !hasIndentedBlock &&
    !hasListPrefix &&
    hasSentenceEnding
  );
}

function tryDetectJson(text: string): CodeLanguageDetection | null {
  const trimmed = text.trim();
  if (!trimmed || (!trimmed.startsWith("{") && !trimmed.startsWith("["))) {
    return null;
  }
  try {
    JSON.parse(trimmed);
    return {
      language: "json",
      label: "JSON",
      confidence: "deterministic",
      reason: "valid JSON payload",
    };
  } catch {
    return null;
  }
}

function tryDetectBash(text: string): CodeLanguageDetection | null {
  const normalized = text.replace(/\r\n/g, "\n");
  if (
    /^#!\s*\/usr\/bin\/env\s+(?:ba|z)?sh\b/m.test(normalized) ||
    /^#!\s*\/bin\/(?:ba|z)?sh\b/m.test(normalized)
  ) {
    return {
      language: "bash",
      label: "Bash",
      confidence: "deterministic",
      reason: "shell shebang",
    };
  }

  const shellKeywordHits = (
    normalized.match(/\b(?:set -e|set -u|set -o pipefail|then|fi|done|esac|export)\b/g) ?? []
  ).length;
  const variableHits = (normalized.match(/(^|\s)\$[A-Za-z_][A-Za-z0-9_]*/g) ?? []).length;
  if (shellKeywordHits >= 2 && variableHits >= 1) {
    return {
      language: "bash",
      label: "Bash",
      confidence: "deterministic",
      reason: "shell control-flow and variable syntax",
    };
  }
  return null;
}

const MARKUP_OPEN = /<[a-z][\w:-]*/gi;
const MARKUP_CLOSE = /<\/[a-z][\w:-]*>/gi;

/**
 * Matches `/<[a-z][\w:-]*(\s[^>]*)?>[\s\S]*<\/[a-z][\w:-]*>/i` in one pass; that regex rescans to
 * the end of the text for every `<a ` or `<a>` without a closing tag after it. The first opening
 * tag that ends is the one with the most text after it, so only it needs a closing tag.
 */
function hasPairedMarkupTags(text: string): boolean {
  MARKUP_OPEN.lastIndex = 0;
  for (let open = MARKUP_OPEN.exec(text); open; open = MARKUP_OPEN.exec(text)) {
    const next = text[MARKUP_OPEN.lastIndex];
    let end = -1;
    if (next === ">") {
      end = MARKUP_OPEN.lastIndex + 1;
    } else if (next !== undefined && /\s/.test(next)) {
      const close = text.indexOf(">", MARKUP_OPEN.lastIndex + 1);
      if (close === -1) {
        return false;
      }
      end = close + 1;
    }
    if (end !== -1) {
      MARKUP_CLOSE.lastIndex = end;
      return MARKUP_CLOSE.test(text);
    }
  }
  return false;
}

function tryDetectXml(text: string): CodeLanguageDetection | null {
  const normalized = text.trim();
  if (!normalized) {
    return null;
  }
  if (/^<!doctype html>/i.test(normalized)) {
    return {
      language: "xml",
      label: "HTML",
      confidence: "deterministic",
      reason: "HTML doctype",
    };
  }
  if (hasPairedMarkupTags(normalized)) {
    return {
      language: "xml",
      label: "HTML",
      confidence: "deterministic",
      reason: "paired markup tags",
    };
  }
  return null;
}

function tryDetectSql(text: string): CodeLanguageDetection | null {
  const normalized = text.replace(/\s+/g, " ").trim().toUpperCase();
  if (!normalized) {
    return null;
  }
  const sqlKeywordHits = (
    normalized.match(
      /\b(SELECT|INSERT INTO|UPDATE|DELETE FROM|CREATE TABLE|ALTER TABLE|DROP TABLE|WITH)\b/g,
    ) ?? []
  ).length;
  if (sqlKeywordHits >= 2) {
    return {
      language: "sql",
      label: "SQL",
      confidence: "deterministic",
      reason: "multiple SQL statements or clauses",
    };
  }
  return null;
}

function tryDetectPython(text: string): CodeLanguageDetection | null {
  const normalized = text.replace(/\r\n/g, "\n");
  const functionOrClass =
    /\bdef\s+[A-Za-z_][A-Za-z0-9_]*\s*\([^)]*\)\s*:\s*$/m.test(normalized) ||
    /\bclass\s+[A-Za-z_][A-Za-z0-9_]*(\([^)]*\))?\s*:\s*$/m.test(normalized);
  // The indent excludes line breaks: `^\s*` also matches across blank lines, which rescans the
  // rest of a run of newlines from every line start in it. Any match still starts at a line start.
  const importPattern =
    /^[^\S\n\r\u2028\u2029]*from\s+[A-Za-z_][A-Za-z0-9_.]*\s+import\s+[A-Za-z_*][A-Za-z0-9_,\s*]*$/m.test(
      normalized,
    ) || /^[^\S\n\r\u2028\u2029]*import\s+[A-Za-z_][A-Za-z0-9_.,\s]*$/m.test(normalized);
  const indentationBlock = /\n\s{2,}[^\n]+/.test(normalized);

  if (functionOrClass && indentationBlock) {
    return {
      language: "python",
      label: "Python",
      confidence: "deterministic",
      reason: "Python block syntax with indentation",
    };
  }
  if (importPattern && /\bprint\(|\blambda\b|\bNone\b/.test(normalized)) {
    return {
      language: "python",
      label: "Python",
      confidence: "deterministic",
      reason: "Python import and runtime syntax",
    };
  }
  return null;
}

function tryDetectTypeScript(text: string): CodeLanguageDetection | null {
  const normalized = text.replace(/\r\n/g, "\n");
  if (/\binterface\s+[A-Z][A-Za-z0-9_]*\b/.test(normalized)) {
    return {
      language: "typescript",
      label: "TypeScript",
      confidence: "deterministic",
      reason: "TypeScript interface declaration",
    };
  }
  if (/\btype\s+[A-Z][A-Za-z0-9_]*\s*=/.test(normalized)) {
    return {
      language: "typescript",
      label: "TypeScript",
      confidence: "deterministic",
      reason: "TypeScript type alias",
    };
  }
  if (
    /\b(?:const|let|function)\s+[A-Za-z_$][\w$]*\s*:\s*[A-Za-z_$][\w$<>\[\]|&?, ]*/.test(normalized)
  ) {
    return {
      language: "typescript",
      label: "TypeScript",
      confidence: "deterministic",
      reason: "Type annotation syntax",
    };
  }
  return null;
}

function tryDetectJavaScript(text: string): CodeLanguageDetection | null {
  const normalized = text.replace(/\r\n/g, "\n");
  const jsSignals =
    (/\b(?:const|let|var)\s+[A-Za-z_$][\w$]*\s*=/.test(normalized) ? 1 : 0) +
    (/\bfunction\s+[A-Za-z_$][\w$]*\s*\(/.test(normalized) ? 1 : 0) +
    (/=>/.test(normalized) ? 1 : 0) +
    (/\bimport\s+.+\s+from\s+['"][^'"]+['"]/.test(normalized) ? 1 : 0);

  if (jsSignals >= 2) {
    return {
      language: "javascript",
      label: "JavaScript",
      confidence: "deterministic",
      reason: "JavaScript declaration and module syntax",
    };
  }
  return null;
}

function tryDetectYaml(text: string): CodeLanguageDetection | null {
  const normalized = text.replace(/\r\n/g, "\n");
  if (/[{}[\];]/.test(normalized)) {
    return null;
  }
  const lines = normalized.split("\n").map((line) => line.trim());
  const nonEmpty = lines.filter(Boolean);
  if (nonEmpty.length < 2) {
    return null;
  }
  const keyValueLines = nonEmpty.filter((line) =>
    /^[A-Za-z0-9_.-]+\s*:\s*[^:]*$/.test(line),
  ).length;
  if (keyValueLines >= 2) {
    return {
      language: "yaml",
      label: "YAML",
      confidence: "deterministic",
      reason: "multi-line key/value mapping syntax",
    };
  }
  return null;
}

export function detectCodeLanguage(text: string, explicitLanguage?: string): CodeLanguageDetection {
  const explicit = toLanguageId(explicitLanguage);
  if (explicit) {
    return {
      language: explicit,
      label: toLanguageLabel(explicit),
      confidence: "explicit",
      reason: "explicit language from code class",
    };
  }

  const trimmed = text.trim();
  if (!trimmed) {
    return asPlain("empty code block");
  }

  // JSON must be parsed whole; every other check is a heuristic over the start of the block. The
  // cut sample is trimmed again: `\n\s{2,}\S` and its kin backtrack through a trailing whitespace run.
  const sample =
    trimmed.length > MAX_HEURISTIC_CHARS
      ? trimmed.slice(0, MAX_HEURISTIC_CHARS).trimEnd()
      : trimmed;
  const deterministic =
    tryDetectJson(trimmed) ??
    tryDetectBash(sample) ??
    tryDetectXml(sample) ??
    tryDetectSql(sample) ??
    tryDetectPython(sample) ??
    tryDetectTypeScript(sample) ??
    tryDetectJavaScript(sample) ??
    tryDetectYaml(sample);

  if (deterministic) {
    return deterministic;
  }

  if (looksLikePlainText(sample)) {
    return asPlain("plain prose text without code markers");
  }

  return {
    language: "bash",
    label: "Bash",
    confidence: "deterministic",
    reason: "default shell fallback for unlabeled code blocks",
  };
}
