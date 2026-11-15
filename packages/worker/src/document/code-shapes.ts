/**
 * Deterministic syntax shapes for unhinted code blocks. Everything here is a pure function of
 * the text. Precision comes first: each detector requires the whole block to fit the shape, and
 * `witnessed` lets a statistical guess be checked against tokens its language cannot do without.
 * When nothing fits, the caller leaves the block plain.
 */

export function nonEmptyLines(value: string): string[] {
  return value.split("\n").filter((line) => line.trim());
}

// ---------------------------------------------------------------------------------------------
// Text that is not code: tool output, logs, stack traces, tables, diagrams, prose.
// ---------------------------------------------------------------------------------------------

const LOG_LINE = [
  /^\[?\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/,
  /^\[?\d{2}:\d{2}:\d{2}[\],.\s]/,
  /^\[\d{2}\/[A-Z][a-z]{2}\/\d{4}/,
  /^\[(?:TRACE|DEBUG|INFO|WARN(?:ING)?|ERROR|FATAL)\]/i,
  /^(?:TRACE|DEBUG|INFO|WARN(?:ING)?|ERROR|FATAL)[:\s]/,
  /^[A-Z][a-z]{2}\s+\d{1,2}\s\d{2}:\d{2}:\d{2}\s/,
  /^remote:\s/,
  /^(?:Counting|Compressing|Enumerating|Receiving|Resolving|Writing|Unpacking) (?:objects|deltas)/,
  /^\s*(?:Compiling|Finished|Running|Downloading|Downloaded|Fetching|Resolving|Installing|Collecting|Building|Linking|Created|Updating|Added|Removed)\s/,
  /^\s*\d{1,3}%\s*[|[]/,
  /^[=_-]{5,}.*[=_-]{5,}$/,
  /^collected \d+ items?|^\S+\.py\s+[.FEsx]+\s*(?:\[\s*\d+%\])?$/,
];

const TRACE_LINE = [
  /^Traceback \(most recent call last\)/,
  /^\s+at\s+[\w$.<>/[\]]+(?:\s+\(|\s*\()?.*:\d+/,
  /^\s+File ".*", line \d+/,
  /^(?:Caused by|Exception in thread|panic:|goroutine \d+)/,
  /^\s*\.\.\. \d+ more$/,
  /^\w[\w.]*(?:Error|Exception): .+/,
  /^={5,} .+ ={5,}$|^_{3,} .+ _{3,}$/,
];

const DIAGNOSTIC_LINE = /^\S+:\d+(?::\d+)?\s/;
const BOX_DRAWING = /[│┌┐└┘├┤┬┴┼─━┃╭╮╰╯═║╔╗╚╝↳▸▾]/;
const CODE_PUNCTUATION = /[{}();=<>$|\\[\]`]/;

function ratio(lines: string[], test: (line: string) => boolean): number {
  return lines.length === 0 ? 0 : lines.filter(test).length / lines.length;
}

/** Natural-language sentences: many plain words per line and almost no code punctuation. */
export function looksLikeProse(lines: string[]): boolean {
  const sentence = (line: string) => {
    const words = line.trim().split(/\s+/);
    if (words.length < 5 || CODE_PUNCTUATION.test(line)) {
      return false;
    }
    const plain = words.filter((word) => /^[A-Za-z][a-z'’]*[,.;:!?]?$/.test(word)).length;
    return plain / words.length >= 0.8;
  };
  return ratio(lines, sentence) >= 0.5;
}

/** Column-aligned text: runs of three or more spaces between words on nearly every line. */
function looksLikeAlignedTable(lines: string[]): boolean {
  return (
    lines.length >= 2 &&
    ratio(lines, (line) => /\S {3,}\S/.test(line.trim())) >= 0.8 &&
    ratio(lines, (line) => CODE_PUNCTUATION.test(line)) < 0.3
  );
}

/**
 * Tool output rather than code: compiler diagnostics, logs, progress, stack traces, tables,
 * tree diagrams and prose. Never coloured, since colouring them as code would be wrong.
 */
export function looksLikeOutput(value: string): boolean {
  const lines = nonEmptyLines(value);
  if (lines.length === 0) {
    return false;
  }
  if (ratio(lines, (line) => DIAGNOSTIC_LINE.test(line)) >= 0.5) {
    return true;
  }
  if (ratio(lines, (line) => LOG_LINE.some((pattern) => pattern.test(line))) >= 0.5) {
    return true;
  }
  if (lines.some((line) => TRACE_LINE.some((pattern) => pattern.test(line)))) {
    return lines.length >= 2;
  }
  if (lines.filter((line) => BOX_DRAWING.test(line)).length >= 2) {
    return true;
  }
  if (lines.length >= 2 && ratio(lines, (line) => /^\s*\|.*\|\s*$/.test(line)) >= 0.7) {
    return true;
  }
  if (shellShape(lines) !== null) {
    return false;
  }
  if (/[❶❷❸❹❺‾]/.test(value)) {
    return true;
  }
  if (/^```/.test(lines[0]?.trim() ?? "")) {
    return true;
  }
  if (lines.length >= 2 && looksLikeProse(lines)) {
    return true;
  }
  return looksLikeAlignedTable(lines);
}

// ---------------------------------------------------------------------------------------------
// Shell
// ---------------------------------------------------------------------------------------------

const COMMANDS = new Set(
  (
    "git npm npx pnpm yarn bun bunx node deno python python3 pip pip3 pipx uv uvx poetry conda " +
    "cargo rustup rustc go make cmake docker docker-compose kubectl helm terraform aws gcloud az " +
    "brew apt apt-get apk yum dnf pacman sudo curl wget ssh scp rsync cd ls mkdir rm cp mv cat " +
    "echo export source chmod chown touch grep sed awk find tar unzip zip ln ps kill pkill tmux " +
    "vim nvim nano code java javac mvn gradle dotnet nuget php composer ruby gem bundle rails rake " +
    "swift xcodebuild pod flutter dart adb systemctl journalctl service openssl gpg nc ping dig " +
    "nslookup which env unset alias set sleep head tail less more sort uniq wc xargs tee diff man " +
    "history clear exit screen nvm fnm volta asdf mise ollama claude gh jq yq sqlite3 psql mysql " +
    "redis-cli mongosh sbt mix elixir iex stack cabal ghc otool lldb codesign xcrun open pbcopy " +
    "pwd whoami date df du top htop lsof netstat ss ip ifconfig iptables ufw crontab printf eval " +
    "exec trap bash sh zsh fish source ./gradlew ./mvnw gcc g++ clang rustfmt pytest tsc eslint " +
    "prettier vite next nuxt expo eas turbo lerna nx ng ionic cdk sam serverless sls pulumi " +
    "ansible ansible-playbook vagrant minikube kind k3s istioctl argocd flux vercel netlify " +
    "wrangler firebase supabase heroku fly flyctl gcc make ninja meson conan vcpkg tput stty"
  ).split(" "),
);

const PACKAGE_MANAGERS = new Set(
  "npm npx pnpm yarn bun bunx pip pip3 pipx uv uvx brew apt apt-get apk yum dnf cargo gem go winget".split(
    " ",
  ),
);

/** English words that are also commands: they only count with a flag, path or operator. */
const AMBIGUOUS_COMMANDS = new Set(
  (
    "set find test read open code date id more clear which wait exit history man top free make go " +
    "ps kill service sort head tail less mix stack source env alias touch cat diff fly next " +
    "kind flux screen swift dart ip ss exec eval"
  ).split(" "),
);

const SHELL_KEYWORD =
  /^(?:then|else|fi|do|done|esac|elif\b.*|if\s+(?:\[|!|\S+;).*|(?:for\s+\w+\s+in|while|until)\s+.*(?:;\s*do)?|case\s+.*\s+in|function\s+\w+.*)$/;
const ENV_ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/;

function bareWords(args: string): number {
  return args
    .split(/\s+/)
    .filter((token) => /^[a-z][a-z'-]*[,.;:!?]?$/.test(token) && token.length > 1).length;
}

/** `cmd args` where cmd is a known command and the rest does not read as a sentence. */
function isCommandLine(raw: string): "known" | "assign" | "flagged" | false {
  let line = raw.trim().replace(/^[$%]\s+/, "");
  const elevated = /^sudo\s+\S/.test(line);
  line = line.replace(/^(?:sudo|time|nohup|doas)\s+/, "");
  if (ENV_ASSIGNMENT.test(line)) {
    return "assign";
  }
  if (/^[})\]]$|^\{$|^[\w-]+\s*\(\)\s*\{?$/.test(line)) {
    return "known";
  }
  const [first = "", ...rest] = line.split(/\s+/);
  const args = rest.join(" ");
  // `export const x = ...` is a module export, not a shell export.
  if (
    first === "export" &&
    /^(?:(?:const|let|var|default|function|class|type|interface|async|enum|abstract|declare)\b|\{|\*)/.test(
      args,
    )
  ) {
    return false;
  }
  const executable = /^(?:\.{1,2}\/|~\/|\/(?:usr|bin|opt|etc|var|home)\/)[\w./-]+$/.test(first);
  if (!COMMANDS.has(first) && !executable) {
    // An unknown tool is accepted only as `tool subcommand --flag`, beside known commands.
    if (elevated && /^[a-z][\w.-]*$/.test(first)) {
      return "known";
    }
    return /^[a-z][\w.-]*$/.test(first) &&
      /(?:^|\s)(?:--[a-z][\w-]*|-[a-zA-Z]\b)/.test(args) &&
      bareWords(args) <= 3
      ? "flagged"
      : false;
  }
  const strong = /(?:^|\s)-{1,2}[\w-]|[/\\|&<>$"'`=*]|\.\w+\b|\d/.test(args);
  if (AMBIGUOUS_COMMANDS.has(first) && !strong) {
    return false;
  }
  if (/[.!?]$/.test(args) && bareWords(args) >= 3 && !/\s\.\w+$|\/\S*\.$/.test(args)) {
    return false;
  }
  if (
    PACKAGE_MANAGERS.has(first) &&
    /^(?:install|add|i|get|remove|uninstall|update|upgrade|cask|tap|search|dlx|exec|run|create|init|x)\b|^[\w@./-]+(?:\s|$)/.test(
      args,
    )
  ) {
    return "known";
  }
  return bareWords(args) <= 5 ? "known" : false;
}

/** A line that continues the previous command: a flag, a pipe, a redirect or deeper indent. */
function continuesCommand(line: string, previousOpen: boolean): boolean {
  const trimmed = line.trim();
  return (
    /^(?:-{1,2}[\w-]|\||&&|\|\||>|<|\$\(|\)|["'])/.test(trimmed) ||
    (previousOpen && (/^\s/.test(line) || /^[\w./:~$"'<>[\]{}@=%+,-]+$/.test(trimmed)))
  );
}

function isOpen(line: string): boolean {
  const trimmed = line.trimEnd();
  const quotes = (trimmed.match(/(?<!\\)"/g) ?? []).length;
  return /(?:\\|\||&&|\|\||\()$/.test(trimmed) || quotes % 2 === 1;
}

const SHELL_PROMPT_PREFIX = /^(?:\[[\w.@ ~/-]+\][$#]|[\w.-]+@[\w.-]+[:~/\w. -]*[$#]|[$%]) /;
const SHELL_PROMPT = new RegExp(`${SHELL_PROMPT_PREFIX.source}\\S`);

/**
 * Terminal transcripts and scripts: every logical line is a known command, an assignment, a
 * control keyword, a comment or the continuation of one of those. `shellsession` when prompts
 * (`$ cmd`, `user@host:~$ cmd`) lead and anything else is output.
 */
export function shellShape(lines: string[]): "shellscript" | "shellsession" | null {
  const prompt = SHELL_PROMPT;
  const prompts = lines.filter((line) => prompt.test(line.trim()));
  if (prompts.length > 0 && prompt.test(lines[0]?.trim() ?? "")) {
    const commands = prompts.map((line) => line.trim().replace(SHELL_PROMPT_PREFIX, ""));
    if (commands.every((command) => /^[a-zA-Z./~_[(]/.test(command))) {
      return prompts.length === lines.length ? "shellscript" : "shellsession";
    }
  }
  let commandLines = 0;
  let assignments = 0;
  let flagged = 0;
  let open = false;
  let heredoc: string | null = null;
  let quoted = false;
  for (const line of lines) {
    if (heredoc) {
      if (line.trim() === heredoc) {
        heredoc = null;
      }
      continue;
    }
    const trimmed = line.trim();
    if (quoted) {
      if ((line.match(/(?<!\\)"/g) ?? []).length % 2 === 1) {
        quoted = false;
      }
      continue;
    }
    if (trimmed.startsWith("#")) {
      open = false;
      continue;
    }
    if (open && continuesCommand(line, open)) {
      open = isOpen(line);
      continue;
    }
    if (SHELL_KEYWORD.test(trimmed.replace(/^[$%]\s+/, ""))) {
      continue;
    }
    const kind = isCommandLine(trimmed);
    if (!kind) {
      if (continuesCommand(line, false) && commandLines > 0 && !/^["']/.test(trimmed)) {
        open = isOpen(line);
        continue;
      }
      return null;
    }
    if (kind === "known") {
      commandLines += 1;
    } else if (kind === "flagged") {
      flagged += 1;
    } else if (kind === "assign" && /^(?:export\s+)?[A-Z_][A-Z0-9_]*=/.test(trimmed)) {
      assignments += 1;
    }
    const here = trimmed.match(/<<-?\s*['"]?(\w+)['"]?/);
    if (here?.[1]) {
      heredoc = here[1];
    }
    // A string left open runs on over the next lines (an `echo "` that writes a file).
    quoted = (trimmed.match(/(?<!\\)"/g) ?? []).length % 2 === 1;
    open = !quoted && isOpen(line);
  }
  const assignmentsOnly = commandLines === 0 && assignments >= 2;
  return (commandLines > 0 || flagged > 0 || assignmentsOnly) && !open ? "shellscript" : null;
}

// ---------------------------------------------------------------------------------------------
// Data and markup shapes
// ---------------------------------------------------------------------------------------------

function stripJsonComments(value: string): string {
  return value.replace(/^\s*\/\/.*$/gm, "").replace(/,(\s*[\]}])/g, "$1");
}

/** JSON as written in articles: valid, or valid once comments and trailing commas are dropped. */
export function jsonShape(value: string): "json" | "jsonc" | null {
  const trimmed = value.trim();
  if (!/^[[{]/.test(trimmed)) {
    return null;
  }
  try {
    JSON.parse(trimmed);
    return "json";
  } catch {
    // fall through
  }
  try {
    JSON.parse(stripJsonComments(trimmed));
    return /^\s*\/\//m.test(trimmed) ? "jsonc" : "json";
  } catch {
    return null;
  }
}

/**
 * JSON that was elided or edited by the author: every line is a `"key": value`, a value, or a
 * bracket, there are at least three keys, and it opens with a bracket. Placeholders such as
 * `<bucket>` or `...` are allowed inside strings and as bare line values.
 */
export function looseJsonShape(lines: string[]): boolean {
  if (lines.length < 3 || !/^\s*[[{]/.test(lines[0] ?? "")) {
    return false;
  }
  const keys = lines.filter((line) => /^\s*"[^"]+"\s*:/.test(line)).length;
  const grammar =
    /^\s*(?:"[^"]*"\s*:\s*.*|[\]\[{}]+,?|"[^"]*",?|-?\d[\d.eE+-]*,?|true,?|false,?|null,?|\.\.\.|…)\s*$/;
  return keys >= 2 && lines.every((line) => grammar.test(line) || /^\s*\/\//.test(line));
}

export function tomlShape(lines: string[]): boolean {
  const first = lines[0]?.trim() ?? "";
  if (!/^\[\[?[\w."'-]+\]\]?$/.test(first)) {
    return false;
  }
  return lines.every((line) =>
    /^(\[\[?[\w."'-]+\]\]?|[\w."'-]+\s*=\s*\S.*|#.*)$/.test(line.trim()),
  );
}

/** `key: value` mappings and `- item` lists with consistent indentation. */
export function yamlShape(lines: string[]): boolean {
  if (lines.length < 3) {
    return false;
  }
  const body = lines.filter((line) => !/^\s*(?:#.*|---|\.\.\.)\s*$/.test(line));
  const mapping = /^(\s*)(?:- )?[A-Za-z_$][\w.$/-]*\s*:(?:\s+(\S.*))?$/;
  const listItem = /^\s*-\s+\S.*$/;
  let keys = 0;
  let scalarIndent = -1;
  for (const line of body) {
    const indent = line.length - line.trimStart().length;
    if (scalarIndent >= 0 && indent > scalarIndent) {
      continue;
    }
    scalarIndent = -1;
    const match = line.match(mapping);
    if (match) {
      keys += 1;
      const value = (match[2] ?? "").replace(/\s+#.*$/, "");
      if (/^[|>][+-]?\d?$/.test(value.trim())) {
        scalarIndent = match[1]!.length;
      }
      // A value that is a sentence is prose with colons in it, not configuration.
      if (value.split(/\s+/).filter((word) => /^[A-Za-z][a-z']*[,.]?$/.test(word)).length >= 6) {
        return false;
      }
      if (/^(?:else|try|finally|except|elif)\s*:/.test(line.trim())) {
        return false;
      }
    } else if (!listItem.test(line)) {
      return false;
    }
    if (/;\s*$|^\s*[{}]\s*$|<\/?\w+[\s>]|=>|\):\s*$/.test(line)) {
      return false;
    }
  }
  const structured = body.some(
    (line) => /^\s+\S/.test(line) || listItem.test(line) || /:\s*$/.test(line),
  );
  const lowerKey = body.some((line) => /^\s*(?:- )?[a-z_][\w.$/-]*\s*:/.test(line));
  // `Status: PASS` pairs of capitalised words are plain text, not configuration.
  return keys >= 2 && (structured || lowerKey);
}

const HTML_TAGS = new Set(
  (
    "html head body div span p a img ul ol li table tr td th thead tbody h1 h2 h3 h4 h5 h6 " +
    "script style link meta title form input button label select option textarea nav header " +
    "footer section article main aside figure figcaption iframe svg path br hr pre code em strong " +
    "i b u small video audio source canvas template slot details summary"
  ).split(" "),
);

/** Markup that opens with a tag, `<!DOCTYPE>` or `<?xml`, and whose tags are balanced. */
export function markupShape(value: string, lines: string[]): "html" | "xml" | null {
  const trimmed = value.trim();
  if (/^<\?xml\b/i.test(trimmed)) {
    return "xml";
  }
  if (/^<!doctype html/i.test(trimmed)) {
    return "html";
  }
  if (!/^<!?[A-Za-z][\w:.-]*[\s/>]/.test(trimmed) && !/^<!--/.test(trimmed)) {
    return null;
  }
  // JSX and generics put braces, arrows and keywords inside the tags.
  if (
    /<\w[^<>]*=\{|^\s*(?:import|export|const|let|var|function|return)\b|=>/m.test(trimmed) &&
    !/^<(?:script|style)\b/i.test(trimmed)
  ) {
    return null;
  }
  if (/^<(?:script|style)\b[^>]*>[\s\S]*<\/(?:script|style)>$/i.test(trimmed)) {
    return "html";
  }
  const tags = [...trimmed.matchAll(/<\/?([A-Za-z][\w:.-]*)(?:\s[^<>]*?)?(\/?)>/g)];
  if (tags.length < 2) {
    return null;
  }
  const text = lines.filter(
    (line) => !/^\s*(?:<|\/?>|-->|[\w:.-]+="|[\w:.-]+=)/.test(line) && !/<!--/.test(line),
  );
  if (text.length > lines.length * 0.4 && !tags.some((tag) => HTML_TAGS.has(tag[1]!))) {
    return null;
  }
  const known = tags.filter((tag) => HTML_TAGS.has(tag[1]!)).length;
  const names = new Set(tags.map((tag) => tag[1]!));
  const unknown = [...names].filter((name) => !HTML_TAGS.has(name));
  if (known >= tags.length * 0.6 && unknown.every((name) => /^[a-z][\w-]*$/.test(name))) {
    return "html";
  }
  if (known === 0 || unknown.length > 0) {
    return unknown.some((name) => /^[A-Z]|:/.test(name)) || known === 0 ? "xml" : null;
  }
  return "html";
}

/** `selector { property: value; }` rules, with `$var`, `@mixin` and `&` nesting meaning SCSS. */
export function cssShape(value: string, lines: string[]): "css" | "scss" | null {
  if (lines.length < 3) {
    return null;
  }
  const declarations = lines.filter((line) => /^\s*[\w-]+\s*:\s*[^;{}]+;\s*$/.test(line)).length;
  const openers = lines.filter((line) => /^\s*[^;{}]+\{\s*$/.test(line)).length;
  const closers = lines.filter((line) => /^\s*\}\s*$/.test(line)).length;
  if (
    declarations < 2 ||
    openers < 1 ||
    closers < 1 ||
    /^\s*(?:function|const|let|var|if|for)\b/m.test(value)
  ) {
    return null;
  }
  const covered = lines.filter(
    (line) =>
      /^\s*[\w-]+\s*:\s*[^;{}]+;\s*$/.test(line) ||
      /^\s*[^;{}]+\{\s*$/.test(line) ||
      /^\s*\}\s*$/.test(line) ||
      /^\s*(?:\/\/|\/\*|\*)/.test(line),
  ).length;
  if (covered < lines.length * 0.85) {
    return null;
  }
  return /^\s*\$[\w-]+\s*:|@mixin|@include|^\s*&[:.\s]/m.test(value) ? "scss" : "css";
}

const SQL_START =
  /^\s*(?:select\s[\s\S]+?\sfrom\s+[\w."`[\]]+|insert\s+into\s+[\w."`]+|update\s+[\w."`]+\s+set\s|delete\s+from\s+[\w."`]+|create\s+(?:or\s+replace\s+)?(?:temp(?:orary)?\s+)?(?:table|view|index|unique\s+index|database|schema|function|procedure|trigger|extension)\b|alter\s+table\s+[\w."`]+|drop\s+(?:table|view|index|database|schema)\b|with\s+\w+\s+as\s*\(|grant\s+\w+|truncate\s+table\b|explain\s+(?:analyze\s+)?select\b|begin;?\s*$)/i;

/** A SQL statement shape, accepted when the block is not prose and ends like SQL. */
export function sqlShape(rawValue: string, lines: string[]): boolean {
  const value = rawValue.replace(/^(?:\s*(?:--.*|\/\*[\s\S]*?\*\/)\n)+/, "");
  if (!SQL_START.test(value) || /[{}]\s*$/m.test(value) || looksLikeProse(lines)) {
    return false;
  }
  return (
    /;\s*(?:--.*)?$/.test(value.trim()) || lines.length >= 2 || /^\s*select\s+[\w*]/i.test(value)
  );
}

export function diffShape(lines: string[]): boolean {
  if (lines.length < 3) {
    return false;
  }
  const header = lines.some((line) =>
    /^(?:diff --git |index [\da-f]+\.\.|@@ -\d+(?:,\d+)? \+\d+(?:,\d+)? @@)/.test(line),
  );
  const files =
    lines.some((line) => /^--- \S/.test(line)) && lines.some((line) => /^\+\+\+ \S/.test(line));
  return header || files;
}

const DOCKER_INSTRUCTION =
  /^(?:FROM|RUN|COPY|ADD|CMD|ENTRYPOINT|ENV|EXPOSE|WORKDIR|ARG|LABEL|USER|VOLUME|HEALTHCHECK|SHELL|STOPSIGNAL|ONBUILD|MAINTAINER)\s/;

export function dockerfileShape(lines: string[]): boolean {
  const body = lines.filter((line) => !/^\s*#/.test(line));
  if (!/^FROM\s+\S+/.test(body[0] ?? "")) {
    return false;
  }
  let continued = false;
  for (const line of body) {
    if (continued || DOCKER_INSTRUCTION.test(line)) {
      continued = /\\\s*$/.test(line);
      continue;
    }
    return false;
  }
  return true;
}

export function httpShape(lines: string[]): boolean {
  const first = lines[0] ?? "";
  if (
    !/^(?:(?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+\S+(?:\s+HTTP\/[\d.]+)?|HTTP\/[\d.]+\s+\d{3}\b.*)$/.test(
      first.trim(),
    )
  ) {
    return false;
  }
  return lines.length >= 2 && lines.slice(1).every((line) => /^[\w-]+:\s|^\s*$|^[{["]/.test(line));
}

export const VISUAL_BASIC =
  /^\s*(?:End\s+(?:Sub|Class|Function|Module|If|Namespace|Property)\b|Dim\s+\w+(?:\s+As\b|\s*=)|(?:Public|Private|Friend)\s+(?:Shared\s+)?(?:Sub|Function|Module|Class|NotInheritable)\b|Imports\s+[\w.]+\s*$|Module\s+\w+\s*$)/m;

/** Visual Basic: keywords no curly-brace language uses. */
export function visualBasicShape(value: string): boolean {
  return VISUAL_BASIC.test(value) && !/;\s*$/m.test(value);
}
