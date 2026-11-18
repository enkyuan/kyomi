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

  test("rejects a web module that imports a module above it, even without a cycle", async () => {
    const root = await createFixture({
      "apps/web/src/modules/feeds/list.tsx": 'import { Source } from "@modules/articles/source";\n',
      "apps/web/src/modules/articles/source.tsx": 'import { apiJson } from "@lib/api";\n',
    });

    expect(checkBoundaries(root)).toEqual([
      {
        file: "apps/web/src/modules/feeds/list.tsx",
        specifier: "@modules/articles/source",
        reason:
          "web module feeds must not import articles, which sits above it in the module stack",
      },
    ]);
  });

  test("reports the upward side of a cycle across tiers, type imports included", async () => {
    const root = await createFixture({
      "apps/web/src/modules/inbox/page.tsx": 'import { Detail } from "@modules/reader/detail";\n',
      "apps/web/src/modules/reader/detail.tsx": 'import type { Filter } from "../inbox/search";\n',
      "apps/web/src/modules/inbox/search.ts": "export type Filter = string;\n",
    });

    expect(checkBoundaries(root).map(({ file, reason }) => ({ file, reason }))).toEqual([
      {
        file: "apps/web/src/modules/reader/detail.tsx",
        reason: "web module reader must not import inbox, which sits above it in the module stack",
      },
    ]);
  });

  test("rejects web modules in one tier that depend on each other in a cycle", async () => {
    const root = await createFixture({
      "apps/web/src/modules/sidebar/nav.tsx":
        'import { Settings } from "@modules/settings/page";\n',
      "apps/web/src/modules/settings/page.tsx": 'import { Nav } from "../sidebar/nav";\n',
    });

    const reasons = checkBoundaries(root)
      .map(({ reason }) => reason)
      .sort();

    // The generic file-level check reports the same loop as well.
    expect(reasons).toEqual([
      "import cycle between 2 files (settings/page.tsx, sidebar/nav.tsx)",
      "web modules settings and sidebar must not depend on each other in a cycle",
      "web modules sidebar and settings must not depend on each other in a cycle",
    ]);
  });

  test("requires every web module that imports or is imported to have a tier", async () => {
    const root = await createFixture({
      "apps/web/src/modules/billing/page.tsx":
        'import { Source } from "@modules/articles/source";\n',
    });
    const [violation] = checkBoundaries(root);

    expect(violation).toMatchObject({
      file: "apps/web/src/modules/billing/page.tsx",
      reason: "web module billing has no place in the module stack; add it to WEB_MODULE_TIERS",
    });
  });

  test("allows one-way web module dependencies", async () => {
    const root = await createFixture({
      "apps/web/src/modules/inbox/page.tsx":
        'import { Detail } from "@modules/reader/detail";\nimport { Source } from "@modules/articles/source";\n',
      "apps/web/src/modules/reader/detail.tsx": 'import { Source } from "../articles/source";\n',
      "apps/web/src/modules/articles/source.tsx": 'import { apiJson } from "@lib/api";\n',
      "apps/web/src/modules/sidebar/nav.tsx":
        'import { Settings } from "@modules/settings/page";\n',
      "apps/web/src/modules/settings/page.tsx": 'import { Page } from "@modules/inbox/page";\n',
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

  test("keeps shared mobile code from importing domain modules", async () => {
    const root = await createFixture({
      "apps/mobile/src/lib/invalid.ts":
        'import { useArticles } from "@modules/inbox/hooks/use-articles";\n',
    });
    const [violation] = checkBoundaries(root);

    expect(violation).toMatchObject({
      file: "apps/mobile/src/lib/invalid.ts",
      reason: "shared mobile code must not import domain modules",
    });
  });

  test("keeps the mobile articles module below other domains", async () => {
    const root = await createFixture({
      "apps/mobile/src/modules/articles/lib/invalid.ts":
        'import { saveRecentArticle } from "../../recents/lib/store";\n',
    });
    const [violation] = checkBoundaries(root);

    expect(violation).toMatchObject({
      file: "apps/mobile/src/modules/articles/lib/invalid.ts",
      reason: "the mobile articles module must not import other domain modules",
    });
  });

  test("allows mobile domains to build on the articles module", async () => {
    const root = await createFixture({
      "apps/mobile/src/modules/inbox/valid.ts":
        'import { articleListQueryKeys } from "@modules/articles/queries/keys";\n',
      "apps/mobile/src/modules/articles/lib/valid.ts":
        'import { prefetchMobileApi } from "@/lib/api";\n',
    });

    expect(checkBoundaries(root)).toEqual([]);
  });
});

describe("check-boundaries: API layers", () => {
  test("rejects a module that imports the app layer, by alias or by relative path", async () => {
    const root = await createFixture({
      "apps/api/src/modules/feeds/routes.ts": 'import { AppLive } from "@app/runtime";\n',
      "apps/api/src/modules/folders/routes.ts": 'import { AppLive } from "../../app/runtime";\n',
      "apps/api/src/app/runtime.ts": "export const AppLive = 1;\n",
    });

    expect(checkBoundaries(root).sort((a, b) => a.file.localeCompare(b.file))).toEqual([
      {
        file: "apps/api/src/modules/feeds/routes.ts",
        specifier: "@app/runtime",
        reason: "api modules must not import app, which sits above it in the layer stack",
      },
      {
        file: "apps/api/src/modules/folders/routes.ts",
        specifier: "../../app/runtime",
        reason: "api modules must not import app, which sits above it in the layer stack",
      },
    ]);
  });

  test("rejects an adapter that imports a module and shared code that imports an adapter", async () => {
    const root = await createFixture({
      "apps/api/src/adapters/queue/service.ts":
        'import { subscribe } from "@modules/feeds/subscription/subscribe";\n',
      "apps/api/src/shared/http/stacks.ts": 'import { Db } from "@adapters/db/service";\n',
    });

    // Directory order is not part of what is being checked.
    const violations = checkBoundaries(root)
      .map(({ file, reason }) => ({ file, reason }))
      .sort((a, b) => a.file.localeCompare(b.file));

    expect(violations).toEqual([
      {
        file: "apps/api/src/adapters/queue/service.ts",
        reason: "api adapters must not import modules, which sits above it in the layer stack",
      },
      {
        file: "apps/api/src/shared/http/stacks.ts",
        reason: "api shared must not import adapters, which sits above it in the layer stack",
      },
    ]);
  });

  test("rejects config that imports an adapter, module or the app", async () => {
    const root = await createFixture({
      "apps/api/src/config/env/service.ts": 'import { Db } from "@adapters/db/service";\n',
    });

    expect(checkBoundaries(root)).toMatchObject([
      { reason: "api config must not import adapters, which sits above it in the layer stack" },
    ]);
  });

  test("allows imports that point down the stack, within a layer, and between config and shared", async () => {
    const root = await createFixture({
      "apps/api/src/index.ts": 'import { app } from "./app/http/app";\n',
      "apps/api/src/app/boot/server.ts":
        'import { feeds } from "@modules/feeds/routes";\nimport { Db } from "@adapters/db/service";\nimport { AppConfig } from "@config/env/service";\nimport { serializeError } from "@shared/errors/serialize";\n',
      "apps/api/src/modules/feeds/routes.ts":
        'import { Db } from "@adapters/db/service";\nimport { NotFound } from "@shared/effect/errors";\nimport { AppConfig } from "@config/env/service";\nimport { op } from "./operations";\n',
      "apps/api/src/modules/feeds/operations.ts": "export const op = 1;\n",
      "apps/api/src/adapters/db/service.ts":
        'import { AppConfig } from "@config/env/service";\nimport { DatabaseError } from "@shared/effect/errors";\nimport { other } from "../logger/service";\n',
      "apps/api/src/adapters/logger/service.ts": "export const other = 1;\n",
      "apps/api/src/config/env/service.ts":
        'import { ConfigError } from "@shared/effect/errors";\n',
      "apps/api/src/shared/http/stacks.ts": 'import { AppConfig } from "@config/env/service";\n',
    });

    expect(checkBoundaries(root)).toEqual([]);
  });

  test("requires a top-level API directory that imports across layers to have a tier", async () => {
    const root = await createFixture({
      "apps/api/src/plugins/cors.ts": 'import { Db } from "@adapters/db/service";\n',
    });

    expect(checkBoundaries(root)).toMatchObject([
      { reason: "api layer plugins has no place in the layer stack; add it to API_LAYER_TIERS" },
    ]);
  });

  test("rejects API modules that depend on each other in a cycle, and allows one-way dependencies", async () => {
    const cyclic = await createFixture({
      "apps/api/src/modules/feeds/refresh.ts": 'import { list } from "@modules/folders/list";\n',
      "apps/api/src/modules/folders/list.ts": 'import { feed } from "../feeds/refresh";\n',
    });

    expect(
      checkBoundaries(cyclic)
        .map(({ reason }) => reason)
        .filter((reason) => reason.startsWith("api modules"))
        .sort(),
    ).toEqual([
      "api modules feeds and folders must not depend on each other in a cycle",
      "api modules folders and feeds must not depend on each other in a cycle",
    ]);

    const oneWay = await createFixture({
      "apps/api/src/modules/inbox/list.ts":
        'import { feed } from "@modules/feeds/refresh/enqueue";\nimport { folder } from "@modules/folders/list";\n',
      "apps/api/src/modules/feeds/refresh/enqueue.ts":
        'import { folder } from "../../folders/list";\n',
      "apps/api/src/modules/folders/list.ts": "export const folder = 1;\n",
    });

    expect(checkBoundaries(oneWay)).toEqual([]);
  });
});

describe("check-boundaries: import cycles", () => {
  test("reports files that import each other, once per cycle, naming the files", async () => {
    const root = await createFixture({
      "packages/ingest/src/services/a.ts": 'import { b } from "./b";\nexport const a = 1;\n',
      "packages/ingest/src/services/b.ts": 'import { c } from "./c";\nexport const b = 1;\n',
      "packages/ingest/src/services/c.ts": 'import { a } from "./a";\nexport const c = 1;\n',
    });

    expect(checkBoundaries(root)).toEqual([
      {
        file: "packages/ingest/src/services/a.ts",
        specifier: "./b",
        reason: "import cycle between 3 files (services/a.ts, services/b.ts, services/c.ts)",
      },
    ]);
  });

  test("sees a cycle through a directory index, a re-export and an alias", async () => {
    const root = await createFixture({
      "apps/api/src/modules/articles/reader/index.ts": 'export * from "./mode";\n',
      "apps/api/src/modules/articles/reader/mode.ts":
        'import { read } from "@modules/articles/reader";\n',
      "apps/web/src/lib/a.ts": 'import { b } from "@lib/b";\n',
      "apps/web/src/lib/b.ts": 'import { a } from "./a";\n',
    });

    const reasons = checkBoundaries(root).map(({ reason }) => reason);

    expect(reasons).toEqual([
      "import cycle between 2 files (reader/index.ts, reader/mode.ts)",
      "import cycle between 2 files (lib/a.ts, lib/b.ts)",
    ]);
  });

  test("ignores imports that are erased or lazy: type-only, inline type-only, dynamic and generated", async () => {
    const root = await createFixture({
      "packages/ingest/src/a.ts": 'import type { B } from "./b";\nexport type A = B;\n',
      "packages/ingest/src/b.ts":
        'import { type A, type Other as O } from "./a";\nexport type B = A;\n',
      "packages/ingest/src/c.ts": 'export const load = () => import("./d");\n',
      "packages/ingest/src/d.ts": 'import { load } from "./c";\n',
      "apps/web/src/routeTree.gen.ts": 'import { router } from "./router";\n',
      "apps/web/src/router.tsx": 'import { tree } from "./routeTree.gen";\n',
    });

    expect(checkBoundaries(root)).toEqual([]);
  });

  test("still counts a mixed import with a runtime binding", async () => {
    const root = await createFixture({
      "packages/ingest/src/a.ts": 'import { value, type B } from "./b";\nexport const a = value;\n',
      "packages/ingest/src/b.ts":
        'import { a } from "./a";\nexport const value = 1;\nexport type B = 1;\n',
    });

    expect(checkBoundaries(root)).toMatchObject([
      { reason: "import cycle between 2 files (src/a.ts, src/b.ts)" },
    ]);
  });

  test("does not count a file that imports itself or packages outside the tree", async () => {
    const root = await createFixture({
      "packages/ingest/src/a.ts":
        'import { x } from "effect";\nimport { y } from "@kyomi/db";\nimport { z } from "./a";\n',
    });

    expect(checkBoundaries(root)).toEqual([]);
  });
});
