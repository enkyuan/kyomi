import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, test } from "bun:test";
import {
  checkEnvFiles,
  hasUnparsedText,
  plaintextKeys,
  pushedRanges,
} from "../../../../../scripts/ci/check-env";

const SCRIPT = join(import.meta.dir, "../../../../../scripts/ci/check-env.ts");
const ENCRYPTED = "encrypted:BE+aNwVs8X18mgit+8CMZrZ1jA69H1/+/Q7MOqYarLIdo6ibzAcmd71i63";
const PLAINTEXT_SECRET = "hunter2-do-not-leak";

const fixtures: string[] = [];

/** A git repository whose index holds `files`, committed or not: what a checkout looks like. */
async function repository(files: Record<string, string>) {
  const root = await mkdtemp(join("/tmp", "kyomi-check-env-"));
  fixtures.push(root);

  for (const [path, contents] of Object.entries(files)) {
    const target = join(root, path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, contents);
  }
  Bun.spawnSync(["git", "init", "-q"], { cwd: root });
  Bun.spawnSync(["git", "add", "-A", "-f"], { cwd: root });

  return root;
}

function git(root: string, ...args: string[]) {
  const result = Bun.spawnSync(
    ["git", "-c", "user.name=t", "-c", "user.email=t@example.com", ...args],
    { cwd: root },
  );
  return result.stdout.toString().trim();
}

/** Commits what is staged and returns the new commit. */
function commit(root: string) {
  git(root, "commit", "-q", "--allow-empty", "-m", "x");
  return git(root, "rev-parse", "HEAD");
}

async function stage(root: string, files: Record<string, string>) {
  for (const [path, contents] of Object.entries(files)) {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), contents);
  }
  git(root, "add", "-f", "-A");
}

function runScript(root: string, args: string[] = [], stdin?: string) {
  const result = Bun.spawnSync(["bun", SCRIPT, ...args], {
    cwd: root,
    ...(stdin === undefined ? {} : { stdin: Buffer.from(stdin) }),
  });
  return {
    code: result.exitCode,
    output: `${result.stdout.toString()}${result.stderr.toString()}`,
  };
}

afterEach(async () => {
  await Promise.all(fixtures.splice(0).map((root) => rm(root, { force: true, recursive: true })));
});

describe("plaintextKeys", () => {
  test("accepts encrypted values, the public key, comments, and empty values", () => {
    const contents = [
      "# comment",
      'DOTENV_PUBLIC_KEY="02abc"',
      "DOTENV_PUBLIC_KEY_PRODUCTION=03def",
      `DATABASE_URL=${ENCRYPTED}`,
      `BETTER_AUTH_SECRET="${ENCRYPTED}"`,
      `export TOKEN='${ENCRYPTED}'`,
      "OPTIONAL=",
      "",
    ].join("\n");

    expect(plaintextKeys(contents)).toEqual([]);
  });

  test("names every plaintext key, however it is written", () => {
    const contents = [
      `DATABASE_URL=${ENCRYPTED}`,
      `PASSWORD=${PLAINTEXT_SECRET}`,
      `QUOTED="${PLAINTEXT_SECRET}"`,
      `export EXPORTED=${PLAINTEXT_SECRET}`,
      `  INDENTED = ${PLAINTEXT_SECRET}`,
      "WINDOWS=value\r",
    ].join("\n");

    expect(plaintextKeys(contents)).toEqual([
      "PASSWORD",
      "QUOTED",
      "EXPORTED",
      "INDENTED",
      "WINDOWS",
    ]);
  });
});

describe("plaintextKeys, read the way dotenvx reads a file", () => {
  test("names a value written with colon syntax", () => {
    expect(
      plaintextKeys(`PASSWORD: ${PLAINTEXT_SECRET}\nexport TOKEN: ${PLAINTEXT_SECRET}\n`),
    ).toEqual(["PASSWORD", "TOKEN"]);
  });

  test("names a quoted value that starts on the line after the quote, in either quote style", () => {
    expect(
      plaintextKeys(`PRIVATE_KEY="\n${PLAINTEXT_SECRET}\n"\nGOOGLE='\n{"k":"v"}\n'\n`),
    ).toEqual(["PRIVATE_KEY", "GOOGLE"]);
  });

  test("splits on a bare carriage return, which hides a plaintext line behind an encrypted one", () => {
    expect(plaintextKeys(`A=${ENCRYPTED}\rB=${PLAINTEXT_SECRET}\n`)).toEqual(["B"]);
  });

  test("checks every value of a repeated key", () => {
    expect(plaintextKeys(`A=${ENCRYPTED}\nA=${PLAINTEXT_SECRET}\n`)).toEqual(["A"]);
  });

  test("prints only a conventional variable name, never other text that parses as a key", () => {
    const body = "abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789==";
    expect(
      plaintextKeys(`${body}\nlower_case=${PLAINTEXT_SECRET}\nOK_KEY=${PLAINTEXT_SECRET}\n`),
    ).toEqual(["<unprintable key>", "OK_KEY"]);
  });

  test("keeps accepting a file that dotenvx encrypted", () => {
    const contents = [
      "#/-------------------[DOTENV_PUBLIC_KEY]--------------------/",
      "#/            public-key encryption for .env files          /",
      "#/----------------------------------------------------------/",
      'DOTENV_PUBLIC_KEY="02abc"',
      "",
      "# api",
      `DATABASE_URL="${ENCRYPTED}" # inline comment`,
      `A: ${ENCRYPTED}`,
    ].join("\r\n");

    expect(plaintextKeys(contents)).toEqual([]);
    expect(hasUnparsedText(contents)).toBe(false);
  });
});

describe("hasUnparsedText", () => {
  test("flags a line dotenvx skips, which would otherwise hide a secret", () => {
    expect(hasUnparsedText(`A=${ENCRYPTED}\n${PLAINTEXT_SECRET}\n`)).toBe(true);
    expect(hasUnparsedText(`TOKEN:${PLAINTEXT_SECRET}\n`)).toBe(true);
    expect(hasUnparsedText(`-----BEGIN KEY-----\nA=${ENCRYPTED}\n`)).toBe(true);
  });

  test("accepts comments, blank lines, empty values and CRLF", () => {
    expect(hasUnparsedText(`# c\r\n\r\nA=\r\nB=${ENCRYPTED}\r\n   # indented\n`)).toBe(false);
    expect(hasUnparsedText("")).toBe(false);
  });
});

describe("pushedRanges", () => {
  const local = "a".repeat(40);
  const remote = "b".repeat(40);
  const none = "0".repeat(40);

  test("scans a new branch against what the remotes already have, and skips a deletion", async () => {
    const root = await repository({ "README.md": "x\n" });

    expect(
      pushedRanges(
        root,
        `refs/heads/new ${local} refs/heads/new ${none}\n(delete) ${none} refs/heads/old ${remote}\n`,
      ),
    ).toEqual([[local, "--not", "--remotes"]]);
  });

  test("scans an unknown remote commit like a new branch", async () => {
    const root = await repository({ "README.md": "x\n" });

    expect(pushedRanges(root, `refs/heads/main ${local} refs/heads/main ${remote}\n`)).toEqual([
      [local, "--not", "--remotes"],
    ]);
  });

  test("scans only the new commits when the remote commit is known", async () => {
    const root = await repository({ "README.md": "x\n" });
    const base = commit(root);

    expect(pushedRanges(root, `refs/heads/main ${local} refs/heads/main ${base}\n`)).toEqual([
      [`${base}..${local}`],
    ]);
  });

  test("refuses input it cannot read instead of guessing what is pushed", async () => {
    const root = await repository({ "README.md": "x\n" });

    expect(() => pushedRanges(root, "refs/heads/main nonsense\n")).toThrow();
  });
});

describe("check-env", () => {
  test("fails a tracked env file with a plaintext secret, naming the key but not the value", async () => {
    const root = await repository({
      "apps/api/.env": `DOTENV_PUBLIC_KEY="02abc"\nDATABASE_URL=${ENCRYPTED}\nBETTER_AUTH_SECRET=${PLAINTEXT_SECRET}\n`,
    });

    expect(checkEnvFiles(root)).toEqual([
      { file: "apps/api/.env", reason: "has plaintext values for BETTER_AUTH_SECRET" },
    ]);

    const { code, output } = runScript(root);
    expect(code).toBe(1);
    expect(output).toContain("apps/api/.env: has plaintext values for BETTER_AUTH_SECRET");
    expect(output).not.toContain(PLAINTEXT_SECRET);
  });

  test("fails a plaintext file that is already committed, which a diff against HEAD never shows", async () => {
    const root = await repository({ "docker/.env": `POSTGRES_PASSWORD=${PLAINTEXT_SECRET}\n` });
    for (const args of [
      ["-c", "user.name=t", "-c", "user.email=t@example.com", "commit", "-q", "-m", "x"],
    ]) {
      Bun.spawnSync(["git", ...args], { cwd: root });
    }

    expect(runScript(root).code).toBe(1);
  });

  test("fails a tracked key file, and other tracked env variants", async () => {
    const root = await repository({
      ".env.keys": "DOTENV_PRIVATE_KEY=abc\n",
      "apps/web/.env.production": `API_ORIGIN=${PLAINTEXT_SECRET}\n`,
    });

    expect(checkEnvFiles(root).map(({ file }) => file)).toEqual([
      ".env.keys",
      "apps/web/.env.production",
    ]);
  });

  test("passes encrypted env files and plaintext examples", async () => {
    const root = await repository({
      "docker/.env": `DOTENV_PUBLIC_KEY="02abc"\nPOSTGRES_PASSWORD=${ENCRYPTED}\n`,
      "apps/api/.env": `DATABASE_URL=${ENCRYPTED}\n`,
      "apps/api/.env.example": `DATABASE_URL=postgres://postgres:admin@localhost/kyomi\n`,
      "docker/.env.example": "POSTGRES_PASSWORD=admin\n",
    });

    expect(checkEnvFiles(root)).toEqual([]);
    const { code, output } = runScript(root);
    expect(code).toBe(0);
    expect(output).toContain("Every tracked env file is encrypted.");
  });

  test("ignores a plaintext env file that is not tracked", async () => {
    const root = await repository({ "README.md": "x\n" });
    await writeFile(join(root, ".env.local"), `SECRET=${PLAINTEXT_SECRET}\n`);

    expect(checkEnvFiles(root)).toEqual([]);
  });

  test("fails plaintext staged for the next commit although the working tree holds an encrypted copy", async () => {
    const root = await repository({ "apps/api/.env": `PASSWORD=${PLAINTEXT_SECRET}\n` });
    await writeFile(join(root, "apps/api/.env"), `PASSWORD=${ENCRYPTED}\n`);

    expect(checkEnvFiles(root)).toEqual([
      { file: "apps/api/.env", reason: "has plaintext values for PASSWORD" },
    ]);
    expect(runScript(root).code).toBe(1);
  });

  test("fails a staged plaintext file that is missing from the working tree", async () => {
    const root = await repository({ "apps/api/.env": `PASSWORD=${PLAINTEXT_SECRET}\n` });
    await rm(join(root, "apps/api/.env"));

    expect(checkEnvFiles(root).map(({ file }) => file)).toEqual(["apps/api/.env"]);
  });

  test("judges the staged content, not a plaintext copy left unstaged in the working tree", async () => {
    const root = await repository({ "apps/api/.env": `PASSWORD=${ENCRYPTED}\n` });
    await writeFile(join(root, "apps/api/.env"), `PASSWORD=${PLAINTEXT_SECRET}\n`);

    expect(checkEnvFiles(root)).toEqual([]);
  });

  test("fails a file dotenvx reads differently from a line parser", async () => {
    const root = await repository({
      "apps/api/.env": `A: ${PLAINTEXT_SECRET}\n`,
      "apps/web/.env": `K="\n${PLAINTEXT_SECRET}\n"\n`,
      "docker/.env": `A=${ENCRYPTED}\rB=${PLAINTEXT_SECRET}\n`,
      "other/.env": `A=${ENCRYPTED}\n${PLAINTEXT_SECRET}\nconstructor=${ENCRYPTED}\n`,
    });

    const { code, output } = runScript(root);
    expect(code).toBe(1);
    expect(output).toContain("apps/api/.env: has plaintext values for A");
    expect(output).toContain("apps/web/.env: has plaintext values for K");
    expect(output).toContain("docker/.env: has plaintext values for B");
    expect(output).toContain("other/.env: ");
    expect(output).not.toContain(PLAINTEXT_SECRET);
  });

  test("fails an env file whose text dotenvx cannot parse", async () => {
    const root = await repository({ "apps/api/.env": `A=${ENCRYPTED}\n${PLAINTEXT_SECRET}\n` });

    expect(checkEnvFiles(root)).toEqual([
      { file: "apps/api/.env", reason: "has text dotenvx cannot parse, so it cannot be verified" },
    ]);
  });

  test("never prints a value, even from a line that parses as a key", async () => {
    const body = "abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789==";
    const root = await repository({ "a/.env": `A=${ENCRYPTED}\n${body}\n` });

    const { code, output } = runScript(root);
    expect(code).toBe(1);
    expect(output).toContain("a/.env: has plaintext values for <unprintable key>");
    expect(output).not.toContain(body);
  });

  test("checks every env-like file name, in any case", async () => {
    const root = await repository({
      "a/production.env": `K=${PLAINTEXT_SECRET}\n`,
      "b/env.production": `K=${PLAINTEXT_SECRET}\n`,
      "c/.env-x": `K=${PLAINTEXT_SECRET}\n`,
      "d/.envrc": `export K=${PLAINTEXT_SECRET}\n`,
      "e/.ENV": `K=${PLAINTEXT_SECRET}\n`,
      "f/.env.x": `K=${PLAINTEXT_SECRET}\n`,
      "g/.ENV.EXAMPLE": `K=${PLAINTEXT_SECRET}\n`,
    });

    expect(checkEnvFiles(root).map(({ file }) => file)).toEqual([
      "a/production.env",
      "b/env.production",
      "c/.env-x",
      "d/.envrc",
      "e/.ENV",
      "f/.env.x",
      "g/.ENV.EXAMPLE",
    ]);
  });

  test("names a plaintext file under a non-ASCII directory by its real path", async () => {
    const root = await repository({ "apps/café/.env": `K=${PLAINTEXT_SECRET}\n` });

    expect(checkEnvFiles(root)).toEqual([
      { file: "apps/café/.env", reason: "has plaintext values for K" },
    ]);
  });

  test("leaves files that only look like env files alone", async () => {
    const root = await repository({
      "apps/web/src/env.ts": `export const K = "${PLAINTEXT_SECRET}";\n`,
      "apps/web/src/env.d.ts": "declare const K: string;\n",
      "apps/web/src/t3.env.ts": "export {};\n",
      "packages/catalog/inputs/environment.json": "{}\n",
      "apps/api/.env.example": "K=plain\n",
      "apps/mobile/ios/.xcode.env": "export NODE_BINARY=$(command -v node)\n",
    });

    expect(checkEnvFiles(root)).toEqual([]);
  });

  test("does not follow a tracked symlink out of the repository", async () => {
    const root = await repository({ "README.md": "x\n" });
    const outside = await mkdtemp(join("/tmp", "kyomi-check-env-outside-"));
    fixtures.push(outside);
    await writeFile(join(outside, "secret"), `K=${PLAINTEXT_SECRET}\n`);
    await symlink(join(outside, "secret"), join(root, ".env"));
    git(root, "add", "-f", ".env");

    expect(checkEnvFiles(root)).toEqual([
      {
        file: ".env",
        reason: "is not a regular file, so it cannot be verified; track the file itself",
      },
    ]);
    expect(runScript(root).output).not.toContain(PLAINTEXT_SECRET);
  });

  test("still checks the env files of a repository whose file list exceeds a megabyte, which spawnSync truncates", async () => {
    const root = await repository({ "apps/api/.env": `K=${PLAINTEXT_SECRET}\n` });
    const empty = git(root, "hash-object", "-w", "--stdin");
    const padding = Array.from(
      { length: 12_000 },
      (_, index) => `100644 ${empty} 0\t0-padding/${"x".repeat(100)}-${index}.txt`,
    );
    Bun.spawnSync(["git", "update-index", "--add", "--index-info"], {
      cwd: root,
      stdin: Buffer.from(`${padding.join("\n")}\n`),
    });

    expect(checkEnvFiles(root)).toEqual([
      { file: "apps/api/.env", reason: "has plaintext values for K" },
    ]);
  });

  test("fails plaintext that an earlier commit in the range added and a later one encrypted", async () => {
    const root = await repository({ "apps/api/.env": `K=${ENCRYPTED}\n` });
    const base = commit(root);
    await stage(root, { "apps/api/.env": `K=${PLAINTEXT_SECRET}\n` });
    const leaked = commit(root);
    await stage(root, { "apps/api/.env": `K=${ENCRYPTED}\n` });
    const head = commit(root);

    expect(checkEnvFiles(root)).toEqual([]);
    expect(checkEnvFiles(root, { ranges: [[`${leaked}..${head}`]] })).toEqual([]);
    expect(checkEnvFiles(root, { ranges: [[`${base}..${head}`]] })).toEqual([
      {
        file: `apps/api/.env (commit ${leaked.slice(0, 7)})`,
        reason: "has plaintext values for K",
      },
    ]);
  });

  test("fails a pushed range through the pre-push hook input and the --range option", async () => {
    const root = await repository({ "apps/api/.env": `K=${ENCRYPTED}\n` });
    const base = commit(root);
    await stage(root, { "apps/api/.env": `K=${PLAINTEXT_SECRET}\n` });
    commit(root);
    await stage(root, { "apps/api/.env": `K=${ENCRYPTED}\n` });
    const head = commit(root);
    const hookInput = `refs/heads/main ${head} refs/heads/main ${base}\n`;

    const pushed = runScript(root, ["--pre-push"], hookInput);
    expect(pushed.code).toBe(1);
    expect(pushed.output).toContain("apps/api/.env (commit ");
    expect(pushed.output).not.toContain(PLAINTEXT_SECRET);

    expect(runScript(root, ["--range", `${base}..${head}`]).code).toBe(1);
    expect(runScript(root, ["--range", `${head}..${head}`]).code).toBe(0);
    expect(
      runScript(root, ["--pre-push"], `refs/heads/main ${head} refs/heads/main ${head}\n`).code,
    ).toBe(0);
    expect(runScript(root, ["--pre-push"], "").code).toBe(0);
    expect(runScript(root, ["--range", "--output=x"]).code).toBe(1);
    expect(runScript(root, ["--nope"]).code).toBe(1);
  });

  test("passes this repository, whose env files are encrypted", () => {
    expect(checkEnvFiles(join(import.meta.dir, "../../../../.."))).toEqual([]);
  });
});
