import { describe, expect, test } from "bun:test";
import { normalizeOrganizerLimitForTest } from "@modules/inbox/organizer/service";

describe("inbox organizer service", () => {
  test("normalizes rail limits", () => {
    expect(normalizeOrganizerLimitForTest(undefined)).toBe(5);
    expect(normalizeOrganizerLimitForTest("")).toBe(5);
    expect(normalizeOrganizerLimitForTest("0")).toBe(1);
    expect(normalizeOrganizerLimitForTest("50")).toBe(20);
    expect(normalizeOrganizerLimitForTest("8")).toBe(8);
  });
});
