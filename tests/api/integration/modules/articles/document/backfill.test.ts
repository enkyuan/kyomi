import { afterEach, describe, expect, test } from "bun:test";
import { setStoredDocumentCompiler } from "@kyomi/worker/lib/stored-document";
import { runDocumentBackfillScope } from "@modules/articles/document/backfill";
import { fakeCompiler, TEST_COMPILER_VERSION } from "./helpers";

afterEach(() => setStoredDocumentCompiler(null));

type Row = {
  id: string;
  raw: string | null;
  source: string | null;
  baseUrl: string;
  title: string;
  compilerVersion: string | null;
};

function fakeDb(pages: Row[][]) {
  const sets: Record<string, unknown>[] = [];
  let page = 0;
  return {
    sets,
    db: {
      select: () => ({
        from: () => ({
          where: () => ({
            orderBy: () => ({ limit: () => Promise.resolve(pages[page++] ?? []) }),
          }),
        }),
      }),
      update: () => ({
        set: (value: Record<string, unknown>) => {
          sets.push(value);
          return { where: () => Promise.resolve() };
        },
      }),
    } as never,
  };
}

const row = (id: string, over: Partial<Row> = {}): Row => ({
  id,
  raw: "<p>x</p>",
  source: "feed_html",
  baseUrl: "https://example.com/",
  title: "T",
  compilerVersion: null,
  ...over,
});

const options = { batchSize: 2, sleepMs: 0, compilerVersion: TEST_COMPILER_VERSION };

describe("runDocumentBackfillScope", () => {
  test("dry run compiles and counts but writes nothing", async () => {
    setStoredDocumentCompiler(fakeCompiler());
    const fake = fakeDb([[row("a"), row("b")], [row("c")]]);
    const result = await runDocumentBackfillScope(fake.db, "feed-original", {
      ...options,
      apply: false,
    });
    expect(result).toMatchObject({ scanned: 3, updated: 3, failed: 0, lastId: "c" });
    expect(fake.sets).toHaveLength(0);
  });

  test("apply writes the document trio for every stale row across batches", async () => {
    setStoredDocumentCompiler(fakeCompiler());
    const fake = fakeDb([[row("a"), row("b")], [row("c")]]);
    const logs: string[] = [];
    const result = await runDocumentBackfillScope(fake.db, "feed-original", {
      ...options,
      apply: true,
      log: (m) => logs.push(m),
    });
    expect(result.updated).toBe(3);
    expect(fake.sets).toHaveLength(3);
    expect(fake.sets[0]).toMatchObject({
      contentDocumentVersion: 1,
      contentCompilerVersion: TEST_COMPILER_VERSION,
    });
    expect(logs.length).toBeGreaterThanOrEqual(2);
  });

  test("skips rows with unsupported sources and counts compiler misses as failures", async () => {
    setStoredDocumentCompiler(fakeCompiler());
    const skipFake = fakeDb([[row("a", { source: "link_only" })]]);
    const skipped = await runDocumentBackfillScope(skipFake.db, "feed-original", {
      ...options,
      apply: true,
    });
    expect(skipped).toMatchObject({ scanned: 1, skipped: 1, updated: 0 });

    setStoredDocumentCompiler(null);
    const failFake = fakeDb([[row("a")]]);
    const failed = await runDocumentBackfillScope(failFake.db, "feed-original", {
      ...options,
      apply: true,
    });
    expect(failed).toMatchObject({ failed: 1, updated: 0 });
    expect(failFake.sets).toHaveLength(0);
  });

  test("extracted and cache scopes always compile as extracted HTML", async () => {
    setStoredDocumentCompiler(fakeCompiler());
    const fake = fakeDb([[row("a", { source: null })]]);
    const result = await runDocumentBackfillScope(fake.db, "extraction-cache", {
      ...options,
      apply: true,
    });
    expect(result.updated).toBe(1);
    expect(fake.sets[0]).toHaveProperty("document");
  });
});
