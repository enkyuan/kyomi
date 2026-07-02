import { describe, expect, test } from "bun:test";
import { capPublishedBeforeAtNow } from "@modules/articles/read/published-window";

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
