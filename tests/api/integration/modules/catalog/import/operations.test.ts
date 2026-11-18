import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect, Layer } from "effect";
import { FeedSearch, type FeedSearchShape } from "@adapters/search/service";
import { parseCatalogImportArgs } from "@modules/catalog/import/cli";
import { importCatalogFile } from "@modules/catalog/import/operations";
import { UpstreamError } from "@shared/effect/errors";
import { fakeDb, recordingLogger } from "@api-tests/support/layers";
import { recordingDb } from "../fakes";

const directory = mkdtempSync(join(tmpdir(), "kyomi-catalog-import-"));
afterAll(() => rmSync(directory, { recursive: true, force: true }));

let fileCount = 0;
function catalogFile(lines: string[]): string {
  fileCount += 1;
  const path = join(directory, `catalog-${fileCount}.jsonl`);
  writeFileSync(path, lines.join("\n"));
  return path;
}

const record = (slug: string, overrides: Record<string, unknown> = {}) =>
  JSON.stringify({
    feed_url: `https://${slug}.example.com/rss`,
    title: slug,
    link: `https://${slug}.example.com`,
    language: "en",
    category: "SaaS",
    ...overrides,
  });

function fakeSearch(overrides: Partial<FeedSearchShape> = {}) {
  const upserted: (readonly unknown[])[] = [];
  const layer = Layer.succeed(
    FeedSearch,
    FeedSearch.of({
      isConfigured: () => true,
      search: () => Effect.succeed([]),
      upsert: (documents) => {
        upserted.push(documents);
        return Effect.void;
      },
      remove: () => Effect.void,
      ...overrides,
    }),
  );
  return { upserted, layer };
}

describe("importCatalogFile", () => {
  test("a dry run counts records, duplicates and validation gaps without touching anything", async () => {
    const path = catalogFile([
      record("alpha"),
      "",
      record("alpha"),
      "{ not json",
      JSON.stringify({ title: "no url" }),
      record("beta", { language: null, category: null, title: null, link: null }),
    ]);
    const db = recordingDb();
    const search = fakeSearch();

    const result = await Effect.runPromise(
      importCatalogFile(path, true).pipe(
        Effect.provide(Layer.mergeAll(db.layer, search.layer, recordingLogger().layer)),
      ),
    );

    expect(result.stats).toEqual({
      processed: 5,
      imported: 2,
      skipped: 2,
      failed: 1,
      categoryAssignments: 1,
      languageAssignments: 1,
    });
    expect(result.duplicateCanonicalUrls).toBe(1);
    expect(result.validation).toEqual({
      missingTitle: 1,
      missingSiteUrl: 1,
      missingLanguage: 1,
      missingCategory: 1,
    });
    expect(db.calls).toEqual([]);
    expect(search.upserted).toEqual([]);
  });

  test("upserts feeds, canonical category assignments and search documents per batch", async () => {
    const path = catalogFile([
      record("alpha"),
      record("beta", { category: "Feedspot Curated List #42" }),
    ]);
    const db = recordingDb();
    const search = fakeSearch();

    const result = await Effect.runPromise(
      importCatalogFile(path, false, { batchSize: 10 }).pipe(
        Effect.provide(Layer.mergeAll(db.layer, search.layer, recordingLogger().layer)),
      ),
    );

    expect(result.stats).toMatchObject({
      imported: 2,
      failed: 0,
      categoryAssignments: 1,
      languageAssignments: 2,
    });
    expect(db.inserted("feeds")).toHaveLength(2);
    expect(db.inserted("categories")).toMatchObject([
      { label: "Business & Startups", provenance: "catalog" },
    ]);
    expect(db.inserted("feed_category_assignments")).toMatchObject([{ provenance: "catalog" }]);
    expect(search.upserted).toHaveLength(1);
    expect(search.upserted[0]).toMatchObject([
      { domain: "alpha.example.com", categories: ["business-startups"] },
      { domain: "beta.example.com", categories: [] },
    ]);
  });

  test("flushes a batch each time --batch-size records are pending", async () => {
    const path = catalogFile([record("a"), record("b"), record("c")]);
    const db = recordingDb();

    await Effect.runPromise(
      importCatalogFile(path, false, { batchSize: 2 }).pipe(
        Effect.provide(Layer.mergeAll(db.layer, fakeSearch().layer, recordingLogger().layer)),
      ),
    );

    expect(db.count("insert", "feeds")).toBe(2);
  });

  test("a failing search index is logged and does not fail the batch", async () => {
    const path = catalogFile([record("alpha")]);
    const logger = recordingLogger();
    const search = fakeSearch({
      upsert: () => Effect.fail(new UpstreamError({ operation: "meili", cause: new Error("503") })),
    });

    const result = await Effect.runPromise(
      importCatalogFile(path, false).pipe(
        Effect.provide(Layer.mergeAll(recordingDb().layer, search.layer, logger.layer)),
      ),
    );

    expect(result.stats.imported).toBe(1);
    expect(logger.entries).toMatchObject([
      { level: "warn", event: "catalog.import.search_index_failed", context: { documents: 1 } },
    ]);
  });

  test("a failing database batch is logged and counted failed, and the run continues", async () => {
    const path = catalogFile([record("a"), record("b"), record("c")]);
    const logger = recordingLogger();
    let attempts = 0;
    const db = fakeDb({
      insert: () => {
        attempts += 1;
        throw new Error("connection reset");
      },
    });

    const result = await Effect.runPromise(
      importCatalogFile(path, false, { batchSize: 2 }).pipe(
        Effect.provide(Layer.mergeAll(db, fakeSearch().layer, logger.layer)),
      ),
    );

    expect(attempts).toBe(2);
    expect(result.stats).toMatchObject({ processed: 3, imported: 0, failed: 3 });
    expect(logger.entries.map((entry) => entry.event)).toEqual([
      "catalog.import.batch_failed",
      "catalog.import.batch_failed",
    ]);
  });

  test("an unreadable input file is a typed CatalogFileError", async () => {
    const error = await Effect.runPromise(
      Effect.flip(importCatalogFile(join(directory, "missing.jsonl"), true)).pipe(
        Effect.provide(
          Layer.mergeAll(recordingDb().layer, fakeSearch().layer, recordingLogger().layer),
        ),
      ),
    );

    expect(error._tag).toBe("CatalogFileError");
    expect(error.path).toContain("missing.jsonl");
  });
});

describe("parseCatalogImportArgs", () => {
  const parse = (...flags: string[]) =>
    Effect.runPromise(Effect.result(parseCatalogImportArgs(["bun", "import", ...flags])));

  test("requires --input and defaults the batch size", async () => {
    expect(await parse("--input", "feeds.jsonl", "--dry-run")).toMatchObject({
      success: { input: "feeds.jsonl", dryRun: true, batchSize: 1000 },
    });
    expect(await parse()).toMatchObject({
      failure: { _tag: "InvalidArguments", message: "Missing required --input <jsonl-path>" },
    });
  });

  test("rejects a malformed --batch-size", async () => {
    expect(await parse("--input", "feeds.jsonl", "--batch-size", "0")).toMatchObject({
      failure: { message: "Invalid --batch-size value: 0" },
    });
  });
});
