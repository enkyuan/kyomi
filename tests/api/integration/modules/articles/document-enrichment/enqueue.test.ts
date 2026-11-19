import { describe, expect, test } from "bun:test";
import { Effect, Layer } from "effect";
import { enqueueDocumentEnrichment } from "@modules/articles/document-enrichment/enqueue";
import { fakeQueue, recordingLogger } from "@api-tests/support/layers";
import { documentWith, figure, IMG, TARGET } from "./helpers";

describe("enqueueDocumentEnrichment", () => {
  function setup(xadd: (...args: unknown[]) => Promise<string>) {
    const logs = recordingLogger();
    const layer = Layer.mergeAll(fakeQueue({ xadd }), logs.layer);
    return {
      logs,
      run: (document: object) =>
        Effect.runPromise(enqueueDocumentEnrichment(TARGET, document).pipe(Effect.provide(layer))),
    };
  }

  test("queues only the jobs with work to do", async () => {
    const added: string[][] = [];
    const { run } = setup(async (...args) => (added.push(args.map(String)), "1-0"));

    await run(documentWith([figure(IMG)]));
    expect(added.map((a) => a[0])).toEqual(["jobs:document-enrichment"]);
    expect(added[0]).toContain("document.image-measure");

    added.length = 0;
    await run(
      documentWith([
        figure(IMG),
        { type: "embed", provider: "x", url: "https://x.com/a/status/1" },
      ]),
    );
    expect(added).toHaveLength(2);

    added.length = 0;
    await run(documentWith([figure(IMG, { width: 1, height: 1, placeholder: "p" })]));
    expect(added).toHaveLength(0);
  });

  test("never fails when the queue is down, and says so in the log", async () => {
    const { run, logs } = setup(() => Promise.reject(new Error("down")));
    await run(documentWith([figure(IMG)]));
    expect(logs.entries).toContainEqual(
      expect.objectContaining({
        level: "warn",
        event: "document_enrichment.enqueue_failed",
        context: expect.objectContaining({ target: TARGET, type: "document.image-measure" }),
      }),
    );
  });

  test("a document the walkers cannot read is logged, not raised", async () => {
    const { run, logs } = setup(async () => "1-0");
    const hostile = new Proxy(
      {},
      {
        get() {
          throw new Error("unreadable");
        },
        ownKeys() {
          throw new Error("unreadable");
        },
      },
    );
    await run(hostile);
    expect(logs.entries).toContainEqual(
      expect.objectContaining({ level: "warn", event: "document_enrichment.enqueue_failed" }),
    );
  });
});
