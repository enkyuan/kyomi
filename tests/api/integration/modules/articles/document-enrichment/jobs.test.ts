import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { crc32, deflateSync } from "node:zlib";
import { unwiredDocumentPatchStore } from "@modules/articles/document-enrichment/jobs";
import { enqueueDocumentEnrichment } from "@modules/articles/document-enrichment/enqueue";
import { fetchBounded } from "@modules/articles/document-enrichment/fetch";
import { runEmbedSnapshotJob } from "@modules/articles/document-enrichment/embed-snapshot";
import { runImageMeasureJob } from "@modules/articles/document-enrichment/image-measure";
import type { DocumentTarget } from "@kyomi/worker";
import type { DocumentPatchStore } from "@modules/articles/document-enrichment/store";
import {
  applyImageMeasurements,
  collectEmbedsToSnapshot,
  collectImagesToMeasure,
} from "@kyomi/worker/enrichment";

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

// Literal public IPs keep the SSRF check off the network (no DNS lookup).
const IMG = "https://93.184.216.34/a.png";
const NO_RETRY = { attempts: 1, baseDelayMs: 0 };

function documentWith(blocks: unknown[]) {
  return { version: 1, blocks, footnotes: [], meta: { leadImage: null } };
}
const figure = (src: string, extra: object = {}) => ({
  type: "figure",
  image: { src, alt: "", ...extra },
});

const TARGET: DocumentTarget = { table: "feed_items", id: "a1", body: "original" };

function memoryStore(document: object) {
  let state = { document, documentVersion: 1, compilerVersion: "c1" };
  const saves: number[] = [];
  const store: DocumentPatchStore = {
    async load() {
      return structuredClone(state);
    },
    async patch(_target, expected, fn) {
      if (expected.documentVersion !== state.documentVersion) return { status: "stale" };
      state = {
        ...state,
        document: fn(structuredClone(state.document)),
        documentVersion: state.documentVersion + 1,
      };
      saves.push(state.documentVersion);
      return { status: "patched" };
    },
  };
  return {
    store,
    saves,
    get: () => state,
    bump: () => (state = { ...state, documentVersion: state.documentVersion + 1 }),
  };
}

type Doc = { blocks: { image: Record<string, unknown>; snapshot?: unknown }[] };

const realFetch = globalThis.fetch;
let requested: string[] = [];
function stubFetch(handler: (url: string) => Response | Promise<Response>) {
  globalThis.fetch = (async (input: Request | string | URL) => {
    const url = String(input instanceof Request ? input.url : input);
    requested.push(url);
    return handler(url);
  }) as typeof fetch;
}
beforeEach(() => {
  requested = [];
});
afterEach(() => {
  globalThis.fetch = realFetch;
});

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

describe("runImageMeasureJob", () => {
  test("patches dimensions and placeholder, then is a no-op", async () => {
    const png = solidPng(40, 30);
    stubFetch(() => new Response(png, { headers: { "content-type": "image/png" } }));
    const mem = memoryStore(documentWith([figure(IMG)]));

    const first = await runImageMeasureJob(TARGET, { store: mem.store, retry: NO_RETRY });
    expect(first).toMatchObject({ status: "patched", measured: 1 });
    const image = (mem.get().document as Doc).blocks[0].image;
    expect(image).toMatchObject({ width: 40, height: 30 });
    expect(typeof image.placeholder).toBe("string");

    const second = await runImageMeasureJob(TARGET, { store: mem.store, retry: NO_RETRY });
    expect(second.status).toBe("unchanged");
    expect(mem.saves).toEqual([2]);
    expect(requested).toHaveLength(1);
  });

  test("reads only the header when a placeholder already exists", async () => {
    let cancelled = false;
    const png = solidPng(64, 48);
    stubFetch(
      () =>
        new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(png.subarray(0, 40));
            },
            cancel() {
              cancelled = true;
            },
          }),
          { headers: { "content-type": "image/png" } },
        ),
    );
    const mem = memoryStore(documentWith([figure(IMG, { placeholder: "abc" })]));
    const result = await runImageMeasureJob(TARGET, { store: mem.store, retry: NO_RETRY });
    expect(result.status).toBe("patched");
    expect(cancelled).toBe(true);
    expect((mem.get().document as Doc).blocks[0].image).toMatchObject({
      width: 64,
      height: 48,
      placeholder: "abc",
    });
  });

  test("drops the job when the document was recompiled", async () => {
    stubFetch(() => new Response(solidPng(10, 10), { headers: { "content-type": "image/png" } }));
    const mem = memoryStore(documentWith([figure(IMG)]));
    const racing: DocumentPatchStore = {
      load: mem.store.load,
      async patch(target, expected, fn) {
        mem.bump();
        return mem.store.patch(target, expected, fn);
      },
    };
    const result = await runImageMeasureJob(TARGET, { store: racing, retry: NO_RETRY });
    expect(result.status).toBe("stale");
    expect(mem.saves).toEqual([]);
  });

  test("failed probes leave the document untouched", async () => {
    stubFetch(() => new Response("nope", { status: 404 }));
    const mem = memoryStore(documentWith([figure(IMG)]));
    const result = await runImageMeasureJob(TARGET, { store: mem.store, retry: NO_RETRY });
    expect(result).toMatchObject({ status: "unchanged", measured: 0 });
    expect(mem.saves).toEqual([]);
  });

  test("retries transient failures with backoff", async () => {
    let calls = 0;
    stubFetch(() =>
      ++calls < 3
        ? new Response("busy", { status: 503 })
        : new Response(solidPng(8, 8), { headers: { "content-type": "image/png" } }),
    );
    const mem = memoryStore(documentWith([figure(IMG)]));
    const result = await runImageMeasureJob(TARGET, {
      store: mem.store,
      retry: { attempts: 3, baseDelayMs: 1 },
    });
    expect(result.status).toBe("patched");
    expect(calls).toBe(3);
  });

  test("missing documents are reported, not thrown", async () => {
    const store: DocumentPatchStore = {
      load: async () => null,
      patch: async () => ({ status: "missing" }),
    };
    expect((await runImageMeasureJob(TARGET, { store })).status).toBe("missing");
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

  test("writes the snapshot once and is idempotent", async () => {
    stubFetch(() => new Response(status, { headers: { "content-type": "application/json" } }));
    const mem = memoryStore(documentWith([{ type: "embed", provider: "mastodon", url: MASTODON }]));
    const now = () => new Date("2026-10-24T00:00:00.000Z");
    const first = await runEmbedSnapshotJob(TARGET, { store: mem.store, retry: NO_RETRY, now });
    expect(first.status).toBe("patched");
    expect((mem.get().document as Doc).blocks[0].snapshot).toMatchObject({
      text: [{ type: "text", value: "hi" }],
      fetchedAt: "2026-10-24T00:00:00.000Z",
    });
    expect(requested).toEqual(["https://93.184.216.34/api/v1/statuses/111"]);
    expect((await runEmbedSnapshotJob(TARGET, { store: mem.store, retry: NO_RETRY })).status).toBe(
      "unchanged",
    );
    expect(requested).toHaveLength(1);
  });

  test("failures leave the embed as-is", async () => {
    stubFetch(() => new Response("{}", { status: 500 }));
    const mem = memoryStore(documentWith([{ type: "embed", provider: "mastodon", url: MASTODON }]));
    const result = await runEmbedSnapshotJob(TARGET, { store: mem.store, retry: NO_RETRY });
    expect(result).toMatchObject({ status: "unchanged", fetched: 0 });
    expect((mem.get().document as Doc).blocks[0].snapshot).toBeUndefined();
  });

  test("never fetches private-network Mastodon hosts", async () => {
    stubFetch(() => new Response(status));
    const mem = memoryStore(
      documentWith([{ type: "embed", provider: "mastodon", url: "https://169.254.169.254/@a/1" }]),
    );
    const result = await runEmbedSnapshotJob(TARGET, { store: mem.store, retry: NO_RETRY });
    expect(result.status).toBe("unchanged");
    expect(requested).toEqual([]);
  });
});

describe("fetchBounded SSRF policy", () => {
  const opts = { accept: "*/*", timeoutMs: 1000, maxBytes: 1024 };

  test.each([
    "http://127.0.0.1/x",
    "http://localhost/x",
    "http://169.254.169.254/latest/meta-data",
    "http://10.0.0.5/x",
    "http://[::1]/x",
    "file:///etc/passwd",
  ])("rejects %s without fetching", async (url) => {
    stubFetch(() => new Response("secret"));
    const result = await fetchBounded(url, opts);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.retryable).toBe(false);
    expect(requested).toEqual([]);
  });

  test("rejects a redirect into a private address", async () => {
    stubFetch(
      () => new Response(null, { status: 302, headers: { location: "http://127.0.0.1/admin" } }),
    );
    const result = await fetchBounded("https://93.184.216.34/start", opts);
    expect(result).toMatchObject({ ok: false, reason: "blocked_url", retryable: false });
    expect(requested).toEqual(["https://93.184.216.34/start"]);
  });

  test("enforces the byte limit", async () => {
    stubFetch(() => new Response(new Uint8Array(4096)));
    expect(await fetchBounded("https://93.184.216.34/big", opts)).toMatchObject({
      ok: false,
      reason: "too_large",
    });
  });
});

describe("enqueueDocumentEnrichment", () => {
  function fakeRedis() {
    const added: string[][] = [];
    const redis = {
      xadd: async (...args: (string | number)[]) => {
        added.push(args.map(String));
        return "1-0";
      },
    };
    return { redis: redis as never, added };
  }

  test("queues only the jobs with work to do", async () => {
    const { redis, added } = fakeRedis();
    await enqueueDocumentEnrichment(TARGET, documentWith([figure(IMG)]), redis);
    expect(added.map((a) => a[0])).toEqual(["jobs:document-enrichment"]);
    expect(added[0]).toContain("document.image-measure");

    const both = fakeRedis();
    await enqueueDocumentEnrichment(
      TARGET,
      documentWith([
        figure(IMG),
        { type: "embed", provider: "x", url: "https://x.com/a/status/1" },
      ]),
      both.redis,
    );
    expect(both.added).toHaveLength(2);

    const none = fakeRedis();
    await enqueueDocumentEnrichment(
      TARGET,
      documentWith([figure(IMG, { width: 1, height: 1, placeholder: "p" })]),
      none.redis,
    );
    expect(none.added).toHaveLength(0);
  });

  test("never throws when the queue is down", async () => {
    const redis = { xadd: async () => Promise.reject(new Error("down")) } as never;
    await enqueueDocumentEnrichment(TARGET, documentWith([figure(IMG)]), redis);
  });
});

describe("unwiredDocumentPatchStore", () => {
  test("fails loudly so a missed wiring surfaces as a failed job", async () => {
    await expect(runImageMeasureJob(TARGET, { store: unwiredDocumentPatchStore })).rejects.toThrow(
      "not wired",
    );
    await expect(runEmbedSnapshotJob(TARGET, { store: unwiredDocumentPatchStore })).rejects.toThrow(
      "not wired",
    );
  });
});
