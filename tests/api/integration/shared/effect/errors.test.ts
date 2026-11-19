import { describe, expect, test } from "bun:test";
import {
  BadRequest,
  DatabaseError,
  ERROR_CATALOGUE,
  InternalError,
  isApiError,
  unexpected,
} from "@shared/effect/errors";

describe("error catalogue", () => {
  test("isApiError recognises catalogue errors and nothing else", () => {
    expect(isApiError(new BadRequest({ message: "bad" }))).toBe(true);
    expect(isApiError(new DatabaseError({ operation: "select", cause: 1 }))).toBe(true);
    expect(isApiError(new Error("plain"))).toBe(false);
    expect(isApiError({ _tag: "BadRequest" })).toBe(false);
    expect(isApiError(Object.assign(new Error("x"), { _tag: "NotInTheCatalogue" }))).toBe(false);
  });

  test("every public class maps to an error HTTP status", () => {
    for (const [tag, entry] of Object.entries(ERROR_CATALOGUE)) {
      expect(entry.status, tag).toBeGreaterThanOrEqual(400);
      expect(entry.status, tag).toBeLessThan(600);
    }
  });

  test("unexpected wraps anything as an opaque InternalError that keeps the cause", () => {
    const cause = new TypeError("oops");
    const wrapped = unexpected(cause);
    expect(wrapped).toBeInstanceOf(InternalError);
    expect(wrapped.message).toBe("Internal error");
    expect(wrapped.cause).toBe(cause);
  });
});
