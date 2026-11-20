import { Effect } from "effect";
import { PayloadTooLarge } from "@shared/effect/errors";

const DEFAULT_FIELD_MAX_BYTES = 1 * 1024 * 1024;
const DEFAULT_AGGREGATE_MAX_BYTES = 2 * 1024 * 1024;
const CONTENT_TOO_LARGE_CODE = "ARTICLE_CONTENT_TOO_LARGE";

export type ContentField = { name: string; value: string | null | undefined };

type BudgetOptions = { fieldMaxBytes?: number; aggregateMaxBytes?: number };

type BudgetViolation = { message: string; details: Record<string, unknown> };

function findBudgetViolation(
  fields: ReadonlyArray<ContentField>,
  options?: BudgetOptions,
): BudgetViolation | null {
  const fieldMaxBytes = options?.fieldMaxBytes ?? DEFAULT_FIELD_MAX_BYTES;
  const aggregateMaxBytes = options?.aggregateMaxBytes ?? DEFAULT_AGGREGATE_MAX_BYTES;

  let aggregateBytes = 0;
  for (const field of fields) {
    if (field.value == null) {
      continue;
    }
    const byteLength = Buffer.byteLength(field.value, "utf8");
    if (byteLength > fieldMaxBytes) {
      return {
        message: "Content field exceeds maximum size",
        details: { field: field.name, bytes: byteLength, maxBytes: fieldMaxBytes },
      };
    }
    aggregateBytes += byteLength;
  }

  if (aggregateBytes > aggregateMaxBytes) {
    return {
      message: "Content fields exceed maximum aggregate size",
      details: { bytes: aggregateBytes, maxBytes: aggregateMaxBytes },
    };
  }
  return null;
}

/** Fails with `PayloadTooLarge` (413) when a content field, or the fields together, exceed the byte budget. */
export function checkContentFieldBudget(
  fields: ReadonlyArray<ContentField>,
  options?: BudgetOptions,
): Effect.Effect<void, PayloadTooLarge> {
  return Effect.suspend(() => {
    const violation = findBudgetViolation(fields, options);
    return violation
      ? Effect.fail(
          new PayloadTooLarge({
            message: violation.message,
            code: CONTENT_TOO_LARGE_CODE,
            details: violation.details,
          }),
        )
      : Effect.void;
  });
}
