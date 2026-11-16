import type { ReaderBlock, ReaderInline } from "@kyomi/reader/document";
import { detectLanguage, familyOf, shapeLanguage } from "./code-detect";
import { languageFromFilename, resolveLanguage, type CodeLanguage } from "./code-language";
import { looksLikeOutput, nonEmptyLines } from "./code-shapes";
import { bareAssignments, hasWitness, isStrictShape, witnessed } from "./code-witness";
import { childBlockLists, inlinesText } from "./kdm-tree";

/** Words that introduce a block of tool output, as in "gawain check shop.py prints:". */
const OUTPUT_CUE =
  /\b(?:prints?|outputs?|reports?|shows?|produces?|emits?|displays?|results?|returns?|responds?|logs?)\s*:?\s*$/i;
const FILE_NAME = /^[\w@./-]+\.[A-Za-z0-9]+$|^(?:Dockerfile|Makefile|Gemfile|Rakefile)$/;

/** Languages a sentence can name. `go` and `r` are left out: too common as plain words. */
const LANGUAGE_WORDS: [RegExp, string][] = [
  [/\bpython3?\b/i, "python"],
  [/\bjavascript\b|\bnode\.?js\b/i, "javascript"],
  [/\btypescript\b/i, "typescript"],
  [/\bruby\b/i, "ruby"],
  [/\brust\b/i, "rust"],
  [/\bgolang\b/i, "go"],
  [/\bjava\b/i, "java"],
  [/\bphp\b/i, "php"],
  [/\bpowershell\b/i, "powershell"],
  [/\bkotlin\b/i, "kotlin"],
  [/\bswift\b/i, "swift"],
  [/\bscala\b/i, "scala"],
  [/\bc#|\bcsharp\b/i, "csharp"],
  [/\bc\+\+|\bcpp\b/i, "cpp"],
  [/\blua\b/i, "lua"],
  [/\bperl\b/i, "perl"],
  [/\bhaskell\b/i, "haskell"],
  [/\belixir\b/i, "elixir"],
  [/\bterraform\b/i, "terraform"],
  [/\bgroovy\b/i, "groovy"],
  [/\bdart\b/i, "dart"],
];

type Introduction = { filename?: string; output: boolean; cue?: string };

function paragraphText(block: ReaderBlock | undefined): string | null {
  return block?.type === "paragraph" || block?.type === "heading"
    ? inlinesText(block.children).trim()
    : null;
}

/** The one language a short run of text names, or none when it names several. */
function namedLanguage(text: string | null): string | undefined {
  if (!text) {
    return undefined;
  }
  const tail = text.length > 300 ? text.slice(-300) : text;
  const found = new Set(
    LANGUAGE_WORDS.filter(([pattern]) => pattern.test(tail)).map(([, id]) => id),
  );
  return found.size === 1 ? [...found][0] : undefined;
}

/** What the text right before a code block says about it: a file it holds, output, a language. */
function introduction(
  previous: ReaderBlock | undefined,
  heading: string | undefined,
): Introduction {
  if (previous?.type !== "paragraph") {
    const cue = namedLanguage(heading ?? null);
    return { output: false, ...(cue ? { cue } : {}) };
  }
  const text = inlinesText(previous.children).trim();
  let filename: string | undefined;
  const visit = (inlines: readonly ReaderInline[]) => {
    for (const inline of inlines) {
      if (inline.type === "code" && FILE_NAME.test(inline.value.trim())) {
        filename = inline.value.trim();
      } else if ("children" in inline) {
        visit(inline.children);
      }
    }
  };
  visit(previous.children);
  const cue = namedLanguage(text) ?? namedLanguage(heading ?? null);
  return {
    ...(filename ? { filename } : {}),
    output: OUTPUT_CUE.test(text),
    ...(cue ? { cue } : {}),
  };
}

export type CodeClassificationInput = {
  value: string;
  /** Languages the same article's other blocks carry explicitly, most common first. */
  prior?: readonly string[] | undefined;
  /** The block right after this one in its list. */
  next?: ReaderBlock | undefined;
  /** Text of the nearest heading above the block. */
  heading?: string | undefined;
  /** The language as the source wrote it (`language-ts`), before canonicalization. */
  hint?: string | undefined;
  filename?: string | undefined;
  /** The block right before this one in its list. */
  previous?: ReaderBlock | undefined;
};

export type CodeClassification = {
  source: "explicit" | "filename" | "shebang" | "none";
  /** The label: only ever set from a signal the author or a filename gave. */
  language: CodeLanguage | null;
  /** The language the colouring uses: the label, or a confident guess when there is no label. */
  colour: CodeLanguage | null;
};

/**
 * A filename vouches for a block only when the block does not contradict it: "run
 * `kubectl apply -f app.yaml`" names a file the block merely mentions, a log or a table is not
 * source whatever the file is called, and a snippet that imports `output.json` is not JSON.
 * Data and markup formats must show their own shape; a programming language must show its
 * tokens, or be bare assignments that carry no language signal.
 */
function fileMatches(language: CodeLanguage, value: string): boolean {
  if (looksLikeOutput(value)) {
    return false;
  }
  const lines = nonEmptyLines(value);
  const shape = shapeLanguage(value, lines);
  if (shape !== null) {
    // HTML and XML are one family for colouring, but a label must name the right one.
    const markup = shape === "html" || shape === "xml";
    return markup ? shape === language.id : familyOf(shape) === familyOf(language.id);
  }
  if (hasWitness(language.id)) {
    return (
      witnessed(language.id, value) || (isStrictShape(language.id) ? false : bareAssignments(lines))
    );
  }
  return true;
}

export async function classifyCode(input: CodeClassificationInput): Promise<CodeClassification> {
  const intro = introduction(input.previous, input.heading);
  let resolved = resolveLanguage(input.hint, input.filename, input.value);
  // "Given `shop.py`:" names the file the block shows, which is as good as a filename.
  const introduced = intro.filename ? languageFromFilename(intro.filename) : null;
  if (
    resolved.source === "none" &&
    introduced &&
    !intro.output &&
    fileMatches(introduced, input.value)
  ) {
    resolved = { source: "filename", language: introduced };
  }
  const skipDetection = intro.output || looksLikeOutput(input.value);
  const colour =
    resolved.language ??
    (resolved.source === "none" && !skipDetection
      ? await detectLanguage(input.value, { cue: intro.cue, prior: input.prior })
      : null);
  return { source: resolved.source, language: resolved.language, colour };
}

type CodeBlock = Extract<ReaderBlock, { type: "code" }>;

export type CodeEntry = {
  block: CodeBlock;
  previous?: ReaderBlock | undefined;
  next?: ReaderBlock | undefined;
  heading?: string | undefined;
};

/** Every code block in document order with the neighbours and heading that describe it. */
export function collectCodeEntries(blocks: ReaderBlock[]): CodeEntry[] {
  const entries: CodeEntry[] = [];
  let heading: string | undefined;
  const visit = (list: ReaderBlock[]) => {
    list.forEach((block, index) => {
      if (block.type === "heading") {
        heading = inlinesText(block.children).trim() || undefined;
      }
      if (block.type === "code") {
        entries.push({
          block,
          previous: list[index - 1],
          next: list[index + 1],
          heading,
        });
      }
      for (const child of childBlockLists(block)) {
        visit(child);
      }
    });
  };
  visit(blocks);
  return entries;
}

/** Language ids ordered by how often they appear, ties broken by first appearance. */
export function priorFrom(languages: readonly string[]): string[] {
  const counts = new Map<string, number>();
  for (const id of languages) {
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1]).map(([id]) => id);
}
