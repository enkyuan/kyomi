import { describe, expect, test } from "vitest";
import { isUuid, parseOpaqueId, parseUuid } from "@lib/ids";
import { HttpStatusError } from "@lib/status";
import { PATH_ATTACKS } from "./path-attacks";

const UUID = "9b0f2f26-6d1e-4c36-9d56-0a1c3a8b7e11";

describe("parseUuid", () => {
  test.each([UUID, UUID.toUpperCase(), "00000000-0000-0000-0000-000000000000"])(
    "accepts %s",
    (value) => {
      expect(parseUuid(value)).toBe(value);
      expect(isUuid(value)).toBe(true);
    },
  );

  test.each(PATH_ATTACKS)("rejects %j with a 400", (value) => {
    expect(isUuid(value)).toBe(false);
    expect(() => parseUuid(value)).toThrow(HttpStatusError);
    try {
      parseUuid(value);
    } catch (error) {
      expect((error as HttpStatusError).status).toBe(400);
    }
  });
});

describe("parseOpaqueId", () => {
  test.each([UUID, "feed_1", "A-b_9", "x".repeat(128)])("accepts %s", (value) => {
    expect(parseOpaqueId(value)).toBe(value);
  });

  test.each(PATH_ATTACKS.filter((value) => value !== UUID))("rejects %j", (value) => {
    expect(() => parseOpaqueId(value)).toThrow(HttpStatusError);
  });
});
