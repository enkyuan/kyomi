/// <reference path="./dotenvx-primitives.d.ts" />
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { encrypted, scan } from "@dotenvx/primitives";
import { fail, section } from "./log";

/**
 * Fails when a tracked env file holds a plaintext value. `dotenvx ext precommit` only inspects files
 * that differ from HEAD, so on a clean checkout (CI) or a pushed commit it checked nothing.
 *
 * This reads the content git would commit (the index blobs, never the working tree, which may differ
 * or be absent) and, for a push or a pull request, every env file the new commits added, so plaintext
 * that a later commit encrypted still fails. Values are parsed with dotenvx's own `scan`, so the file
 * is read exactly as `dotenvx run` reads it; text `scan` skips fails the check instead of passing it.
 * Blobs are read with `git cat-file`, so a tracked symlink is never followed out of the repository.
 */

/** Basename, case-insensitive: `.env`, `.env.production`, `.env-x`, `.envrc`, `prod.env`, `env.production`. */
const ENV_FILE =
  /^(?:\.env(?:[.-].*)?|\.envrc(?:\..*)?|.+\.env|env\.(?:production|prod|development|dev|staging|stage|test|local|preview|ci))$/i;
/** Plain by design (case-sensitive, so `.ENV.EXAMPLE` is still checked): the template people copy, and React Native's Xcode node path. */
const PLAIN_FILE = /^(?:\.env\.example|\.xcode\.env)$/;
/** Holds the private keys that decrypt every other file; it must never be tracked. */
const KEYS_FILE = /^\.env\.keys(?:\..*)?$/i;
/** The public half of a keypair is written beside the values it encrypts. */
const PUBLIC_KEY = /^DOTENV_PUBLIC_KEY(?:_[A-Z0-9_]+)?$/;
/** The only text a report may print from a file: a conventional variable name, never a value. */
const KEY_NAME = /^[A-Z_][A-Z0-9_]{0,63}$/;
/** The line grammar of `scan` in @dotenvx/primitives 0.8, used only to find the text `scan` skips. */
const ENTRY =
  /^\s*(?:export\s+)?[\w.-]+(?:\s*=\s*?|:\s+?)(?:\s*'(?:\\'|[^'])*'|\s*"(?:\\"|[^"])*"|\s*`(?:\\`|[^`])*`|[^#\r\n]+)?\s*(?:#.*)?$/gm;
const REGULAR_FILE = /^100(?:644|755)$/;
const OBJECT_ID = /^[0-9a-f]{40}(?:[0-9a-f]{24})?$/;
const NULL_ID = /^0+$/;

export type EnvViolation = { file: string; reason: string };

/** A file as git records it: a blob at a path, and the commit that added it when it came from history. */
type Tracked = { path: string; mode: string; blob: string; commit?: string };

/** The keys whose value is neither empty nor encrypted. Values are never returned or printed. */
export function plaintextKeys(contents: string) {
  const keys = new Set<string>();

  for (const [name, values] of Object.entries(scan(contents).parsed)) {
    if (!PUBLIC_KEY.test(name) && values.some((value) => value !== "" && !encrypted(value))) {
      keys.add(KEY_NAME.test(name) ? name : "<unprintable key>");
    }
  }

  return [...keys];
}

/**
 * Whether the file holds text `scan` did not turn into an entry, such as a bare `hunter2` line. It
 * cannot be told from a secret, so it counts as one. Also true if `scan` and the grammar above
 * disagree on how many entries there are, which means the installed dotenvx parser has changed.
 */
export function hasUnparsedText(contents: string) {
  const text = contents.replace(/\r\n?/g, "\n");
  const entries = Object.values(scan(contents).parsed).reduce(
    (sum, values) => sum + values.length,
    0,
  );

  if ([...text.matchAll(ENTRY)].length !== entries) {
    return true;
  }
  return text
    .replace(ENTRY, "")
    .split("\n")
    .some((line) => line.trim() !== "" && !line.trim().startsWith("#"));
}

function problems(contents: string) {
  try {
    const keys = plaintextKeys(contents);
    return [
      ...(keys.length > 0 ? [`has plaintext values for ${keys.join(", ")}`] : []),
      ...(hasUnparsedText(contents)
        ? ["has text dotenvx cannot parse, so it cannot be verified"]
        : []),
    ];
  } catch {
    // `scan` itself throws on a name such as `constructor`; dotenvx cannot load that file either.
    return ["cannot be parsed by dotenvx, so it cannot be verified"];
  }
}

function git(root: string, args: string[]) {
  const result = spawnSync("git", ["-C", root, ...args], { encoding: "utf8", maxBuffer: Infinity });
  if (result.status !== 0) {
    const reason = result.error?.message ?? (result.stderr.trim() || `exit ${result.status}`);
    throw new Error(`git ${args[0]} failed in ${root}: ${reason}`);
  }
  return result.stdout;
}

/** Every path in the index, at the content staged for the next commit. */
function indexFiles(root: string): Tracked[] {
  return git(root, ["ls-files", "-s", "-z"])
    .split("\0")
    .filter(Boolean)
    .map((record) => {
      const match = /^(\d{6}) ([0-9a-f]+) \d\t([\s\S]+)$/.exec(record);
      if (!match?.[2] || !OBJECT_ID.test(match[2])) {
        throw new Error(`git ls-files returned an entry this check cannot read in ${root}`);
      }
      return { mode: match[1] ?? "", blob: match[2], path: match[3] ?? "" };
    });
}

/** Every file the commits in `revisions` added or changed, at the content each commit gave it. */
function addedFiles(root: string, revisions: string[]): Tracked[] {
  const tokens = git(root, [
    ...["log", "-m", "--no-renames", "--raw", "-z", "--no-abbrev", "--diff-filter=d"],
    ...["--format=%H", ...revisions, "--"],
  ]).split("\0");

  const files: Tracked[] = [];
  let commit = "";
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]?.trim() ?? "";
    const raw = /^:\d{6} (\d{6}) [0-9a-f]+ ([0-9a-f]+) [A-Z]\d*$/.exec(token);
    if (raw?.[2]) {
      index += 1;
      files.push({ mode: raw[1] ?? "", blob: raw[2], path: tokens[index] ?? "", commit });
    } else if (OBJECT_ID.test(token)) {
      commit = token.slice(0, 7);
    } else if (token !== "") {
      throw new Error(`git log returned output this check cannot read in ${root}`);
    }
  }
  return files;
}

export function checkEnvFiles(root = process.cwd(), options: { ranges?: string[][] } = {}) {
  const tracked = [
    ...indexFiles(root),
    ...(options.ranges ?? []).flatMap((revisions) => addedFiles(root, revisions)),
  ];

  const violations: EnvViolation[] = [];
  const seen = new Set<string>();
  const verdicts = new Map<string, string[]>();
  for (const { path, mode, blob, commit } of tracked) {
    const name = path.slice(path.lastIndexOf("/") + 1);
    if (!ENV_FILE.test(name)) {
      continue;
    }

    let reasons: string[];
    if (KEYS_FILE.test(name)) {
      reasons = ["holds private keys and must not be tracked"];
    } else if (PLAIN_FILE.test(name)) {
      continue;
    } else if (!REGULAR_FILE.test(mode)) {
      reasons = ["is not a regular file, so it cannot be verified; track the file itself"];
    } else {
      reasons = verdicts.get(blob) ?? problems(git(root, ["cat-file", "blob", blob]));
      verdicts.set(blob, reasons);
    }

    const file = commit ? `${path} (commit ${commit})` : path;
    for (const reason of reasons) {
      if (!seen.has(`${file}\0${reason}`)) {
        seen.add(`${file}\0${reason}`);
        violations.push({ file, reason });
      }
    }
  }

  return violations;
}

/** The commits a push publishes, from the `<local ref> <local sha> <remote ref> <remote sha>` lines git feeds a pre-push hook. */
export function pushedRanges(root: string, hookInput: string) {
  const ranges: string[][] = [];

  for (const line of hookInput.split("\n").filter((entry) => entry.trim() !== "")) {
    const [, local, , remote, ...extra] = line.trim().split(/\s+/);
    if (
      !local ||
      !remote ||
      extra.length > 0 ||
      !OBJECT_ID.test(local) ||
      !OBJECT_ID.test(remote)
    ) {
      throw new Error("Unrecognised pre-push input; cannot tell which commits are being pushed");
    }
    if (NULL_ID.test(local)) {
      continue;
    }

    const known =
      !NULL_ID.test(remote) &&
      spawnSync("git", ["-C", root, "cat-file", "-e", `${remote}^{commit}`]).status === 0;
    ranges.push(known ? [`${remote}..${local}`] : [local, "--not", "--remotes"]);
  }

  return ranges;
}

/** The ranges named on the command line: `--range <revisions>`, or `--pre-push` to read them from the hook's stdin. */
function rangesFromArguments(root: string, args: string[]) {
  const ranges: string[][] = [];
  const rest = [...args];

  for (let arg = rest.shift(); arg !== undefined; arg = rest.shift()) {
    const revisions = arg === "--range" ? rest.shift() : undefined;
    if (arg === "--pre-push") {
      ranges.push(...pushedRanges(root, readFileSync(0, "utf8")));
    } else if (revisions && !revisions.startsWith("-")) {
      ranges.push([revisions]);
    } else {
      throw new Error(
        `Unknown argument ${JSON.stringify(arg)}; use --pre-push or --range <revisions>`,
      );
    }
  }

  return ranges;
}

if (import.meta.main) {
  section("Checking tracked env files for plaintext secrets");

  let violations: EnvViolation[];
  try {
    const ranges = rangesFromArguments(process.cwd(), process.argv.slice(2));
    violations = checkEnvFiles(process.cwd(), { ranges });
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }

  for (const { file, reason } of violations) {
    console.error(`${file}: ${reason}`);
  }
  if (violations.length > 0) {
    fail("Encrypt the file with 'bun run env:encrypt', or stop tracking it.");
  }
  console.log("Every tracked env file is encrypted.");
}
