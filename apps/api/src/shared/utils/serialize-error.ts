/**
 * Keys carried by pg's DatabaseError (and similar driver errors) that are essential for
 * debugging but are not present on the standard Error interface.
 */
const DRIVER_ERROR_KEYS = [
  "code",
  "severity",
  "detail",
  "hint",
  "position",
  "table",
  "column",
  "constraint",
  "schema",
  "dataType",
] as const;

/**
 * Recursively serializes an unknown error into a plain, JSON-safe object suitable for
 * structured logging. Unlike the lossy `error.message` shorthand used elsewhere, this
 * function unwraps the entire `cause` chain so the root cause — the actual PostgreSQL
 * error in a DrizzleQueryError — is always visible.
 *
 * For example, when drizzle-orm throws a DrizzleQueryError whose `.message` is a
 * 2 000-character SQL string truncated to 240 chars by the logger, `serializeError`
 * instead surfaces the underlying `pg` DatabaseError with its SQLSTATE `code`, `detail`,
 * and `hint` from `error.cause`.
 *
 * Non-Error values are converted to strings; null is preserved as-is.
 */
export function serializeError(error: unknown): Record<string, unknown> | string | null {
  if (error === null) {
    return null;
  }
  if (!(error instanceof Error)) {
    return String(error);
  }

  const result: Record<string, unknown> = {
    name: error.name,
    message: error.message,
  };

  // Unwrap the cause chain recursively. This is the critical difference from the
  // `error.message` pattern: DrizzleQueryError stores the real DB error in `.cause`.
  if (error.cause !== undefined) {
    result.cause = serializeError(error.cause);
  }

  // Surface driver-specific fields (pg DatabaseError exposes code, severity, detail, etc.).
  // pg's DatabaseError fields are all strings; we filter by type to avoid picking up
  // runtime-provided properties (e.g. Bun's numeric `column` on standard Error).
  const record = error as unknown as Record<string, unknown>;
  for (const key of DRIVER_ERROR_KEYS) {
    const value = record[key];
    if (typeof value === "string" && value.length > 0) {
      result[key] = value;
    }
  }

  return result;
}
