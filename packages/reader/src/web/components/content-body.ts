import type { ReaderContent as ReaderContentModel } from "../../core/types";
import { parseReaderDocument } from "../document/resolve";
import type { ReaderDocumentContent } from "./content";

/** Whether `reader` has something to show, for callers that hide empty bodies. */
export function hasReaderContentBody(reader: ReaderContentModel | ReaderDocumentContent): boolean {
  switch (reader.bodyKind) {
    case "document":
      return parseReaderDocument(reader.document) !== null || Boolean(reader.contentHtml?.trim());
    case "html":
      return Boolean(reader.contentHtml?.trim());
    case "markdown":
      return Boolean(reader.contentMarkdown?.trim());
    case "text":
      return Boolean(reader.contentText?.trim());
    default:
      return false;
  }
}
