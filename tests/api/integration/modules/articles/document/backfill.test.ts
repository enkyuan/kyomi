import { afterEach, describe, expect, test } from "bun:test";
import { Effect, Layer } from "effect";
import { setStoredDocumentCompiler } from "@kyomi/ingest/lib/stored-document";
import {
  runDocumentBackfillScope,
  type DocumentBackfillOptions,
  type DocumentBackfillScope,
} from "@modules/articles/document/backfill";
import { fakeDb, fakeQueue, recordingLogger } from "@api-tests/support/layers";
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

function fakePages(pages: Row[][]) {
  const sets: Record<string, unknown>[] = [];
  let page = 0;
  return {
    sets,
    methods: {
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
    },
  };
}

const options = { batchSize: 2, sleepMs: 0, compilerVersion: TEST_COMPILER_VERSION };

/** Runs the backfill against the fake pages; every document the queue is offered is recorded. */
async function backfill(
  fake: ReturnType<typeof fakePages>,
  scope: DocumentBackfillScope,
  overrides: Partial<DocumentBackfillOptions> & { apply: boolean },
) {
  const logs = recordingLogger();
  const xadds: unknown[][] = [];
  const result = await Effect.runPromise(
    runDocumentBackfillScope(scope, { ...options, ...overrides }).pipe(
      Effect.provide(
        Layer.mergeAll(
          fakeDb(fake.methods),
          fakeQueue({ xadd: async (...args: unknown[]) => (xadds.push(args), "1-0") }),
          logs.layer,
        ),
      ),
    ),
  );
  return { result, logs: logs.entries, xadds };
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

describe("runDocumentBackfillScope", () => {
  test("dry run compiles and counts but writes nothing", async () => {
    setStoredDocumentCompiler(fakeCompiler());
    const fake = fakePages([[row("a"), row("b")], [row("c")]]);
    const { result, xadds } = await backfill(fake, "feed-original", { apply: false });
    expect(result).toMatchObject({ scanned: 3, updated: 3, failed: 0, lastId: "c" });
    expect(fake.sets).toHaveLength(0);
    expect(xadds).toHaveLength(0);
  });

  test("apply writes the document trio for every stale row across batches", async () => {
    setStoredDocumentCompiler(fakeCompiler());
    const fake = fakePages([[row("a"), row("b")], [row("c")]]);
    const { result, logs, xadds } = await backfill(fake, "feed-original", { apply: true });
    expect(result.updated).toBe(3);
    expect(fake.sets).toHaveLength(3);
    expect(fake.sets[0]).toMatchObject({
      contentDocumentVersion: 1,
      contentCompilerVersion: TEST_COMPILER_VERSION,
    });
    expect(logs.filter((entry) => entry.event === "document.backfill.batch")).toHaveLength(2);
    // Each rewritten document has an image to measure, so each queues one enrichment job.
    expect(xadds).toHaveLength(3);
  });

  test("skips rows with unsupported sources and counts compiler misses as failures", async () => {
    setStoredDocumentCompiler(fakeCompiler());
    const skipFake = fakePages([[row("a", { source: "link_only" })]]);
    const { result: skipped } = await backfill(skipFake, "feed-original", { apply: true });
    expect(skipped).toMatchObject({ scanned: 1, skipped: 1, updated: 0 });

    setStoredDocumentCompiler(null);
    const failFake = fakePages([[row("a")]]);
    const { result: failed, logs } = await backfill(failFake, "feed-original", { apply: true });
    expect(failed).toMatchObject({ failed: 1, updated: 0 });
    expect(failFake.sets).toHaveLength(0);
    expect(logs).toContainEqual(
      expect.objectContaining({
        level: "warn",
        event: "document.backfill.no_document",
        context: { scope: "feed-original", id: "a" },
      }),
    );
  });

  test("extracted and cache scopes always compile as extracted HTML", async () => {
    setStoredDocumentCompiler(fakeCompiler());
    const fake = fakePages([[row("a", { source: null })]]);
    const { result, xadds } = await backfill(fake, "extraction-cache", { apply: true });
    expect(result.updated).toBe(1);
    expect(fake.sets[0]).toHaveProperty("document");
    // The extraction cache is not served, so it has no enrichment target.
    expect(xadds).toHaveLength(0);
  });
});
