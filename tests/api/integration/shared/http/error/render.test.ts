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
