import { describe, expect, test } from "vitest";
import { readTimezoneOffsetCookie } from "@lib/timezone";

describe("readTimezoneOffsetCookie", () => {
  test("reads the offset a browser stored", () => {
    expect(readTimezoneOffsetCookie("sidebar_state=true; kyomi_timezone_offset=-120")).toBe(-120);
  });

  test.each([
    ["x=%E0%A4%A; kyomi_timezone_offset=60"],
    ["kyomi_timezone_offset=60; x=%E0%A4%A"],
    ["a=%; kyomi_timezone_offset=60; b=%zz"],
  ])("still reads it beside a cookie with malformed percent-encoding: %s", (header) => {
    expect(() => readTimezoneOffsetCookie(header)).not.toThrow();
    expect(readTimezoneOffsetCookie(header)).toBe(60);
  });

  test("ignores a malformed offset instead of failing", () => {
    expect(readTimezoneOffsetCookie("kyomi_timezone_offset=%E0%A4%A")).toBeUndefined();
    expect(readTimezoneOffsetCookie("kyomi_timezone_offset=abc")).toBeUndefined();
    expect(readTimezoneOffsetCookie("kyomi_timezone_offset=99999")).toBeUndefined();
  });

  test("has no offset without the cookie", () => {
    expect(readTimezoneOffsetCookie(null)).toBeUndefined();
    expect(readTimezoneOffsetCookie("a=1")).toBeUndefined();
  });
});
