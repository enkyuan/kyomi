import { afterEach, describe, expect, test } from "bun:test";
import { toFeedArticleDetailDto } from "@modules/articles/read/detail";
import { parseSupportedDocumentVersion } from "@modules/articles/document/negotiate";
import { articleDetailSchema } from "@kyomi/reader/schemas/article";
import { applyStoredDocuments, withNegotiatedDocuments } from "@modules/articles/document/serve";
import { fakeDocument, runWithDb, TEST_COMPILER_VERSION } from "./helpers";

function article() {
  return toFeedArticleDetailDto({
    id: "a1",
    title: "Entry",
    link: "https://example.com/post",
    summary: null,
    imageUrl: null,
    content: "<p>Hello</p>",
    contentHtml: "<p>Hello</p>",
    contentSanitizerVersion: null,
    contentText: "Hello",
    contentMarkdown: null,
    contentStatus: "ready",
    contentSource: "feed_html",
    extractionErrorCode: null,
    extractionErrorMessage: null,
    extractedContentHtml: null,
    extractedContentText: null,
    extractedContentStatus: "pending",
    extractedContentError: null,
    extractedContentUpdatedAt: null,
    extractedContentSanitizerVersion: null,
    publishedAt: new Date("2026-01-01T00:00:00Z"),
    feedId: "f1",
    feedUrl: null,
    feedSiteUrl: null,
    feedTitle: "Feed",
    feedFaviconUrl: null,
    isRead: false,
    isSaved: false,
    lastViewedAt: null,
    categories: [],
  });
}

const none = { document: null, documentVersion: null, compilerVersion: null };
const stored = (documentVersion: number) => ({
  document: fakeDocument(),
  documentVersion,
  compilerVersion: TEST_COMPILER_VERSION,
});

afterEach(() => undefined);

describe("parseSupportedDocumentVersion", () => {
  test("reads the header and treats junk or absence as no support", () => {
    expect(parseSupportedDocumentVersion(new Headers({ "x-kyomi-document-version": "2" }))).toBe(2);
    expect(parseSupportedDocumentVersion(new Headers({ "x-kyomi-document-version": "abc" }))).toBe(
      0,
    );
    expect(parseSupportedDocumentVersion(new Headers())).toBe(0);
  });
});

describe("applyStoredDocuments", () => {
  test("serves a document body alongside the HTML body when the client supports the version", () => {
    const result = applyStoredDocuments(article(), { original: stored(1), extracted: none }, 1);
    const selected = result.reader.selected;
    expect(selected.bodyKind).toBe("document");
    if (selected.bodyKind !== "document") throw new Error("expected document");
    expect(selected.documentVersion).toBe(1);
    expect(selected.fallbackBodyKind).toBe("html");
    expect(selected.contentHtml).toContain("Hello");
    expect(result.reader.original.content).toBe(selected);
  });

  test("falls back to the HTML body when the stored document is newer than the client", () => {
    const base = article();
    const result = applyStoredDocuments(base, { original: stored(2), extracted: none }, 1);
    expect(result.reader.selected.bodyKind).toBe("html");
  });

  test("falls back to the HTML body when no document is stored", () => {
    const result = applyStoredDocuments(article(), { original: none, extracted: none }, 5);
    expect(result.reader.selected.bodyKind).toBe("html");
  });
});

describe("document bodies and the shared reader schema", () => {
  test("a served document body parses with the schema every client validates against", () => {
    const result = applyStoredDocuments(article(), { original: stored(1), extracted: none }, 1);
    // Over the wire the detail is JSON, so check what a client would receive.
    const parsed = articleDetailSchema.safeParse(JSON.parse(JSON.stringify(result)));
    expect(parsed.success).toBe(true);
    expect(parsed.data?.reader.selected.bodyKind).toBe("document");
  });
});

describe("withNegotiatedDocuments", () => {
  // `fakeDb()` has no methods, so any read of the stored columns throws: when negotiation is off
  // the database must not be touched.
  const negotiate = (options: { enabled: boolean; maxVersion: number }) => {
    const base = article();
    return runWithDb(withNegotiatedDocuments(base, options), {}).then((result) => ({
      base,
      result,
    }));
  };

  test("returns the article untouched when the feature flag is off", async () => {
    const { base, result } = await negotiate({ enabled: false, maxVersion: 1 });
    expect(result).toBe(base);
  });

  test("returns the article untouched when the client did not declare support", async () => {
    const { base, result } = await negotiate({ enabled: true, maxVersion: 0 });
    expect(result).toBe(base);
  });

  test("swaps in the stored document when negotiation is on", async () => {
    const select = () => ({
      from: () => ({
        where: () => ({
          limit: async () => [
            {
              document: fakeDocument(),
              documentVersion: 1,
              compilerVersion: TEST_COMPILER_VERSION,
              extractedDocument: null,
              extractedDocumentVersion: null,
              extractedCompilerVersion: null,
            },
          ],
        }),
      }),
    });
    const result = await runWithDb(
      withNegotiatedDocuments(article(), { enabled: true, maxVersion: 1 }),
      { select },
    );
    expect(result.reader.selected.bodyKind).toBe("document");
  });
});
