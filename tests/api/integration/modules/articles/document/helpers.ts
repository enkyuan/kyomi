import type { ReaderDocument } from "@kyomi/reader/document";
import type { StoredDocument, StoredDocumentCompiler } from "@kyomi/worker/lib/stored-document";

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
