import { describe, expect, test } from "bun:test";
import { decodeCursorPayload, encodeCursorPayload } from "@modules/articles/read/cursor-codec";

describe("article cursor codec", () => {
  test("round-trips base64url JSON payloads with a prefix", () => {
    const encoded = encodeCursorPayload("x1.", { v: 1, id: "item_1" });
    expect(encoded.startsWith("x1.")).toBe(true);
    expect(
      decodeCursorPayload<{ v: number; id: string }>("x1.", encoded, () => {
        throw new Error("invalid");
      }),
    ).toEqual({ v: 1, id: "item_1" });
  });

  test("uses the caller invalid handler for bad prefixes and bad JSON", () => {
    const invalid = () => {
      throw new Error("bad cursor");
    };

    expect(() => decodeCursorPayload("x1.", "y1.abc", invalid)).toThrow("bad cursor");
    expect(() => decodeCursorPayload("x1.", "x1.not-json", invalid)).toThrow("bad cursor");
  });
});
