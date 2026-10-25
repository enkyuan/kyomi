import {
  compileStoredDocument,
  toStoredDocumentColumns,
  type StoredDocumentInput,
} from "@kyomi/worker/lib/stored-document";

const FORMAT_BY_ORIGIN = {
  feed_html: "html",
  extracted_html: "html",
  feed_markdown: "markdown",
  text_fallback: "text",
} as const satisfies Record<string, StoredDocumentInput["format"]>;

/**
 * Column values for the body document of a write. Returns the null trio when the source cannot be
 * compiled, so a replaced body never keeps a document that describes the previous one.
 */
export async function compileBodyDocumentColumns(input: {
  raw: string | null;
  contentSource: string | null;
  baseUrl: string | null;
  title: string | null;
}) {
  const origin = input.contentSource as keyof typeof FORMAT_BY_ORIGIN | null;
  const format = origin ? FORMAT_BY_ORIGIN[origin] : undefined;
  const stored =
    input.raw && origin && format
      ? await compileStoredDocument({
          raw: input.raw,
          format,
          origin,
          baseUrl: input.baseUrl,
          title: input.title,
        })
      : null;
  const columns = toStoredDocumentColumns(stored);
  return {
    contentDocument: columns.document,
    contentDocumentVersion: columns.documentVersion,
    contentCompilerVersion: columns.compilerVersion,
  };
}
