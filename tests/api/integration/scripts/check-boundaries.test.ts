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

  test("keeps shared web code from importing domain modules", async () => {
    const root = await createFixture({
      "apps/web/src/lib/invalid.ts":
        'import { prefetchInboxFlow } from "@modules/inbox/lib/navigation";\n',
    });
    const [violation] = checkBoundaries(root);

    expect(violation).toMatchObject({
      file: "apps/web/src/lib/invalid.ts",
      reason: "shared web code must not import domain modules",
    });
  });

  test("rejects web modules that depend on each other in a cycle", async () => {
    const root = await createFixture({
      "apps/web/src/modules/inbox/page.tsx": 'import { Detail } from "@modules/reader/detail";\n',
      "apps/web/src/modules/reader/detail.tsx": 'import type { Filter } from "../inbox/search";\n',
      "apps/web/src/modules/inbox/search.ts": "export type Filter = string;\n",
    });

    const violations = checkBoundaries(root)
      .map(({ file, reason }) => ({ file, reason }))
      .sort((left, right) => left.file.localeCompare(right.file));

    expect(violations).toEqual([
      {
        file: "apps/web/src/modules/inbox/page.tsx",
        reason: "web modules inbox and reader must not depend on each other in a cycle",
      },
      {
        file: "apps/web/src/modules/reader/detail.tsx",
        reason: "web modules reader and inbox must not depend on each other in a cycle",
      },
    ]);
  });

  test("allows one-way web module dependencies", async () => {
    const root = await createFixture({
      "apps/web/src/modules/inbox/page.tsx":
        'import { Detail } from "@modules/reader/detail";\nimport { Source } from "@modules/articles/source";\n',
      "apps/web/src/modules/reader/detail.tsx": 'import { Source } from "../articles/source";\n',
      "apps/web/src/modules/articles/source.tsx": 'import { apiJson } from "@lib/api";\n',
      "apps/web/src/app/shell.tsx": 'import { Page } from "@modules/inbox/page";\n',
    });

    expect(checkBoundaries(root)).toEqual([]);
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
