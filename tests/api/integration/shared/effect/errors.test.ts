import { describe, expect, test } from "bun:test";
import { AppError } from "@shared/errors/app";
import {
  BadRequest,
  ERROR_CATALOGUE,
  InternalError,
  NotFound,
  fromAppError,
  toPublicError,
} from "@shared/effect/errors";

describe("AppError interop", () => {
  test("re-tags by status and keeps code, message and details", () => {
    const error = fromAppError(
      new AppError("missing", { status: 404, code: "FEED_NOT_FOUND", details: { feedId: "f" } }),
    );
    expect(error).toBeInstanceOf(NotFound);
    expect(error).toMatchObject({
      code: "FEED_NOT_FOUND",
      message: "missing",
      details: { feedId: "f" },
    });
  });

  test("covers every status the API uses", () => {
    for (const status of [400, 401, 403, 404, 409, 413, 422, 429, 500, 502, 503, 504]) {
      const error = fromAppError(new AppError("x", { status }));
      const catalogued = ERROR_CATALOGUE[error._tag];
      expect<number>(catalogued.status).toBe(status);
    }
  });

  test("toPublicError passes typed errors through, re-tags AppError and wraps the rest", () => {
    const typed = new BadRequest({ message: "bad" });
    expect(toPublicError(typed)).toBe(typed);
    expect(toPublicError(new AppError("m", { status: 409 })).constructor.name).toBe("Conflict");
    const wrapped = toPublicError(new TypeError("oops"));
    expect(wrapped).toBeInstanceOf(InternalError);
    expect(wrapped.message).toBe("Internal error");
    expect(wrapped.cause).toBeInstanceOf(TypeError);
  });
});
