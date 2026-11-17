import { describe, expect, test } from "bun:test";
import {
  capPublishedBeforeAtNow,
  clampLimit,
  utcDayRange,
} from "@modules/articles/read/list/window";

describe("published window", () => {
  const now = new Date("2026-07-01T12:00:00.000Z");

  test("uses now when no upper bound is provided", () => {
    expect(capPublishedBeforeAtNow(undefined, now)).toBe(now);
  });

  test("caps future upper bounds at now", () => {
    const future = new Date("2026-09-01T12:00:00.000Z");

    expect(capPublishedBeforeAtNow(future, now)).toBe(now);
  });

  test("preserves past upper bounds", () => {
    const past = new Date("2026-06-01T12:00:00.000Z");

    expect(capPublishedBeforeAtNow(past, now)).toBe(past);
  });
});

describe("page limits", () => {
  test("clamp to 1..200", () => {
    expect(clampLimit(0)).toBe(1);
    expect(clampLimit(50)).toBe(50);
    expect(clampLimit(5000)).toBe(200);
  });
});

describe("utcDayRange", () => {
  test("spans the UTC day containing now", () => {
    const { start, end } = utcDayRange(new Date("2026-07-01T23:30:00.000Z"));

    expect(start.toISOString()).toBe("2026-07-01T00:00:00.000Z");
    expect(end.toISOString()).toBe("2026-07-02T00:00:00.000Z");
  });
});
