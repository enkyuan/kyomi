import type { ModelOperations } from "@vscode/vscode-languagedetection";
import { lookupLanguage, type CodeLanguage } from "./code-language";
import {
  cssShape,
  diffShape,
  dockerfileShape,
  httpShape,
  jsonShape,
  looksLikeOutput,
  looseJsonShape,
  markupShape,
  nonEmptyLines,
  shellShape,
  sqlShape,
  tomlShape,
  visualBasicShape,
  yamlShape,
} from "./code-shapes";
import { scriptDialect, witnessed } from "./code-witness";

export { looksLikeOutput };

/** A block with fewer lines or characters is never sent to the model: too little signal. */
export const MIN_DETECT_LINES = 3;
export const MIN_DETECT_CHARS = 40;
/** Detection reads a bounded prefix so cost and result do not depend on article size. */
const MAX_DETECT_CHARS = 4_000;
/** A guess that comes from article context (not the model) still needs this much text. */
const MIN_CONTEXT_CHARS = 12;
/** The model's top score must clear this and beat the best other-family runner-up by this factor. */
const MIN_CONFIDENCE = 0.05;
const MIN_CANDIDATE = 0.02;
const MIN_MARGIN = 2;
/** Distinct structural tokens a block needs before the model's guess is believed. */
const MODEL_WITNESSES = 2;
/** At this confidence the model overrides article context that names a different language. */
const OVERRIDE_CONFIDENCE = 0.35;

/**
 * The model's (VS Code) language ids mapped to the id Shiki knows them by. A model id missing
 * here is never used: markdown, ini, csv, assembly and a few others say nothing about code.
 */
const MODEL_LANGUAGES: Record<string, string> = {
  py: "python",
  js: "javascript",
  ts: "typescript",
  cs: "csharp",
  cpp: "cpp",
  c: "c",
  java: "java",
  go: "go",
  rs: "rust",
  rb: "ruby",
  php: "php",
  ps1: "powershell",
  sh: "shellscript",
  bat: "bat",
  kt: "kotlin",
  swift: "swift",
  scala: "scala",
  dart: "dart",
  lua: "lua",
  r: "r",
  clj: "clojure",
  hs: "haskell",
  ex: "elixir",
  erl: "erlang",
  pm: "perl",
  groovy: "groovy",
  mm: "objective-c",
  tex: "latex",
  makefile: "make",
  cmake: "cmake",
  lisp: "lisp",
  sql: "sql",
  css: "css",
  html: "html",
  xml: "xml",
  json: "json",
  yaml: "yaml",
  toml: "toml",
  dockerfile: "docker",
};

/** Languages that share syntax closely enough that a close runner-up is not a conflict. */
const FAMILY: Record<string, string> = {
  javascript: "script",
  typescript: "script",
  jsx: "script",
  tsx: "script",
  c: "c",
  cpp: "c",
  "objective-c": "c",
  csharp: "c-like",
  java: "c-like",
  kotlin: "c-like",
  scala: "c-like",
  shellscript: "shell",
  shellsession: "shell",
  bat: "shell",
  powershell: "shell",
  html: "markup",
  xml: "markup",
};
export const familyOf = (id: string) => FAMILY[id] ?? id;

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

/** What the rest of the article says about a block, used when the block itself is not enough. */
export type DetectContext = {
  /** A language the text next to the block names (`the following Python`), if exactly one. */
  cue?: string | undefined;
  /** Languages the article's other blocks carry explicitly, most common first. */
  prior?: readonly string[] | undefined;
};

/** Shapes that need no statistics, so they apply to short blocks too. */
export function shapeLanguage(value: string, lines: string[]): string | null {
  const longEnough = lines.length >= 2 || value.trim().length >= MIN_DETECT_CHARS;
  const session = shellShape(lines);
  if (session === "shellsession") {
    return session;
  }
  if (looksLikeOutput(value)) {
    return null;
  }
  if (longEnough && value.length <= MAX_DETECT_CHARS) {
    const json = jsonShape(value);
    if (json) {
      return json;
    }
  }
  if (tomlShape(lines)) {
    return "toml";
  }
  if (dockerfileShape(lines) && lines.length >= 2) {
    return "docker";
  }
  if (session) {
    return session;
  }
  if (diffShape(lines)) {
    return "diff";
  }
  if (httpShape(lines)) {
    return "http";
  }
  if (lines.length >= 2 && markupShape(value, lines)) {
    return markupShape(value, lines);
  }
  const css = cssShape(value, lines);
  if (css) {
    return css;
  }
  if (lines.length >= 2 && visualBasicShape(value)) {
    return "vb";
  }
  if (sqlShape(value, lines)) {
    return "sql";
  }
  if (yamlShape(lines)) {
    return "yaml";
  }
  if (looseJsonShape(lines)) {
    return "json";
  }
  return null;
}

type Candidate = { id: string; confidence: number };

/**
 * The model proposes, the block's own syntax disposes: only languages whose structural tokens
 * the block really contains compete, and the winner must beat the best witnessed language of
 * another family by `MIN_MARGIN`.
 */
async function modelCandidate(sample: string): Promise<Candidate | null> {
  const ranked = (await (await loadModel()).runModel(sample))
    .filter((result) => MODEL_LANGUAGES[result.languageId] && result.confidence >= MIN_CANDIDATE)
    .map((result) => ({ id: MODEL_LANGUAGES[result.languageId]!, confidence: result.confidence }))
    .filter((candidate) => witnessed(candidate.id, sample, MODEL_WITNESSES));
  const best = ranked[0];
  if (!best || best.confidence < MIN_CONFIDENCE) {
    return null;
  }
  const rival = ranked.find((candidate) => familyOf(candidate.id) !== familyOf(best.id));
  if (rival && best.confidence / rival.confidence < MIN_MARGIN) {
    return null;
  }
  const id = best.id === "javascript" || best.id === "typescript" ? scriptDialect(sample) : best.id;
  return { id, confidence: best.confidence };
}

function contextLanguage(sample: string, context: DetectContext): string | null {
  for (const id of [context.cue, context.prior?.[0]]) {
    if (!id) {
      continue;
    }
    const base = id === "jsx" || id === "tsx" ? (id === "tsx" ? "typescript" : "javascript") : id;
    if (witnessed(base, sample)) {
      return base === "javascript" || base === "typescript" ? scriptDialect(sample) : id;
    }
  }
  return null;
}

/**
 * Best-effort language for an unhinted block, used for colour only. Returns null unless a
 * deterministic shape, the article context or the model agrees with the block's own syntax, so
 * ambiguous text stays plain. Output is a pure function of `value` and `context`.
 */
export async function detectLanguage(
  value: string,
  context: DetectContext = {},
): Promise<CodeLanguage | null> {
  const sample = value.slice(0, MAX_DETECT_CHARS);
  const lines = nonEmptyLines(sample);
  const shape = shapeLanguage(sample, lines);
  if (shape) {
    return lookupLanguage(shape);
  }
  if (looksLikeOutput(sample)) {
    return null;
  }
  const hinted =
    sample.trim().length >= MIN_CONTEXT_CHARS ? contextLanguage(sample, context) : null;
  const enough = sample.trim().length >= MIN_DETECT_CHARS && lines.length >= MIN_DETECT_LINES;
  const guess = enough ? await modelCandidate(sample) : null;
  let chosen: string | null = null;
  if (hinted && guess && familyOf(guess.id) !== familyOf(hinted)) {
    chosen = guess.confidence >= OVERRIDE_CONFIDENCE ? guess.id : hinted;
  } else {
    chosen = hinted ?? guess?.id ?? null;
  }
  return chosen ? lookupLanguage(chosen) : null;
}
