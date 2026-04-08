import { describe, expect, test } from "bun:test";
import { redactForLog } from "./redact";

describe("redactForLog", () => {
  test("masks sensitive keys", () => {
    const out = redactForLog({
      user: "a",
      password: "secret",
      nested: 1,
    });
    expect(out.user).toBe("a");
    expect(out.password).toBe("[redacted]");
    expect(out.nested).toBe(1);
  });
});
