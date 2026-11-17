import { Effect } from "effect";
import type { ReaderDocument } from "@kyomi/reader/document";
import type { StoredDocument, StoredDocumentCompiler } from "@kyomi/ingest/lib/stored-document";
import type { Db } from "@adapters/db/service";
import { fakeDb } from "@api-tests/support/layers";

export const TEST_COMPILER_VERSION = "test-compiler-1";

/** Minimal valid KDM document with one image and one embed, the fields enrichment owns. */
export function fakeDocument(imageSrc = "https://example.com/a.png"): ReaderDocument {
  return {
    version: 1,
    source: { format: "html", origin: "feed_html", baseUrl: "https://example.com/post" },
    compiler: { version: TEST_COMPILER_VERSION, sanitizerVersion: "test" },
    meta: {
      title: "Entry",
      subtitle: null,
      authors: [],
      siteName: null,
      language: "en",
      direction: "ltr",
      publishedAt: null,
      updatedAt: null,
      wordCount: 1,
      readingMinutes: 1,
      leadImage: null,
    },
    features: { math: false, codeLanguages: [], embedProviders: [] },
    blocks: [
      {
        type: "figure",
        placement: "content",
        image: { src: imageSrc, alt: "A" },
      },
    ],
    footnotes: [],
    diagnostics: { droppedElements: {}, htmlBlocks: 0, warnings: [] },
  };
}

export function fakeCompiler(version = TEST_COMPILER_VERSION): StoredDocumentCompiler {
  return {
    version,
    compile: async (): Promise<StoredDocument> => ({
      document: fakeDocument(),
      documentVersion: 1,
      compilerVersion: version,
    }),
  };
}

/** Runs an operation that needs only `Db` against a fake Drizzle client. */
export function runWithDb<A, E>(
  effect: Effect.Effect<A, E, Db>,
  methods: Parameters<typeof fakeDb>[0],
): Promise<A> {
  return Effect.runPromise(effect.pipe(Effect.provide(fakeDb(methods))));
}
