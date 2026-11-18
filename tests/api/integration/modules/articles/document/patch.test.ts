import { describe, expect, test } from "bun:test";
import {
  loadStoredDocument,
  patchStoredDocument,
  withoutEnrichmentFields,
} from "@modules/articles/document/patch";
import type { ReaderDocument } from "@kyomi/reader/document";
import { fakeDocument, runWithDb, TEST_COMPILER_VERSION } from "./helpers";

function fakeRow(row: Record<string, unknown> | undefined) {
  const updates: Record<string, unknown>[] = [];
  const tx = {
    select: () => ({
      from: () => ({
        where: () => {
          const limit = () => Promise.resolve(row ? [row] : []);
          return { for: () => ({ limit }), limit };
        },
      }),
    }),
    update: () => ({
      set: (value: Record<string, unknown>) => {
        updates.push(value);
        return { where: () => Promise.resolve() };
      },
    }),
  };
  return {
    updates,
    methods: {
      select: tx.select,
      transaction: (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
    },
  };
}

const target = { table: "feed_items", id: "a1", body: "original" } as const;
const expected = { documentVersion: 1, compilerVersion: TEST_COMPILER_VERSION };
const row = () => ({
  document: fakeDocument(),
  documentVersion: 1,
  compilerVersion: TEST_COMPILER_VERSION,
});

const patch = (
  fake: ReturnType<typeof fakeRow>,
  change: (document: ReaderDocument) => ReaderDocument,
  body: "original" | "extracted" = "original",
) => runWithDb(patchStoredDocument({ ...target, body }, expected, change), fake.methods);

describe("patchStoredDocument", () => {
  test("applies an image dimension and placeholder patch", async () => {
    const fake = fakeRow(row());
    const result = await patch(fake, (doc) => {
      const block = doc.blocks[0];
      if (block?.type === "figure") {
        block.image.width = 800;
        block.image.height = 600;
        block.image.placeholder = "abc";
      }
      return doc;
    });
    expect(result.status).toBe("patched");
    expect(fake.updates).toHaveLength(1);
    expect(fake.updates[0]).toHaveProperty("contentDocument");
  });

  test("targets the extracted column for the extracted body", async () => {
    const fake = fakeRow(row());
    await patch(fake, (d) => d, "extracted");
    expect(fake.updates[0]).toHaveProperty("extractedContentDocument");
  });

  test("returns stale when versions moved on and writes nothing", async () => {
    const fake = fakeRow({ ...row(), compilerVersion: "newer" });
    const result = await patch(fake, (d) => d);
    expect(result.status).toBe("stale");
    expect(fake.updates).toHaveLength(0);
  });

  test("returns missing without a row or document", async () => {
    expect((await patch(fakeRow(undefined), (d) => d)).status).toBe("missing");
    const noDoc = fakeRow({ document: null, documentVersion: null, compilerVersion: null });
    expect((await patch(noDoc, (d) => d)).status).toBe("missing");
  });

  test("rejects patches that change compiler-owned content", async () => {
    const fake = fakeRow(row());
    const result = await patch(fake, (doc) => {
      const block = doc.blocks[0];
      if (block?.type === "figure") block.image.alt = "changed";
      return doc;
    });
    expect(result.status).toBe("invalid");
    expect(fake.updates).toHaveLength(0);
  });

  test("rejects patches that produce an invalid document", async () => {
    const fake = fakeRow(row());
    const result = await patch(fake, () => ({ version: 99 }) as unknown as ReaderDocument);
    expect(result.status).toBe("invalid");
  });

  test("withoutEnrichmentFields drops only image dimensions/placeholder and embed snapshots", () => {
    expect(
      withoutEnrichmentFields({
        type: "embed",
        snapshot: { x: 1 },
        image: { src: "u", alt: "a", width: 1, height: 2, placeholder: "p" },
      }),
    ).toEqual({ type: "embed", image: { src: "u", alt: "a" } });
  });

  test("loadStoredDocument returns the document with versions, or null", async () => {
    const loaded = await runWithDb(loadStoredDocument(target), fakeRow(row()).methods);
    expect(loaded).toMatchObject({ documentVersion: 1, compilerVersion: TEST_COMPILER_VERSION });
    expect(await runWithDb(loadStoredDocument(target), fakeRow(undefined).methods)).toBeNull();
  });
});
