import { describe, expect, test } from "bun:test";
import { serializeError } from "@shared/utils/serialize-error";

describe("serializeError", () => {
  test("null passes through", () => {
    expect(serializeError(null)).toBe(null);
  });

  test("non-Error values are stringified", () => {
    expect(serializeError("boom")).toBe("boom");
    expect(serializeError(42)).toBe("42");
    expect(serializeError(undefined)).toBe("undefined");
  });

  test("plain errors expose name and message", () => {
    const result = serializeError(new Error("something broke"));
    expect(result).toEqual({
      name: "Error",
      message: "something broke",
    });
  });

  test("errors with cause recursively unwrap the chain", () => {
    const root = new Error("connection refused");
    root.name = "DatabaseError";
    const outer = new Error("Failed query: SELECT * FROM huge_sql_string_truncated");
    outer.name = "DrizzleQueryError";
    (outer as Record<string, unknown>).cause = root;

    const result = serializeError(outer);
    expect(result).toEqual({
      name: "DrizzleQueryError",
      message: expect.stringContaining("Failed query:"),
      cause: {
        name: "DatabaseError",
        message: "connection refused",
      },
    });
  });

  test("nested cause chains are fully unwrapped", () => {
    const inner = new Error("root cause");
    inner.name = "InnerError";
    const middle = new Error("wrapped middle");
    middle.name = "MiddleError";
    (middle as Record<string, unknown>).cause = inner;
    const outer = new Error("outer wrapper");
    outer.name = "OuterError";
    (outer as Record<string, unknown>).cause = middle;

    const result = serializeError(outer);
    expect((result as Record<string, unknown>).cause).toEqual({
      name: "MiddleError",
      message: "wrapped middle",
      cause: {
        name: "InnerError",
        message: "root cause",
      },
    });
  });

  test("driver-specific fields (pg DatabaseError) are surfaced", () => {
    const dbError = Object.assign(new Error("relation does not exist"), {
      name: "DatabaseError",
      code: "42P01",
      severity: "ERROR",
      detail: "An error occurred when looking up relation.",
      hint: 'Did you mean to reference relation "opml_imports"?',
      table: undefined,
      column: undefined,
      constraint: undefined,
    });

    const result = serializeError(dbError);
    expect(result).toMatchObject({
      name: "DatabaseError",
      message: "relation does not exist",
      code: "42P01",
      severity: "ERROR",
      detail: "An error occurred when looking up relation.",
      hint: expect.any(String),
    });
  });

  test("undefined cause is not included", () => {
    const result = serializeError(new Error("no cause"));
    expect(result).not.toHaveProperty("cause");
  });

  test("simulates the exact DrizzleQueryError → pg DatabaseError scenario", () => {
    // Simulates drizzle-orm wrapping a pg DatabaseError
    const pgError = Object.assign(new Error("permission denied for table opml_import_items"), {
      name: "DatabaseError",
      code: "42501",
      severity: "ERROR",
      detail: undefined,
      table: "opml_import_items",
    });
    const drizzleError = new Error("Failed query: <2000 chars of SQL...>");
    drizzleError.name = "DrizzleQueryError";
    (drizzleError as Record<string, unknown>).cause = pgError;

    const result = serializeError(drizzleError);
    expect(result).toEqual({
      name: "DrizzleQueryError",
      message: "Failed query: <2000 chars of SQL...>",
      cause: {
        name: "DatabaseError",
        message: "permission denied for table opml_import_items",
        code: "42501",
        severity: "ERROR",
        table: "opml_import_items",
      },
    });
  });
});
