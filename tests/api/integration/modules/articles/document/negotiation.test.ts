import { afterEach, describe, expect, test } from "bun:test";
import { toFeedArticleDetailDtoForTest } from "@modules/articles/read/detail";
import { parseSupportedDocumentVersion } from "@modules/articles/document/negotiate";
import { applyStoredDocuments } from "@modules/articles/document/serve";
import { fakeDocument, TEST_COMPILER_VERSION } from "./helpers";

function article() {
  return toFeedArticleDetailDtoForTest({
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
  test("reads the header, falls back to the query alias, and ignores junk", () => {
    expect(
      parseSupportedDocumentVersion(new Headers({ "x-kyomi-document-version": "2" }), {}),
    ).toBe(2);
    expect(parseSupportedDocumentVersion(new Headers(), { documentVersion: "3" })).toBe(3);
    expect(
      parseSupportedDocumentVersion(new Headers({ "x-kyomi-document-version": "2" }), {
        documentVersion: "9",
      }),
    ).toBe(2);
    expect(
      parseSupportedDocumentVersion(new Headers({ "x-kyomi-document-version": "abc" }), {}),
    ).toBe(0);
    expect(parseSupportedDocumentVersion(new Headers(), undefined)).toBe(0);
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
