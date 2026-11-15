import type { ModelOperations } from "@vscode/vscode-languagedetection";
import { lookupLanguage, type CodeLanguage } from "./code-language";

/** A block with fewer lines or characters is never classified: too little signal. */
export const MIN_DETECT_LINES = 3;
export const MIN_DETECT_CHARS = 40;
/** Detection reads a bounded prefix so cost and result do not depend on article size. */
const MAX_DETECT_CHARS = 4_000;
/** The model's top score must clear this and beat the runner-up by this factor. */
const MIN_CONFIDENCE = 0.15;
const MIN_MARGIN = 2;

/** The model's (VS Code) language ids that differ from the id Shiki knows them by. */
const MODEL_ALIASES: Record<string, string> = {
  sh: "shellscript",
  bat: "bat",
  ps1: "powershell",
  rs: "rust",
  pas: "pascal",
  jl: "julia",
  cs: "csharp",
  cpp: "cpp",
  hs: "haskell",
  kt: "kotlin",
  rb: "ruby",
  py: "python",
  ts: "typescript",
  js: "javascript",
  tex: "latex",
  ex: "elixir",
  erl: "erlang",
  pm: "perl",
  m: "objective-c",
  dm: "dm",
  mk: "make",
  jsx: "jsx",
  tsx: "tsx",
  yml: "yaml",
};

/** Ids whose model hits say nothing about code (prose and markup). */
const NOISY = new Set(["md", "ini"]);

let model: Promise<ModelOperations> | undefined;

/**
 * VS Code's language-detection model (about 1.8 MB, about 50 languages). It loads on the first
 * unhinted block that needs it, never at startup, and is shared after that.
 */
function loadModel(): Promise<ModelOperations> {
  model ??= import("@vscode/vscode-languagedetection").then(
    (module) => new module.ModelOperations(),
  );
  return model;
}

function isJson(value: string): boolean {
  const trimmed = value.trim();
  if (!/^[[{]/.test(trimmed)) {
    return false;
  }
  try {
    JSON.parse(trimmed);
    return true;
  } catch {
    return false;
  }
}

/** Every non-empty line is a `$ command` or `# command` prompt line. */
function isShellSession(lines: string[]): boolean {
  const filled = lines.filter((line) => line.trim());
  return filled.length >= 2 && filled.every((line) => /^\$ \S/.test(line));
}

const COMMANDS = new Set([
  "uv",
  "pip",
  "pip3",
  "pipx",
  "npm",
  "npx",
  "pnpm",
  "yarn",
  "bun",
  "bunx",
  "cargo",
  "rustup",
  "go",
  "git",
  "brew",
  "curl",
  "wget",
  "docker",
  "python",
  "python3",
  "node",
  "apt",
  "apt-get",
  "sudo",
  "make",
  "cd",
  "ls",
  "mkdir",
  "export",
  "cp",
  "mv",
  "rm",
  "chmod",
  "source",
  "echo",
  "gem",
  "poetry",
]);

function nonEmptyLines(value: string): string[] {
  return value.split("\n").filter((line) => line.trim());
}

/**
 * Tool output rather than code: linter or compiler diagnostics (`path:line:col message`) and
 * similar report lines. Never coloured, since colouring them as code would be wrong.
 */
export function looksLikeOutput(value: string): boolean {
  const lines = nonEmptyLines(value);
  const located = lines.filter((line) => /^\S+:\d+(?::\d+)?\s/.test(line)).length;
  return located > 0 && located >= lines.length / 2;
}

/** Only `[table]` headers, `key = value` pairs and comments, opening with a table header. */
function isToml(lines: string[]): boolean {
  const first = lines[0]?.trim() ?? "";
  if (!/^\[\[?[\w."'-]+\]\]?$/.test(first)) {
    return false;
  }
  return lines.every((line) =>
    /^(\[\[?[\w."'-]+\]\]?|[\w."'-]+\s*=\s*\S.*|#.*)$/.test(line.trim()),
  );
}

/** Every line is a comment or starts with a well-known command, however short the block. */
function isCommandLines(lines: string[]): boolean {
  const commands = lines.filter((line) => !line.trim().startsWith("#"));
  return (
    commands.length > 0 &&
    commands.every((line) => COMMANDS.has(line.trim().split(/\s+/, 1)[0]?.replace(/^\$/, "") ?? ""))
  );
}

/**
 * Best-effort language for an unhinted block, used for colour only. Returns null unless the
 * snippet is long enough and the match is confident, so ambiguous text stays plain. Output is
 * a pure function of `value`.
 */
export async function detectLanguage(value: string): Promise<CodeLanguage | null> {
  const sample = value.slice(0, MAX_DETECT_CHARS);
  const lines = sample.split("\n");
  // Deterministic shapes first, and allowed on short blocks: they need no statistics.
  if (looksLikeOutput(sample)) {
    return null;
  }
  const filled = nonEmptyLines(sample);
  if (isToml(filled)) {
    return lookupLanguage("toml");
  }
  if (isCommandLines(filled)) {
    return lookupLanguage("shellscript");
  }
  // Conservative: require both enough text and enough lines.
  if (
    sample.trim().length < MIN_DETECT_CHARS ||
    lines.filter((line) => line.trim()).length < MIN_DETECT_LINES
  ) {
    return null;
  }
  if (value.length <= MAX_DETECT_CHARS && isJson(value)) {
    return lookupLanguage("json");
  }
  if (isShellSession(lines)) {
    return lookupLanguage("shellscript");
  }
  const [best, next] = await (await loadModel()).runModel(sample);
  if (!best || NOISY.has(best.languageId) || best.confidence < MIN_CONFIDENCE) {
    return null;
  }
  if (next && best.confidence / Math.max(next.confidence, 1e-6) < MIN_MARGIN) {
    return null;
  }
  return lookupLanguage(MODEL_ALIASES[best.languageId] ?? best.languageId);
}
