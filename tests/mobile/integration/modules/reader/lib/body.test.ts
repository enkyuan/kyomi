import { describe, expect, test } from "bun:test";
import "../../../packages/reader/render";
import { makeDocument } from "../../../packages/reader/fixtures";

const { readerDocumentHeaders, selectReaderBody, READER_DOCUMENT_VERSION_HEADER } =
  await import("../../../../../../apps/mobile/src/lib/reader-document");
const { startReaderTrace } =
  await import("../../../../../../apps/mobile/src/modules/reader/lib/metrics");

const html = { bodyKind: "html" as const, contentHtml: "<p>x</p>" };
const withDocument = (document: unknown) => ({
  ...html,
  documentBody: { bodyKind: "document" as const, document },
});

describe("selectReaderBody", () => {
  test("uses the DOM body when the flag is off", () => {
    expect(selectReaderBody(withDocument(makeDocument([])), false).kind).toBe("html");
  });

  test("uses the native renderer for a supported, valid document", () => {
    expect(selectReaderBody(withDocument(makeDocument([])), true).kind).toBe("document");
  });

  test("falls back for an HTML-only article", () => {
    expect(selectReaderBody(html, true).kind).toBe("html");
  });

  test("falls back for an unsupported document version", () => {
    const future = { ...(makeDocument([]) as object), version: 99 };
    expect(selectReaderBody(withDocument(future), true).kind).toBe("html");
  });

  test("falls back for a document that fails validation", () => {
    const broken = { ...(makeDocument([]) as object), blocks: [{ type: "paragraph" }] };
    expect(selectReaderBody(withDocument(broken), true).kind).toBe("html");
  });
});

describe("readerDocumentHeaders", () => {
  test("sends the supported version only when the flag is on", () => {
    expect(readerDocumentHeaders(false)).toEqual({});
    expect(readerDocumentHeaders(true)).toEqual({ [READER_DOCUMENT_VERSION_HEADER]: "1" });
  });
});

describe("startReaderTrace", () => {
  test("logs time to first content once", () => {
    const lines: unknown[] = [];
    let clock = 100;
    const trace = startReaderTrace({
      articleId: "a1",
      enabled: true,
      log: (_line, payload) => lines.push(payload),
      now: () => clock,
      renderer: "native",
    });
    clock = 160;
    trace.ready();
    trace.ready();
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      articleId: "a1",
      renderer: "native",
      timeToFirstContentMs: 60,
    });
  });
});
