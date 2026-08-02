import { AppError } from "@shared/errors/app";

const DEFAULT_FIELD_MAX_BYTES = 1 * 1024 * 1024;
const DEFAULT_AGGREGATE_MAX_BYTES = 2 * 1024 * 1024;

export type ContentField = { name: string; value: string | null | undefined };

export function assertContentFieldBudget(
  fields: ReadonlyArray<ContentField>,
  options?: { fieldMaxBytes?: number; aggregateMaxBytes?: number },
): void {
  const fieldMaxBytes = options?.fieldMaxBytes ?? DEFAULT_FIELD_MAX_BYTES;
  const aggregateMaxBytes = options?.aggregateMaxBytes ?? DEFAULT_AGGREGATE_MAX_BYTES;

  let aggregateBytes = 0;
  for (const field of fields) {
    if (field.value == null) {
      continue;
    }
    const byteLength = Buffer.byteLength(field.value, "utf8");
    if (byteLength > fieldMaxBytes) {
      throw new AppError("Content field exceeds maximum size", {
        status: 413,
        code: "ARTICLE_CONTENT_TOO_LARGE",
        details: { field: field.name, bytes: byteLength, maxBytes: fieldMaxBytes },
      });
    }
    aggregateBytes += byteLength;
  }

  if (aggregateBytes > aggregateMaxBytes) {
    throw new AppError("Content fields exceed maximum aggregate size", {
      status: 413,
      code: "ARTICLE_CONTENT_TOO_LARGE",
      details: { bytes: aggregateBytes, maxBytes: aggregateMaxBytes },
    });
  }
}
