import { describe, expect, test } from "bun:test";
import { createApp } from "@app/http/create-app";
import { normalizeRecapLimitForTest } from "@modules/inbox/recap/service";

describe("inbox recap service", () => {
  test("normalizes rail limits", () => {
    expect(normalizeRecapLimitForTest(undefined)).toBe(5);
    expect(normalizeRecapLimitForTest("")).toBe(5);
    expect(normalizeRecapLimitForTest("0")).toBe(1);
    expect(normalizeRecapLimitForTest("50")).toBe(20);
    expect(normalizeRecapLimitForTest("8")).toBe(8);
  });

  test("registers the recap endpoint under api v1", async () => {
    const app = createApp();
    const response = await app.handle(new Request("http://localhost/api/v1/inbox/recap?limit=5"));

    expect(response.status).not.toBe(404);
    expect(response.status).toBe(401);
  });
});
