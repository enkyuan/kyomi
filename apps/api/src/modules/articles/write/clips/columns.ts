import { articleClips } from "@kyomi/db";
import { getTableColumns } from "drizzle-orm";

const {
  contentRaw,
  extractedContentRaw,
  contentDocument,
  extractedContentDocument,
  ...readColumns
} = getTableColumns(articleClips);
void contentRaw;
void extractedContentRaw;
void contentDocument;
void extractedContentDocument;

/**
 * Every clip column except the raw source bodies and compiled documents, which are untrusted or
 * potentially large and only read by recompiles and the negotiated document path. Select these
 * instead of the whole row for any read that serves clients.
 */
export const clipReadColumns = readColumns;

export type ClipReadRow = Omit<
  typeof articleClips.$inferSelect,
  "contentRaw" | "extractedContentRaw" | "contentDocument" | "extractedContentDocument"
>;
