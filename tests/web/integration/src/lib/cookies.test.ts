import { describe, expect, test } from "vitest";
import { readCookie } from "@lib/cookies";

describe("readCookie", () => {
  test("reads a cookie among others, decoding it", () => {
    const header = "sidebar_state=true; theme=a%20b; kyomi_timezone_offset=-120; other=1";

    expect(readCookie(header, "kyomi_timezone_offset")).toBe("-120");
    expect(readCookie(header, "theme")).toBe("a b");
  });

  test("returns undefined for an absent cookie or header", () => {
    expect(readCookie("a=1", "b")).toBeUndefined();
    expect(readCookie("", "a")).toBeUndefined();
    expect(readCookie(null, "a")).toBeUndefined();
    expect(readCookie(undefined, "a")).toBeUndefined();
  });

  test("does not match a name by prefix or suffix", () => {
    expect(readCookie("xa=1; ax=2; a_b=3", "a")).toBeUndefined();
  });

  test("keeps the whole value of a cookie that contains '='", () => {
    expect(readCookie("token=YWJj==; other=1", "token")).toBe("YWJj==");
  });

  test("ignores another cookie's malformed percent-encoding", () => {
    const header = "x=%E0%A4%A; kyomi_timezone_offset=60; y=%";

    expect(() => readCookie(header, "kyomi_timezone_offset")).not.toThrow();
    expect(readCookie(header, "kyomi_timezone_offset")).toBe("60");
  });

  test("treats the wanted cookie's own malformed value as absent", () => {
    expect(readCookie("kyomi_timezone_offset=%E0%A4%A", "kyomi_timezone_offset")).toBeUndefined();
  });

  test("lets the last well-formed value of a repeated cookie win", () => {
    expect(readCookie("a=1; a=2", "a")).toBe("2");
    expect(readCookie("a=1; a=%E0%A4%A", "a")).toBe("1");
  });
});
