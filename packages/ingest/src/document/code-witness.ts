import {
  cssShape,
  diffShape,
  dockerfileShape,
  httpShape,
  jsonShape,
  looseJsonShape,
  markupShape,
  nonEmptyLines,
  shellShape,
  sqlShape,
  tomlShape,
  VISUAL_BASIC,
  yamlShape,
} from "./code-shapes";

/**
 * Witnesses: tokens a language cannot do without, used to vet a statistical guess or an
 * article-level prior against the block's own syntax.
 */
type Witness = { all?: RegExp[]; any: RegExp[]; none?: RegExp[] };

/** Tokens only C# and Java write: typed declarations a script language cannot contain. */
const STATICALLY_TYPED_NONE = [
  /\b(?:public|private|protected|internal)\s+(?:static\s+|async\s+|override\s+|readonly\s+|sealed\s+|abstract\s+)*[\w<>[\]?,]+\s+\w+\s*[({=;]/,
  /\bTask<?\w*>?\s+\w+\(/,
  /(?:^|[(,\s])(?:string|int|bool|double|decimal|long|float|char|byte)\s+[a-z_]\w*\s*[,)=;]/,
  /^\s*using\s+(?:var\s+)?\w+\s*=\s*new\b/m,
  /^\s*(?:using|namespace)\s+[\w.]+;/m,
  /\bpublic\s+(?:class|static|void)\b/,
  /\b[A-Z]\w*\.[A-Z]\w*\(|\.[A-Z][a-z]\w*\(/,
];

const CURLY_LANGUAGE_NONE = [
  /^\s*def \w+\(.*\):\s*$/m,
  /^\s*(?:elif|except)\b.*:\s*$/m,
  VISUAL_BASIC,
];

const WITNESS: Record<string, Witness> = {
  python: {
    any: [
      /^\s*def \w+\s*\(.*\)\s*(?:->.*)?:\s*$/m,
      /^\s*class \w+(?:\(.*\))?:\s*$/m,
      /^\s*(?:from [\w.]+ )?import [\w., *]+$/m,
      /^\s*(?:if|elif|else|for|while|try|except|finally|with)\b.*:\s*$/m,
      /\bprint\(/,
      /^\s*@\w[\w.]*(?:\(.*\))?\s*$/m,
      /^\s*\w+\s*=\s*\w[\w.]*\(.*\)\s*$/m,
    ],
    none: [/;\s*$/m, /^\s*(?:function|const|let|var|public|private)\b/m, /=>/],
  },
  javascript: {
    any: [
      /\b(?:const|let|var)\s+[\w{[]/,
      /\bfunction\b\s*\w*\s*\(/,
      /=>/,
      /\bimport\s+.*\bfrom\s+['"]/,
      /\brequire\(['"]/,
      /\bconsole\.\w+\(/,
      /\bmodule\.exports\b|\bexport\s+(?:default|const|function|class)\b/,
      /\bawait\b|\basync\b/,
    ],
    none: [...CURLY_LANGUAGE_NONE, ...STATICALLY_TYPED_NONE],
  },
  csharp: {
    any: [
      /^\s*using\s+[\w.]+;/m,
      /^\s*namespace\s+[\w.]+/m,
      /\b(?:public|private|protected|internal)\s+(?:static\s+|async\s+|override\s+|sealed\s+|abstract\s+|readonly\s+)*[\w<>[\]?,]+\s+\w+/,
      /\{\s*get;\s*(?:set;|init;)?\s*\}/,
      /\bvar\s+\w+\s*=\s*new\b/,
      /\bawait\s+\w+/,
      /\bstring\.\w+\(|\bConsole\.\w+\(|\bTask<?\w*>?\s+\w+\(/,
      /\b[A-Z]\w*\.[A-Z]\w*\(|\.[A-Z][a-z]\w*\(/,
      /\bvar\s+\w+\s*=/,
    ],
    none: [...CURLY_LANGUAGE_NONE, /^\s*(?:import|package)\s/m, /:=|^\s*func\s/m],
  },
  java: {
    any: [
      /^\s*import\s+(?:static\s+)?[\w.]+\*?;/m,
      /^\s*package\s+[\w.]+;/m,
      /\b(?:public|private|protected)\s+(?:static\s+|final\s+|abstract\s+)*[\w<>[\],?]+\s+\w+\s*[({=;]/,
      /\bSystem\.(?:out|err)\.\w+\(/,
      /@Override\b|@\w+(?:\(.*\))?\s*$/m,
    ],
    none: [...CURLY_LANGUAGE_NONE, /^\s*using\s+[\w.]+;/m],
  },
  go: {
    any: [
      /^\s*package\s+\w+\s*$/m,
      /^\s*func\s+(?:\(\w+\s+\*?\w+\)\s+)?\w+\(/m,
      /\w+\s*:=\s*\S/,
      /^\s*import\s*\(/m,
      /\bfmt\.\w+\(/,
      /\bfor\s+.*\brange\b/,
      /\bchan\b|\bgo\s+func\(/,
      /\berr\s*!=\s*nil\b/,
      /^\s*var\s+\w+\s+\[?\]?\*?\w+\s*$/m,
      /\[\]\w+\{/,
    ],
    none: [...CURLY_LANGUAGE_NONE, /\blet\s+mut\b/],
  },
  rust: {
    any: [
      /\bfn\s+\w+\s*[(<]/,
      /\blet\s+(?:mut\s+)?\w+/,
      /\bimpl\b.*\{/,
      /^\s*use\s+[\w:]+(?:::\{.*\})?;/m,
      /\bprintln!\(|\bvec!\[/,
      /->\s*[\w<>&]+\s*\{/,
      /^\s*#\[\w+/m,
    ],
    none: [...CURLY_LANGUAGE_NONE, /^\s*(?:function|const|var)\b/m],
  },
  ruby: {
    any: [
      /^\s*def\s+\w+[?!]?(?:\(.*\))?\s*$/m,
      /^\s*end\s*$/m,
      /\bputs\s+\S/,
      /^\s*require\s+['"]/m,
      /^\s*class\s+\w+(?:\s*<\s*[\w:]+)?\s*$/m,
      /\bdo\s*(?:\|[\w, ]*\|)?\s*$/m,
      /^\s*attr_(?:reader|writer|accessor)\b/m,
      /^\s*(?:module|include|extend)\s+\w/m,
    ],
    none: [
      /;\s*$/m,
      /^\s*(?:function|const|let|var)\b/m,
      /\)\s*\{\s*$/m,
      /\|>|\bdefmodule\b|^\s*@\w+\s+[[:"%{\w]|,\s*do:|\bpipe_through\b|^\s*def\s+\w+.*\bdo\s*$/m,
    ],
  },
  php: {
    any: [
      /<\?php/,
      /\$\w+\s*=\s*\S/,
      /->\w+\(/,
      /^\s*(?:namespace|use)\s+[\w\\]+;/m,
      /\bfunction\s+\w+\s*\(/,
      /\becho\s+/,
      /\barray\(|\b\w+::\w+\(/,
    ],
    all: [/\$\w+|<\?php/],
    none: [/^\s*(?:import|from)\s+\w/m, /^\s*def\s/m],
  },
  powershell: {
    any: [
      /\b(?:Get|Set|New|Remove|Invoke|Write|Import|Install|Start|Stop|Test|Add|Out|Select|Where|ForEach)-[A-Z]\w+/,
      /\$\w+\s*=\s*\S/,
      /\bparam\s*\(/i,
      /\[Parameter\(|\[CmdletBinding\(/,
      /\$_\b|\$PSScriptRoot|\$env:/,
      /^\s*(?:if|foreach|function)\s*[(\w].*\{/m,
    ],
    none: [/^\s*(?:import|from)\s+\w+/m, /;\s*$/m],
  },
  c: {
    any: [
      /^\s*#\s*(?:include|define|ifdef|ifndef|endif|pragma)\b/m,
      /\b(?:int|void|char|float|double|size_t|uint\d+_t)\s+\**\w+\s*\(/,
      /\bprintf\(|\bmalloc\(|\bsizeof\(/,
      /\bstruct\s+\w+\s*\{/,
      /\btypedef\b/,
    ],
    none: [...CURLY_LANGUAGE_NONE, /::|\bstd\b|\bclass\s+\w+/],
  },
  cpp: {
    any: [
      /\bstd::\w+/,
      /^\s*#\s*include\s*<\w+>/m,
      /\btemplate\s*</,
      /\b(?:cout|cin)\s*<</,
      /\bnamespace\s+\w+/,
      /\bclass\s+\w+.*\{/,
      /::\w+\(/,
    ],
    none: [...CURLY_LANGUAGE_NONE],
  },
  kotlin: {
    any: [
      /\bfun\s+\w+\s*\(/,
      /\b(?:val|var)\s+\w+(?::\s*[\w<>?]+)?\s*=/,
      /\bdata\s+class\b/,
      /\bprintln\(/,
      /^\s*package\s+[\w.]+\s*$/m,
    ],
    none: [...CURLY_LANGUAGE_NONE, /;\s*$/m],
  },
  swift: {
    any: [
      /\bfunc\s+\w+\s*[(<]/,
      /^\s*import\s+(?:Foundation|UIKit|SwiftUI|Combine)\b/m,
      /\b(?:guard|if)\s+let\b/,
      /\b(?:let|var)\s+\w+\s*(?::\s*[\w<>?[\]]+)?\s*=/,
      /@(?:State|Binding|Published|main|ObservedObject)\b/,
    ],
    none: [...CURLY_LANGUAGE_NONE, /;\s*$/m],
  },
  scala: {
    any: [
      /\bdef\s+\w+\s*[(\[:]/,
      /\b(?:val|var)\s+\w+\s*(?::\s*[\w[\]]+)?\s*=/,
      /\bcase\s+class\b|\bobject\s+\w+|\btrait\s+\w+/,
      /\bimport\s+[\w.]+\._?/,
    ],
  },
  dart: {
    any: [
      /\bvoid\s+main\s*\(/,
      /^\s*import\s+'package:/m,
      /\bWidget\s+build\b|\bStatelessWidget\b|\bStatefulWidget\b/,
      /\bfinal\s+\w+/,
    ],
  },
  lua: {
    any: [/\blocal\s+\w+/, /\bfunction\s+[\w.:]*\s*\(/, /^\s*end\s*$/m, /\bthen\s*$/m],
    none: [/;\s*$/m, /\{\s*$/m],
  },
  r: {
    any: [/<-/, /\blibrary\(/, /%>%|\|>/, /\bfunction\s*\(/, /\bdata\.frame\(|\bggplot\(/],
    none: [/;\s*$/m, /^\s*(?:def|import)\b/m],
  },
  clojure: {
    any: [
      /^\s*\((?:def|defn|ns|let|fn|require|defprotocol|defrecord)\b/m,
      /\(\w[\w.-]*\s+[^()]*\)/,
    ],
    all: [/^\s*\(/m],
  },
  haskell: {
    any: [
      /^\w+\s*::\s*[\w[\]()]/m,
      /^module\s+[\w.]+/m,
      /^import\s+(?:qualified\s+)?[A-Z][\w.]*/m,
      /\bwhere\s*$/m,
    ],
  },
  elixir: {
    any: [/\bdefmodule\b/, /\bdef\s+\w+/, /\|>/, /\bdo\s*$/m, /^\s*end\s*$/m],
    all: [/\bdefmodule\b|\bdef\s+\w+|\|>/],
  },
  erlang: { any: [/^-module\(/m, /^-export\(/m, /^\w+\(.*\)\s*->\s*$/m] },
  perl: { any: [/\bmy\s+[$@%]\w+/, /^\s*use\s+(?:strict|warnings)\b/m, /\bsub\s+\w+\s*\{/, /=~/] },
  groovy: {
    any: [/\bdef\s+\w+/, /\bpipeline\s*\{|\bstage\s*\(/, /@\w+/],
    all: [/\bdef\s+\w+|\bpipeline\s*\{|\bstage\s*\(/],
  },
  "objective-c": {
    any: [/@interface\b|@implementation\b|@property\b/, /\[\w+\s+\w+(?::.*)?\]/, /\bNS\w+\b/],
  },
  latex: { any: [/\\(?:begin|end|documentclass|usepackage|section|textbf|frac)\b/] },
  bat: {
    any: [/^\s*@?echo\s+(?:off|on)\b/im, /^\s*set\s+\w+=/im, /%\w+%/, /^\s*(?:goto|rem|call)\s/im],
  },
  makefile: { any: [/^[\w.%-]+\s*:(?!=).*\n\t/m, /^\s*[A-Z_]+\s*[:?+]?=\s*\S/m, /^\.PHONY\b/m] },
  make: { any: [/^[\w.%-]+\s*:(?!=).*\n\t/m, /^\.PHONY\b/m] },
  cmake: {
    any: [
      /^\s*(?:cmake_minimum_required|project|add_executable|add_library|target_link_libraries|find_package)\s*\(/im,
    ],
  },
  lisp: { any: [/^\s*\((?:defun|defvar|setq|let|lambda|defmacro)\b/m] },
  terraform: {
    any: [
      /^\s*(?:resource|variable|provider|module|data|output|terraform|locals)\s+(?:"[\w-]+"\s*)*\{/m,
      /^\s*\w+\s*=\s*(?:"|var\.|local\.|\[|\{)/m,
    ],
    all: [/^\s*(?:resource|variable|provider|module|data|output|terraform|locals)\b/m],
  },
  graphql: {
    any: [/^\s*(?:query|mutation|subscription|type|input|enum|schema|fragment)\s+\w*[^{]*\{/m],
  },
  sql: { any: [/;\s*$/m, /\bfrom\b/i] },
  typescript: {
    any: [
      /\b(?:const|let|var)\s+[\w{[]/,
      /\bfunction\b\s*\w*\s*[(<]/,
      /=>/,
      /\bimport\s+.*\bfrom\s+['"]/,
      /\b(?:interface|type|enum)\s+\w+/,
      /\bexport\s+(?:default|const|function|class|type|interface)\b/,
      /\bawait\b|\basync\b/,
    ],
    none: [...CURLY_LANGUAGE_NONE, ...STATICALLY_TYPED_NONE],
  },
};
WITNESS.tsx = WITNESS.typescript!;
WITNESS.jsx = WITNESS.javascript!;

function passes(witness: Witness, value: string, strength: number): boolean {
  return (
    witness.any.filter((pattern) => pattern.test(value)).length >= strength &&
    (witness.all ?? []).every((pattern) => pattern.test(value)) &&
    !(witness.none ?? []).some((pattern) => pattern.test(value))
  );
}

const SHAPED = new Set([
  "shellscript",
  "shellsession",
  "json",
  "jsonc",
  "yaml",
  "toml",
  "xml",
  "html",
  "css",
  "scss",
  "sql",
  "diff",
  "docker",
  "http",
]);

/** Data, markup and shell formats whose whole text must fit their shape. */
export function isStrictShape(language: string): boolean {
  return SHAPED.has(language);
}

/** Lines that are only `name = value` (or `name := value`) and comments: no language signal. */
export function bareAssignments(lines: string[]): boolean {
  return lines.every((line) => /^\s*(?:[\w.$]+\s*:?=\s*\S.*|#.*|\/\/.*)$/.test(line));
}

/** Whether `witnessed` can speak for `language` at all. */
export function hasWitness(language: string): boolean {
  return SHAPED.has(language) || language in WITNESS;
}

/**
 * Whether `value` carries the structural tokens of `language`, at least `strength` distinct
 * ones. Languages with a dedicated shape detector are checked through it; a language with no
 * witness is never vouched for.
 */
export function witnessed(language: string, value: string, strength = 1): boolean {
  const lines = nonEmptyLines(value);
  switch (language) {
    case "shellscript":
    case "shellsession":
      return shellShape(lines) !== null;
    case "json":
    case "jsonc":
      return jsonShape(value) !== null || looseJsonShape(lines);
    case "yaml":
      return yamlShape(lines);
    case "toml":
      return tomlShape(lines);
    case "xml":
    case "html":
      return markupShape(value, lines) !== null;
    case "css":
    case "scss":
      return cssShape(value, lines) !== null;
    case "sql":
      return sqlShape(value, lines);
    case "diff":
      return diffShape(lines);
    case "docker":
      return dockerfileShape(lines);
    case "http":
      return httpShape(lines);
    default: {
      const witness = WITNESS[language];
      return witness ? passes(witness, value, strength) : false;
    }
  }
}

const TYPESCRIPT_CUES = [
  /\b(?:interface|enum|namespace|declare|abstract|implements|readonly)\s+\w+/,
  /^\s*(?:export\s+)?type\s+\w+(?:<.*>)?\s*=/m,
  /\)\s*:\s*(?:Promise<|string|number|boolean|void|any|unknown|never|[A-Z]\w*(?:\[\])?)\s*[={;]/,
  /\b\w+\??:\s*(?:string|number|boolean|any|unknown|void|never|[A-Z]\w*(?:<.*>)?(?:\[\])?)\s*[,;)=]/,
  /\bas\s+(?:const|unknown|any|[A-Z]\w*)\b/,
  /<\w+(?:,\s*\w+)*>\(/,
  /\w!\.|\w!\)/,
];
const JSX_CUES = [/<[A-Z][\w.]*(?:\s[^<>]*)?\/?>/, /<\/[A-Za-z][\w.]*>/, /<>|<\/>/];

/** Picks javascript, typescript, jsx or tsx for a block known to be one of them. */
export function scriptDialect(value: string): "javascript" | "typescript" | "jsx" | "tsx" {
  const typed = TYPESCRIPT_CUES.some((pattern) => pattern.test(value));
  const jsx =
    JSX_CUES.some((pattern) => pattern.test(value)) && /(?:return|=>)\s*\(?\s*</.test(value);
  if (jsx) {
    return typed ? "tsx" : "jsx";
  }
  return typed ? "typescript" : "javascript";
}
