import { beforeEach, describe, expect, test } from "bun:test";
import { crc32, deflateSync } from "node:zlib";
import { DateTime, Effect, Exit, Layer } from "effect";
import type { HttpClient } from "effect/http";
import { TestClock } from "effect/testing";
import { handleDocumentEnrichmentJob } from "@modules/articles/document-enrichment/jobs";
import { runEmbedSnapshotJob } from "@modules/articles/document-enrichment/embed-snapshot";
import { runImageMeasureJob } from "@modules/articles/document-enrichment/image-measure";
import { EnrichmentGates } from "@modules/articles/document-enrichment/limits";
import {
  DocumentPatchStore,
  type DocumentPatchStoreShape,
} from "@modules/articles/document-enrichment/store";
import { DatabaseError } from "@shared/effect/errors";
import { fakeHttpClient, recordingLogger } from "@api-tests/support/layers";
import { documentWith, figure, IMG, TARGET } from "./helpers";
import {
  applyImageMeasurements,
  collectEmbedsToSnapshot,
  collectImagesToMeasure,
} from "@kyomi/ingest/enrichment";

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

const NO_RETRY = { attempts: 1, baseDelayMs: 0 };

function memoryStore(document: object) {
  let state = { document, documentVersion: 1, compilerVersion: "c1" };
  const saves: number[] = [];
  const store: DocumentPatchStoreShape = {
    load: () => Effect.sync(() => structuredClone(state)),
    patch: (_target, expected, fn) =>
      Effect.sync(() => {
        if (expected.documentVersion !== state.documentVersion) return { status: "stale" as const };
        state = {
          ...state,
          document: fn(structuredClone(state.document)),
          documentVersion: state.documentVersion + 1,
        };
        saves.push(state.documentVersion);
        return { status: "patched" as const };
      }),
  };
  return {
    store,
    saves,
    get: () => state,
    bump: () => (state = { ...state, documentVersion: state.documentVersion + 1 }),
  };
}

type Doc = { blocks: { image: Record<string, unknown>; snapshot?: unknown }[] };

let requested: string[] = [];
type Responder = (url: string) => Response | Promise<Response>;
beforeEach(() => {
  requested = [];
});

/** Every service a job needs, with the network answered by `respond` and no real clock or host. */
function jobServices(store: DocumentPatchStoreShape, respond: Responder) {
  return Layer.mergeAll(
    Layer.succeed(DocumentPatchStore, DocumentPatchStore.of(store)),
    EnrichmentGates.layer,
    fakeHttpClient(({ url }) => {
      requested.push(url);
      return respond(url);
    }),
    recordingLogger().layer,
  );
}

const unreachable: Responder = () => {
  throw new Error("unexpected request");
};

const noStore: DocumentPatchStoreShape = {
  load: () => Effect.succeed(null),
  patch: () => Effect.succeed({ status: "missing" }),
};

describe("document walkers", () => {
  test("collect nested images once and never overwrite existing values", () => {
    const doc = documentWith([
      figure(IMG),
      {
        type: "gallery",
        items: [
          { image: { src: IMG, alt: "" } },
          {
            image: {
              src: "https://93.184.216.34/b.png",
              alt: "",
              width: 1,
              height: 1,
              placeholder: "x",
            },
          },
        ],
      },
      { type: "quote", children: [figure("https://93.184.216.34/c.png", { width: 5, height: 5 })] },
    ]);
    expect(collectImagesToMeasure(doc)).toEqual([
      { url: IMG, needsSize: true, needsPlaceholder: true },
      { url: "https://93.184.216.34/c.png", needsSize: false, needsPlaceholder: true },
    ]);
    const applied = applyImageMeasurements(
      doc,
      new Map([["https://93.184.216.34/c.png", { width: 99, height: 99, placeholder: "p" }]]),
    );
    expect(applied.changed).toBe(true);
    expect(JSON.stringify(applied.document)).toContain('"width":5');
    expect(
      applyImageMeasurements(
        applied.document,
        new Map([["https://93.184.216.34/c.png", { width: 99, height: 99, placeholder: "p" }]]),
      ).changed,
    ).toBe(false);
  });

  test("embeds only qualify for supported providers without a snapshot", () => {
    const doc = documentWith([
      { type: "embed", provider: "youtube", url: "https://youtube.com/watch?v=abcdefg" },
      { type: "embed", provider: "bluesky", url: "https://bsky.app/profile/a/post/b" },
      {
        type: "embed",
        provider: "x",
        url: "https://x.com/a/status/1",
        snapshot: { fetchedAt: "t" },
      },
    ]);
    expect(collectEmbedsToSnapshot(doc, new Set(["bluesky", "x"]))).toEqual([
      { provider: "bluesky", url: "https://bsky.app/profile/a/post/b" },
    ]);
  });
});

/** Runs a job Effect against `store`, with the network answered by `respond`. */
function runJob<A, E>(
  job: Effect.Effect<A, E, DocumentPatchStore | EnrichmentGates | HttpClient.HttpClient>,
  store: DocumentPatchStoreShape,
  respond: Responder,
) {
  return Effect.runPromise(job.pipe(Effect.provide(jobServices(store, respond))));
}

const png =
  (width = 8, height = 8): Responder =>
  () =>
    new Response(solidPng(width, height), { headers: { "content-type": "image/png" } });

describe("runImageMeasureJob", () => {
  test("patches dimensions and placeholder, then is a no-op", async () => {
    const mem = memoryStore(documentWith([figure(IMG)]));
    const job = runImageMeasureJob(TARGET, { retry: NO_RETRY });

    const first = await runJob(job, mem.store, png(40, 30));
    expect(first).toMatchObject({ status: "patched", measured: 1 });
    const image = (mem.get().document as Doc).blocks[0].image;
    expect(image).toMatchObject({ width: 40, height: 30 });
    expect(typeof image.placeholder).toBe("string");

    const second = await runJob(job, mem.store, png(40, 30));
    expect(second.status).toBe("unchanged");
    expect(mem.saves).toEqual([2]);
    expect(requested).toHaveLength(1);
  });

  test("reads only the header when a placeholder already exists", async () => {
    let cancelled = false;
    const image = solidPng(64, 48);
    const mem = memoryStore(documentWith([figure(IMG, { placeholder: "abc" })]));
    const result = await runJob(
      runImageMeasureJob(TARGET, { retry: NO_RETRY }),
      mem.store,
      () =>
        new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(image.subarray(0, 40));
            },
            cancel() {
              cancelled = true;
            },
          }),
          { headers: { "content-type": "image/png" } },
        ),
    );
    expect(result.status).toBe("patched");
    expect(cancelled).toBe(true);
    expect((mem.get().document as Doc).blocks[0].image).toMatchObject({
      width: 64,
      height: 48,
      placeholder: "abc",
    });
  });

  test("drops the job when the document was recompiled", async () => {
    const mem = memoryStore(documentWith([figure(IMG)]));
    const racing: DocumentPatchStoreShape = {
      load: mem.store.load,
      patch: (target, expected, fn) => {
        mem.bump();
        return mem.store.patch(target, expected, fn);
      },
    };
    const result = await runJob(
      runImageMeasureJob(TARGET, { retry: NO_RETRY }),
      racing,
      png(10, 10),
    );
    expect(result.status).toBe("stale");
    expect(mem.saves).toEqual([]);
  });

  test("failed probes leave the document untouched", async () => {
    const mem = memoryStore(documentWith([figure(IMG)]));
    const result = await runJob(
      runImageMeasureJob(TARGET, { retry: NO_RETRY }),
      mem.store,
      () => new Response("nope", { status: 404 }),
    );
    expect(result).toMatchObject({ status: "unchanged", measured: 0 });
    expect(mem.saves).toEqual([]);
  });

  test("retries transient failures with backoff", async () => {
    let calls = 0;
    const mem = memoryStore(documentWith([figure(IMG)]));
    const result = await runJob(
      runImageMeasureJob(TARGET, { retry: { attempts: 3, baseDelayMs: 1 } }),
      mem.store,
      (url) => (++calls < 3 ? new Response("busy", { status: 503 }) : png(8, 8)(url)),
    );
    expect(result.status).toBe("patched");
    expect(calls).toBe(3);
  });

  test("gives up after the configured attempts", async () => {
    let calls = 0;
    const mem = memoryStore(documentWith([figure(IMG)]));
    const result = await runJob(
      runImageMeasureJob(TARGET, { retry: { attempts: 3, baseDelayMs: 1 } }),
      mem.store,
      () => (calls++, new Response("busy", { status: 503 })),
    );
    expect(result).toMatchObject({ status: "unchanged", measured: 0 });
    expect(calls).toBe(3);
  });

  test("does not retry a permanent failure", async () => {
    let calls = 0;
    const mem = memoryStore(documentWith([figure(IMG)]));
    await runJob(
      runImageMeasureJob(TARGET, { retry: { attempts: 3, baseDelayMs: 1 } }),
      mem.store,
      () => (calls++, new Response("gone", { status: 404 })),
    );
    expect(calls).toBe(1);
  });

  test("missing documents are reported, not thrown", async () => {
    const result = await runJob(runImageMeasureJob(TARGET), noStore, unreachable);
    expect(result.status).toBe("missing");
  });

  test("keeps at most two requests open against one host", async () => {
    let active = 0;
    let peak = 0;
    const urls = Array.from({ length: 6 }, (_, index) => `https://93.184.216.34/${index}.png`);
    const mem = memoryStore(documentWith(urls.map((url) => figure(url))));
    const result = await runJob(
      runImageMeasureJob(TARGET, { retry: NO_RETRY, concurrency: 6 }),
      mem.store,
      async (url) => {
        active += 1;
        peak = Math.max(peak, active);
        await new Promise((resolve) => setTimeout(resolve, 10));
        active -= 1;
        return png(8, 8)(url);
      },
    );
    expect(result).toMatchObject({ status: "patched", measured: 6 });
    expect(peak).toBe(2);
  });

  test("an interrupted job ends without patching", async () => {
    const mem = memoryStore(documentWith([figure(IMG)]));
    const exit = await Effect.runPromiseExit(
      runImageMeasureJob(TARGET, { retry: NO_RETRY }).pipe(
        Effect.timeout(20),
        Effect.provide(jobServices(mem.store, () => new Promise<Response>(() => undefined))),
      ),
    );
    expect(Exit.isFailure(exit)).toBe(true);
    expect(mem.saves).toEqual([]);
  });
});

describe("runEmbedSnapshotJob", () => {
  const MASTODON = "https://93.184.216.34/@bob/111";
  const status = JSON.stringify({
    created_at: "2026-10-19T08:00:00.000Z",
    content: "<p>hi</p>",
    account: { acct: "bob", display_name: "Bob", url: "https://93.184.216.34/@bob" },
    media_attachments: [],
  });
  const json: Responder = () =>
    new Response(status, { headers: { "content-type": "application/json" } });

  test("writes the snapshot once and is idempotent", async () => {
    const mem = memoryStore(documentWith([{ type: "embed", provider: "mastodon", url: MASTODON }]));
    const job = runEmbedSnapshotJob(TARGET, { retry: NO_RETRY });
    const at = DateTime.toEpochMillis(DateTime.makeUnsafe("2026-10-24T00:00:00.000Z"));

    const first = await Effect.runPromise(
      TestClock.setTime(at).pipe(
        Effect.andThen(job),
        Effect.provide(Layer.mergeAll(jobServices(mem.store, json), TestClock.layer())),
      ),
    );
    expect(first.status).toBe("patched");
    expect((mem.get().document as Doc).blocks[0].snapshot).toMatchObject({
      text: [{ type: "text", value: "hi" }],
      fetchedAt: "2026-10-24T00:00:00.000Z",
    });
    expect(requested).toEqual(["https://93.184.216.34/api/v1/statuses/111"]);
    expect((await runJob(job, mem.store, json)).status).toBe("unchanged");
    expect(requested).toHaveLength(1);
  });

  test("failures leave the embed as-is", async () => {
    const mem = memoryStore(documentWith([{ type: "embed", provider: "mastodon", url: MASTODON }]));
    const result = await runJob(
      runEmbedSnapshotJob(TARGET, { retry: NO_RETRY }),
      mem.store,
      () => new Response("{}", { status: 500 }),
    );
    expect(result).toMatchObject({ status: "unchanged", fetched: 0 });
    expect((mem.get().document as Doc).blocks[0].snapshot).toBeUndefined();
  });

  test("never fetches private-network Mastodon hosts", async () => {
    const mem = memoryStore(
      documentWith([{ type: "embed", provider: "mastodon", url: "https://169.254.169.254/@a/1" }]),
    );
    const result = await runJob(
      runEmbedSnapshotJob(TARGET, { retry: NO_RETRY }),
      mem.store,
      () => new Response(status),
    );
    expect(result.status).toBe("unchanged");
    expect(requested).toEqual([]);
  });
});

describe("handleDocumentEnrichmentJob", () => {
  test("runs the job for its type and logs the outcome", async () => {
    const mem = memoryStore(documentWith([figure(IMG)]));
    const logs = recordingLogger();
    await Effect.runPromise(
      handleDocumentEnrichmentJob({
        type: "document.image-measure",
        payload: { target: TARGET },
      }).pipe(Effect.provide(Layer.mergeAll(jobServices(mem.store, png(8, 8)), logs.layer))),
    );
    expect(mem.saves).toEqual([2]);
    expect(logs.entries).toContainEqual(
      expect.objectContaining({
        level: "info",
        event: "worker.job.document_enrichment.completed",
        context: expect.objectContaining({
          jobType: "document.image-measure",
          target: TARGET,
          status: "patched",
          measured: 1,
        }),
      }),
    );
  });

  test("a failing store fails the job so the queue retries it", async () => {
    const broken: DocumentPatchStoreShape = {
      ...noStore,
      load: () => Effect.fail(new DatabaseError({ operation: "load", cause: new Error("down") })),
    };
    const error = await Effect.runPromise(
      Effect.flip(
        handleDocumentEnrichmentJob({
          type: "document.embed-snapshot",
          payload: { target: TARGET },
        }),
      ).pipe(Effect.provide(jobServices(broken, unreachable))),
    );
    expect(error._tag).toBe("DatabaseError");
  });
});
