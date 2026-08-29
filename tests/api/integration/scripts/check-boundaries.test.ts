import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, test } from "bun:test";
import { checkBoundaries } from "../../../../scripts/check-boundaries";

const fixtures: string[] = [];
type FixtureFiles = Record<string, string>;

async function createFixture(files: FixtureFiles): Promise<string> {
  const root = await mkdtemp(join("/tmp", "kyomi-boundaries-"));
  fixtures.push(root);

  for (const [path, contents] of Object.entries(files)) {
    const target = join(root, path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, contents);
  }

  return root;
}

afterEach(async () => {
  await Promise.all(fixtures.splice(0).map((root) => rm(root, { force: true, recursive: true })));
});

describe("check-boundaries", () => {
  test("checks package roots that import app internals", async () => {
    const root = await createFixture({
      "packages/db/src/invalid.ts": 'import { app } from "apps/api/src/app";\n',
    });
    const [violation] = checkBoundaries(root);

    expect(violation).toMatchObject({
      file: "packages/db/src/invalid.ts",
      reason: "packages must not import app internals",
    });
  });

  test("checks package roots for deep package imports", async () => {
    const root = await createFixture({
      "packages/reader/src/invalid.ts": 'import { button } from "@kyomi/ui/src/button";\n',
    });
    const [violation] = checkBoundaries(root);

    expect(violation).toMatchObject({
      file: "packages/reader/src/invalid.ts",
      reason: "import packages through public exports, not /src internals",
    });
  });

  test("allows public package imports in db and reader roots", async () => {
    const root = await createFixture({
      "packages/db/src/valid.ts": 'import { button } from "@kyomi/ui/button";\n',
      "packages/reader/src/valid.ts": 'import { input } from "@kyomi/ui/input";\n',
    });

    expect(checkBoundaries(root)).toEqual([]);
  });
});
