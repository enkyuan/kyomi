import { articleClips } from "@kyomi/db";
import { getTableColumns } from "drizzle-orm";

const { contentRaw, extractedContentRaw, ...readColumns } = getTableColumns(articleClips);
void contentRaw;
void extractedContentRaw;

/**
 * Every clip column except the raw source bodies, which are untrusted, potentially large, and
 * only read by recompiles. Select these instead of the whole row for any read that serves clients.
 */
export const clipReadColumns = readColumns;

export type ClipReadRow = Omit<
  typeof articleClips.$inferSelect,
  "contentRaw" | "extractedContentRaw"
>;
