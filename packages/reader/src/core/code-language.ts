export type CodeLanguageConfidence = "explicit" | "deterministic" | "plain";

export type CodeLanguageDetection = {
  language: string;
  label: string;
  confidence: CodeLanguageConfidence;
  reason: string;
};

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

function toLanguageId(raw: string | undefined): string | undefined {
  const trimmed = raw?.trim().toLowerCase();
  if (!trimmed) {
    return undefined;
  }
  return LANGUAGE_ALIASES[trimmed] ?? trimmed;
}

function toLanguageLabel(language: string): string {
  const normalized = language.trim().toLowerCase();
  if (LANGUAGE_LABELS[normalized]) {
    return LANGUAGE_LABELS[normalized];
  }
  return normalized
    .split(/[-_]/)
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
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

  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
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
  if (/<[a-z][\w:-]*(\s[^>]*)?>[\s\S]*<\/[a-z][\w:-]*>/i.test(normalized)) {
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
  const importPattern =
    /^\s*from\s+[A-Za-z_][A-Za-z0-9_.]*\s+import\s+[A-Za-z_*][A-Za-z0-9_,\s*]*$/m.test(
      normalized,
    ) || /^\s*import\s+[A-Za-z_][A-Za-z0-9_.,\s]*$/m.test(normalized);
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

  const deterministic =
    tryDetectJson(trimmed) ??
    tryDetectBash(trimmed) ??
    tryDetectXml(trimmed) ??
    tryDetectSql(trimmed) ??
    tryDetectPython(trimmed) ??
    tryDetectTypeScript(trimmed) ??
    tryDetectJavaScript(trimmed) ??
    tryDetectYaml(trimmed);

  if (deterministic) {
    return deterministic;
  }

  if (looksLikePlainText(trimmed)) {
    return asPlain("plain prose text without code markers");
  }

  return {
    language: "bash",
    label: "Bash",
    confidence: "deterministic",
    reason: "default shell fallback for unlabeled code blocks",
  };
}
