import { describe, expect, test } from "vitest";
import { HttpStatusError, getErrorStatus, toErrorStatus } from "@lib/status";

describe("toErrorStatus", () => {
  test.each([400, 404, 500, 599])("accepts %i", (status) => {
    expect(toErrorStatus(status)).toBe(status);
  });

  test.each([200, 302, 399, 600, 404.5, Number.NaN, "404", null, undefined])(
    "rejects %s",
    (value) => {
      expect(toErrorStatus(value)).toBeUndefined();
    },
  );
});

describe("getErrorStatus", () => {
  test("reads the status of an HttpStatusError", () => {
    expect(getErrorStatus(new HttpStatusError(403))).toBe(403);
  });

  test("reads status and statusCode fields", () => {
    expect(getErrorStatus({ status: 429 })).toBe(429);
    expect(getErrorStatus({ statusCode: 503 })).toBe(503);
    expect(getErrorStatus(Object.assign(new Error("Nope"), { status: 401 }))).toBe(401);
  });

  test("reads the status of a thrown Response", () => {
    expect(getErrorStatus(new Response(null, { status: 502 }))).toBe(502);
  });

  test("treats the router's not-found as 404", () => {
    expect(getErrorStatus({ isNotFound: true })).toBe(404);
  });

  test("ignores values that carry no error status", () => {
    expect(getErrorStatus(new Error("Plain"))).toBeUndefined();
    expect(getErrorStatus({ status: 200 })).toBeUndefined();
    expect(getErrorStatus({ status: "UNAUTHORIZED", statusCode: 401 })).toBe(401);
    expect(getErrorStatus("boom")).toBeUndefined();
    expect(getErrorStatus(null)).toBeUndefined();
  });
});
