import type { db } from "@adapters/db/client";
import { articleClips, feedItems } from "@kyomi/db";
import { readerDocumentSchema, type ReaderDocument } from "@kyomi/reader/document";
import { eq } from "drizzle-orm";

type DB = typeof db;

export type DocumentPatchTarget = {
  table: "feed_items" | "article_clips";
  id: string;
  body: "original" | "extracted";
};

/** The document the caller read; a patch applies only if storage still holds exactly this. */
export type DocumentPatchExpectation = {
  documentVersion: number;
  compilerVersion: string;
};

export type DocumentPatchResult =
  | { status: "patched"; document: ReaderDocument }
  /** The row now holds another document version or compiler version; the job should drop. */
  | { status: "stale" }
  /** The row or its document no longer exists. */
  | { status: "missing" }
  /** The stored or patched document failed validation, or the patch touched a field it may not. */
  | { status: "invalid"; reason: string };

const COLUMNS = {
  feed_items: {
    table: feedItems,
    original: {
      document: feedItems.contentDocument,
      documentVersion: feedItems.contentDocumentVersion,
      compilerVersion: feedItems.contentCompilerVersion,
    },
    extracted: {
      document: feedItems.extractedContentDocument,
      documentVersion: feedItems.extractedContentDocumentVersion,
      compilerVersion: feedItems.extractedContentCompilerVersion,
    },
  },
  article_clips: {
    table: articleClips,
    original: {
      document: articleClips.contentDocument,
      documentVersion: articleClips.contentDocumentVersion,
      compilerVersion: articleClips.contentCompilerVersion,
    },
    extracted: {
      document: articleClips.extractedContentDocument,
      documentVersion: articleClips.extractedContentDocumentVersion,
      compilerVersion: articleClips.extractedContentCompilerVersion,
    },
  },
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Copies a document with the fields enrichment jobs own removed: `width`, `height`, and
 * `placeholder` on images, and `snapshot` on embeds. Two documents that differ only in those
 * fields normalize to the same value.
 */
export function withoutEnrichmentFields(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(withoutEnrichmentFields);
  }
  if (!isRecord(value)) {
    return value;
  }
  const isImage = typeof value.src === "string" && typeof value.alt === "string";
  const isEmbed = value.type === "embed";
  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    if (isImage && (key === "width" || key === "height" || key === "placeholder")) {
      continue;
    }
    if (isEmbed && key === "snapshot") {
      continue;
    }
    out[key] = withoutEnrichmentFields(child);
  }
  return out;
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) {
    return true;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, index) => deepEqual(item, b[index]));
  }
  if (isRecord(a) && isRecord(b)) {
    const keys = Object.keys(a);
    return (
      keys.length === Object.keys(b).length &&
      keys.every((key) => Object.hasOwn(b, key) && deepEqual(a[key], b[key]))
    );
  }
  return false;
}

/**
 * The only write path for enrichment jobs (image dimensions and placeholders, embed snapshots).
 * Runs under a row lock, refuses when versions moved on, validates the result against the KDM
 * schema, and rejects any patch that changes more than the enrichment-owned fields. Compiler
 * output is therefore never altered by a job, only completed.
 */
export async function patchStoredDocument(
  database: DB,
  target: DocumentPatchTarget,
  expected: DocumentPatchExpectation,
  patch: (document: ReaderDocument) => ReaderDocument,
): Promise<DocumentPatchResult> {
  const spec = COLUMNS[target.table];
  const columns = spec[target.body];
  return database.transaction(async (tx): Promise<DocumentPatchResult> => {
    const [row] = await tx
      .select({
        document: columns.document,
        documentVersion: columns.documentVersion,
        compilerVersion: columns.compilerVersion,
      })
      .from(spec.table)
      .where(eq(spec.table.id, target.id))
      .for("update")
      .limit(1);
    if (!row || !row.document) {
      return { status: "missing" };
    }
    if (
      row.documentVersion !== expected.documentVersion ||
      row.compilerVersion !== expected.compilerVersion
    ) {
      return { status: "stale" };
    }
    const current = readerDocumentSchema.safeParse(row.document);
    if (!current.success) {
      return { status: "invalid", reason: "stored document failed validation" };
    }
    const next = readerDocumentSchema.safeParse(patch(structuredClone(current.data)));
    if (!next.success) {
      return { status: "invalid", reason: "patched document failed validation" };
    }
    if (!deepEqual(withoutEnrichmentFields(current.data), withoutEnrichmentFields(next.data))) {
      return { status: "invalid", reason: "patch changed fields outside enrichment" };
    }
    const original = target.body === "original";
    if (target.table === "feed_items") {
      await tx
        .update(feedItems)
        .set(original ? { contentDocument: next.data } : { extractedContentDocument: next.data })
        .where(eq(feedItems.id, target.id));
    } else {
      await tx
        .update(articleClips)
        .set(original ? { contentDocument: next.data } : { extractedContentDocument: next.data })
        .where(eq(articleClips.id, target.id));
    }
    return { status: "patched", document: next.data };
  });
}
