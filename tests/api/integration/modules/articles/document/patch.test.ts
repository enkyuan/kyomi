import { describe, expect, test } from "bun:test";
import { patchStoredDocument, withoutEnrichmentFields } from "@modules/articles/document/patch";
import type { ReaderDocument } from "@kyomi/reader/document";
import { fakeDocument, TEST_COMPILER_VERSION } from "./helpers";

function fakeDb(row: Record<string, unknown> | undefined) {
  const updates: Record<string, unknown>[] = [];
  const tx = {
    select: () => ({
      from: () => ({
        where: () => ({ for: () => ({ limit: () => Promise.resolve(row ? [row] : []) }) }),
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
    db: { transaction: (fn: (t: typeof tx) => Promise<unknown>) => fn(tx) } as never,
  };
}

const target = { table: "feed_items", id: "a1", body: "original" } as const;
const expected = { documentVersion: 1, compilerVersion: TEST_COMPILER_VERSION };
const row = () => ({
  document: fakeDocument(),
  documentVersion: 1,
  compilerVersion: TEST_COMPILER_VERSION,
});

describe("patchStoredDocument", () => {
  test("applies an image dimension and placeholder patch", async () => {
    const fake = fakeDb(row());
    const result = await patchStoredDocument(fake.db, target, expected, (doc) => {
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
    const fake = fakeDb(row());
    await patchStoredDocument(fake.db, { ...target, body: "extracted" }, expected, (d) => d);
    expect(fake.updates[0]).toHaveProperty("extractedContentDocument");
  });

  test("returns stale when versions moved on and writes nothing", async () => {
    const fake = fakeDb({ ...row(), compilerVersion: "newer" });
    const result = await patchStoredDocument(fake.db, target, expected, (d) => d);
    expect(result.status).toBe("stale");
    expect(fake.updates).toHaveLength(0);
  });

  test("returns missing without a row or document", async () => {
    expect(
      (await patchStoredDocument(fakeDb(undefined).db, target, expected, (d) => d)).status,
    ).toBe("missing");
    const noDoc = fakeDb({ document: null, documentVersion: null, compilerVersion: null });
    expect((await patchStoredDocument(noDoc.db, target, expected, (d) => d)).status).toBe(
      "missing",
    );
  });

  test("rejects patches that change compiler-owned content", async () => {
    const fake = fakeDb(row());
    const result = await patchStoredDocument(fake.db, target, expected, (doc) => {
      const block = doc.blocks[0];
      if (block?.type === "figure") block.image.alt = "changed";
      return doc;
    });
    expect(result.status).toBe("invalid");
    expect(fake.updates).toHaveLength(0);
  });

  test("rejects patches that produce an invalid document", async () => {
    const fake = fakeDb(row());
    const result = await patchStoredDocument(
      fake.db,
      target,
      expected,
      () => ({ version: 99 }) as unknown as ReaderDocument,
    );
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
});
