import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, test } from "bun:test";
import { checkEnvFiles, plaintextKeys } from "../../../../../scripts/ci/check-env";

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

function runScript(root: string) {
  const result = Bun.spawnSync(["bun", SCRIPT], { cwd: root });
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

  test("passes this repository, whose env files are encrypted", () => {
    expect(checkEnvFiles(join(import.meta.dir, "../../../../.."))).toEqual([]);
  });
});
