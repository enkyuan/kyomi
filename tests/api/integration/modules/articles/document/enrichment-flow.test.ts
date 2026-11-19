import { afterEach, describe, expect, test } from "bun:test";
import { crc32, deflateSync } from "node:zlib";
import { Effect, Layer } from "effect";
import { handleDocumentEnrichmentJob } from "@modules/articles/document-enrichment/jobs";
import { EnrichmentGates } from "@modules/articles/document-enrichment/limits";
import { runDocumentBackfillScope } from "@modules/articles/document/backfill";
import { DocumentPatchStoreLive } from "@modules/articles/document/store";
import { setStoredDocumentCompiler } from "@kyomi/ingest/lib/stored-document";
import { fakeDb, fakeHttpClient, fakeQueue, recordingLogger } from "@api-tests/support/layers";
import { fakeDocument, TEST_COMPILER_VERSION } from "./helpers";

const be32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];

function solidPng(width: number, height: number): Uint8Array<ArrayBuffer> {
  const chunk = (type: string, data: Buffer) => {
    const body = Buffer.concat([Buffer.from(type), data]);
    return Buffer.concat([Buffer.from(be32(data.length)), body, Buffer.from(be32(crc32(body)))]);
  };
  const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array(width * 3).fill(90))]);
  return new Uint8Array(
    Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk("IHDR", Buffer.from([...be32(width), ...be32(height), 8, 2, 0, 0, 0])),
      chunk("IDAT", deflateSync(Buffer.concat(Array(height).fill(row)))),
      chunk("IEND", Buffer.alloc(0)),
    ]),
  );
}

// A literal public IP keeps the SSRF check off the network.
const IMG = "https://93.184.216.34/a.png";

afterEach(() => setStoredDocumentCompiler(null));

/** One-row stand-in for feed_items: select/for/limit read it, update.set writes it. */
function rowDb() {
  const state: { document: unknown; documentVersion: number; compilerVersion: string } = {
    document: fakeDocument(IMG),
    documentVersion: 1,
    compilerVersion: TEST_COMPILER_VERSION,
  };
  const chain = () => {
    const limit = () => Promise.resolve([state]);
    return { for: () => ({ limit }), limit };
  };
  const tx = {
    select: () => ({ from: () => ({ where: chain }) }),
    update: () => ({
      set: (value: { contentDocument?: unknown }) => {
        state.document = value.contentDocument;
        return { where: () => Promise.resolve() };
      },
    }),
  };
  return { state, methods: { ...tx, transaction: (fn: (t: typeof tx) => unknown) => fn(tx) } };
}

describe("document persistence to enrichment", () => {
  test("a persisted document is enqueued, then patched by image-measure through the real store", async () => {
    const row = rowDb();
    const target = { table: "feed_items", id: "a1", body: "original" } as const;
    const xadds: unknown[][] = [];
    setStoredDocumentCompiler({
      version: TEST_COMPILER_VERSION,
      compile: async () => ({
        document: fakeDocument(IMG),
        documentVersion: 1,
        compilerVersion: TEST_COMPILER_VERSION,
      }),
    });

    // Backfill recompiles the row and queues enrichment for the document it wrote.
    const backfillRows = [
      {
        id: "a1",
        raw: "<p>x</p>",
        source: "feed_html",
        baseUrl: "https://example.com/",
        title: "T",
        compilerVersion: null,
      },
    ];
    const backfillDb = {
      select: () => ({
        from: () => ({
          where: () => ({
            orderBy: () => ({
              limit: () =>
                Promise.resolve(
                  xadds.length === 0 && backfillRows.length ? backfillRows.splice(0) : [],
                ),
            }),
          }),
        }),
      }),
      update: () => ({ set: () => ({ where: () => Promise.resolve() }) }),
    };
    const result = await Effect.runPromise(
      runDocumentBackfillScope("feed-original", {
        apply: true,
        batchSize: 10,
        sleepMs: 0,
        compilerVersion: TEST_COMPILER_VERSION,
      }).pipe(
        Effect.provide(
          Layer.mergeAll(
            fakeDb(backfillDb),
            fakeQueue({ xadd: async (...args: unknown[]) => (xadds.push(args), "1-0") }),
            recordingLogger().layer,
          ),
        ),
      ),
    );
    expect(result.updated).toBe(1);
    expect(xadds).toHaveLength(1);
    expect(xadds[0]?.some((arg) => arg === "document.image-measure")).toBe(true);

    // The worker then runs the queued job against the stored row, with the image served by a fake.
    const jobLayer = Layer.mergeAll(
      DocumentPatchStoreLive.pipe(Layer.provide(fakeDb(row.methods))),
      EnrichmentGates.layer,
      fakeHttpClient(
        () => new Response(solidPng(40, 30), { headers: { "content-type": "image/png" } }),
      ),
      recordingLogger().layer,
    );
    await Effect.runPromise(
      handleDocumentEnrichmentJob({ type: "document.image-measure", payload: { target } }).pipe(
        Effect.provide(jobLayer),
      ),
    );

    const patched = row.state.document as { blocks: { image: Record<string, unknown> }[] };
    expect(patched.blocks[0]?.image).toMatchObject({ src: IMG, width: 40, height: 30 });
    expect(typeof patched.blocks[0]?.image.placeholder).toBe("string");
  });
});
