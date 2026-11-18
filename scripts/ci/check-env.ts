import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fail, section } from "./log";

/**
 * Fails when a tracked env file holds a plaintext value. `dotenvx ext precommit` only inspects files
 * that differ from HEAD, so on a clean checkout (CI) or a pushed commit it checked nothing; this
 * reads every tracked file instead.
 */

const ENV_FILE = /(^|\/)\.env(\.|$)/;
/** Plain by design: the template people copy. */
const EXAMPLE_FILE = /(^|\/)\.env\.(example|x)$/;
/** Holds the private keys that decrypt every other file; it must never be tracked. */
const KEYS_FILE = /(^|\/)\.env\.keys(\.|$)/;
/** The public half of a keypair is written beside the values it encrypts. */
const PUBLIC_KEY = /^DOTENV_PUBLIC_KEY(?:_[A-Z0-9_]+)?$/;

export type EnvViolation = { file: string; reason: string };

/** The keys whose value is neither empty nor encrypted. Values are never returned or printed. */
export function plaintextKeys(contents: string) {
  const keys: string[] = [];

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim().replace(/^export\s+/, "");
    const separator = line.indexOf("=");
    if (!line || line.startsWith("#") || separator === -1) {
      continue;
    }

    const key = line.slice(0, separator).trim();
    const value = line
      .slice(separator + 1)
      .trim()
      .replace(/^["']/, "");
    if (!PUBLIC_KEY.test(key) && value !== "" && !value.startsWith("encrypted:")) {
      keys.push(key);
    }
  }

  return keys;
}

export function checkEnvFiles(root = process.cwd()): EnvViolation[] {
  const listed = spawnSync("git", ["-C", root, "ls-files", "-z"], { encoding: "utf8" });
  if (listed.status !== 0) {
    throw new Error(`git ls-files failed in ${root}: ${listed.stderr.trim()}`);
  }

  const violations: EnvViolation[] = [];
  for (const file of listed.stdout.split("\0").filter((path) => ENV_FILE.test(path))) {
    if (KEYS_FILE.test(file)) {
      violations.push({ file, reason: "holds private keys and must not be tracked" });
      continue;
    }
    if (EXAMPLE_FILE.test(file) || !existsSync(join(root, file))) {
      continue;
    }

    const keys = plaintextKeys(readFileSync(join(root, file), "utf8"));
    if (keys.length > 0) {
      violations.push({ file, reason: `has plaintext values for ${keys.join(", ")}` });
    }
  }

  return violations;
}

if (import.meta.main) {
  section("Checking tracked env files for plaintext secrets");

  let violations: EnvViolation[];
  try {
    violations = checkEnvFiles();
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
