import { describe, expect, test } from "bun:test";
import { formatLogLine } from "@adapters/logger/logger";

describe("formatLogLine error serialization", () => {
  test("includes cause chain when logging an Error with cause", () => {
    const root = new Error("connection refused");
    root.name = "DatabaseError";
    const outer = new Error("Failed query: SELECT …");
    outer.name = "DrizzleQueryError";
    (outer as Record<string, unknown>).cause = root;

    const line = formatLogLine("error", "test.event", { error: outer });

    // The root cause must appear in the log line so operators can see the real DB error
    expect(line).toContain("connection refused");
    expect(line).toContain("DrizzleQueryError");
    expect(line).toContain("DatabaseError");
  });

  test("includes driver fields (code, severity) from pg DatabaseError", () => {
    const dbError = Object.assign(new Error("permission denied for table"), {
      name: "DatabaseError",
      code: "42501",
      severity: "ERROR",
    });

    const line = formatLogLine("error", "test.event", { error: dbError });

    expect(line).toContain("42501");
    expect(line).toContain("permission denied");
  });

  test("non-Error error values are stringified", () => {
    const line = formatLogLine("error", "test.event", { error: "string error" });

    expect(line).toContain("string error");
  });

  test("serializes nested cause chain recursively", () => {
    const inner = new Error("root");
    inner.name = "InnerError";
    const middle = new Error("mid");
    middle.name = "MiddleError";
    (middle as Record<string, unknown>).cause = inner;
    const outer = new Error("outer");
    outer.name = "OuterError";
    (outer as Record<string, unknown>).cause = middle;

    const line = formatLogLine("error", "test.event", { error: outer });

    expect(line).toContain("root");
    expect(line).toContain("OuterError");
    expect(line).toContain("MiddleError");
    expect(line).toContain("InnerError");
  });
});
