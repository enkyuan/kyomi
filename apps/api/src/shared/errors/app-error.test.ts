import { describe, expect, test } from "bun:test";
import { AppError } from "./app-error";

describe("AppError", () => {
  test("forwards cause to the platform Error", () => {
    const root = new Error("root");
    const err = new AppError("wrapped", { cause: root, code: "TEST" });
    expect(err.cause).toBe(root);
  });
});
