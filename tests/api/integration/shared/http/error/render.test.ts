import { describe, expect, test } from "bun:test";
import {
  BadGateway,
  BadRequest,
  Conflict,
  NotFound,
  DatabaseError,
  RedisError,
} from "@shared/effect/errors";
import { describeError, failureBody } from "@shared/http/error/render";
import { shapeErrorResponse } from "@shared/http/error/shape";

describe("describeError", () => {
  test("typed catalogue errors use their status and code, and an explicit code wins", () => {
    expect(describeError(new Conflict({ message: "taken" }))).toMatchObject({
      status: 409,
      code: "CONFLICT",
      message: "taken",
    });
    expect(
      describeError(new BadGateway({ message: "feed down", code: "FEED_FETCH_FAILED" })),
    ).toMatchObject({
      status: 502,
      code: "FEED_FETCH_FAILED",
    });
  });

  test("infrastructure errors are opaque and never leak their cause or reply code", () => {
    const db = describeError(
      new DatabaseError({ operation: "select 1", cause: new Error("secret dsn") }),
    );
    expect(db).toMatchObject({
      status: 500,
      code: "INTERNAL_ERROR",
      message: "Internal error",
      expected: false,
    });
    const redis = describeError(
      new RedisError({ operation: "xlen", cause: new Error("x"), code: "NOGROUP" }),
    );
    expect(redis.code).toBe("INTERNAL_ERROR");
  });

  test("a write that lost a race to an equal row is a 409, with the cause still hidden and logged", () => {
    const rendered = describeError(
      new DatabaseError({
        operation: "insert",
        cause: Object.assign(new Error('duplicate key value violates unique constraint "u_idx"'), {
          code: "23505",
        }),
      }),
    );

    expect(rendered).toMatchObject({
      status: 409,
      code: "CONFLICT",
      message: "Conflict",
      expected: false,
    });
    expect(JSON.stringify(failureBody(rendered))).not.toContain("u_idx");
  });

  test("a timeout, deadlock, serialization failure or dropped connection is a retryable 503", () => {
    for (const cause of [
      Object.assign(new Error("canceling statement due to statement timeout"), { code: "57014" }),
      Object.assign(new Error("deadlock detected"), { code: "40P01" }),
      Object.assign(new Error("could not serialize access"), { code: "40001" }),
      Object.assign(new Error("terminating connection"), { code: "57P01" }),
      new Error("Query read timeout"),
      new Error("Connection terminated unexpectedly"),
    ]) {
      const rendered = describeError(new DatabaseError({ operation: "select", cause }));

      expect(rendered).toMatchObject({
        status: 503,
        code: "SERVICE_UNAVAILABLE",
        message: "Service temporarily unavailable",
        expected: false,
      });
      expect(JSON.stringify(failureBody(rendered))).not.toContain(cause.message);
    }
  });

  test("a foreign key violation or any other database error is still an opaque 500", () => {
    for (const cause of [
      Object.assign(new Error("violates foreign key constraint"), { code: "23503" }),
      Object.assign(new Error("syntax error"), { code: "42601" }),
    ]) {
      expect(describeError(new DatabaseError({ operation: "x", cause }))).toMatchObject({
        status: 500,
        code: "INTERNAL_ERROR",
        message: "Internal error",
        expected: false,
      });
    }
  });

  test("a typed error keeps its explicit code and details", () => {
    expect(
      describeError(
        new NotFound({ message: "gone", code: "ARTICLE_NOT_FOUND", details: { id: "a" } }),
      ),
    ).toMatchObject({
      status: 404,
      code: "ARTICLE_NOT_FOUND",
      message: "gone",
      details: { id: "a" },
    });
  });

  test("framework 4xx errors keep their status and unknown errors are an opaque 500", () => {
    expect(describeError({ status: 413, message: "too big" })).toMatchObject({
      status: 413,
      code: "BAD_REQUEST",
      message: "too big",
    });
    expect(describeError(new Error("kaboom"))).toMatchObject({
      status: 500,
      message: "Internal error",
    });
  });

  test("the envelope has the documented shape", async () => {
    const body = failureBody(
      describeError(new Conflict({ message: "taken", details: { a: 1 } })),
      "req-1",
    );
    expect(body).toEqual({
      error: { message: "taken", code: "CONFLICT", requestId: "req-1", details: { a: 1 } },
    });
    const response = shapeErrorResponse(new BadRequest({ message: "nope", code: "X" }), "req-2");
    expect(response.status).toBe(400);
    expect(await (response as Response).json()).toEqual({
      error: { message: "nope", code: "X", requestId: "req-2" },
    });
  });
});
