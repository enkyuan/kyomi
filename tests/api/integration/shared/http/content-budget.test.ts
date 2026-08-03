import { describe, expect, test } from "bun:test";
import { AppError } from "@shared/errors/app";
import { assertContentFieldBudget } from "@shared/http/content-budget";

describe("assertContentFieldBudget", () => {
  test("allows exactly 1 MiB in a single field", () => {
    const value = "a".repeat(1024 * 1024);
    expect(() => assertContentFieldBudget([{ name: "contentHtml", value }])).not.toThrow();
  });

  test("throws AppError 413/ARTICLE_CONTENT_TOO_LARGE one byte over the per-field cap", () => {
    const value = "a".repeat(1024 * 1024 + 1);
    try {
      assertContentFieldBudget([{ name: "contentHtml", value }]);
      throw new Error("expected assertContentFieldBudget to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).status).toBe(413);
      expect((error as AppError).code).toBe("ARTICLE_CONTENT_TOO_LARGE");
    }
  });

  test("checks the 2 MiB aggregate across all non-null content*, contentHtml, contentText, contentMarkdown values", () => {
    const each = "a".repeat(700 * 1024);
    expect(() =>
      assertContentFieldBudget([
        { name: "content", value: each },
        { name: "contentHtml", value: each },
        { name: "contentText", value: each },
      ]),
    ).toThrow(AppError);
  });

  test("allows an aggregate at exactly the 2 MiB cap", () => {
    const each = "a".repeat(Math.floor((2 * 1024 * 1024) / 3));
    expect(() =>
      assertContentFieldBudget([
        { name: "content", value: each },
        { name: "contentHtml", value: each },
        { name: "contentMarkdown", value: each },
      ]),
    ).not.toThrow();
  });

  test("measures UTF-8 bytes, not JS string length, for emoji/non-Latin text", () => {
    const value = "😀".repeat(300_000); // 4 bytes/char in UTF-8, ~1.2 MiB > 1 MiB cap
    expect(Buffer.byteLength(value, "utf8")).toBeGreaterThan(1024 * 1024);
    expect(() => assertContentFieldBudget([{ name: "contentHtml", value }])).toThrow(AppError);
  });

  test("null and undefined values cost zero", () => {
    expect(() =>
      assertContentFieldBudget([
        { name: "contentHtml", value: null },
        { name: "contentText", value: undefined },
        { name: "content", value: "small" },
      ]),
    ).not.toThrow();
  });

  test("error details contain only field name and byte counts, never the content itself", () => {
    const value = "secret-content-do-not-log".repeat(100_000);
    try {
      assertContentFieldBudget([{ name: "contentHtml", value }], { fieldMaxBytes: 10 });
      throw new Error("expected assertContentFieldBudget to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      const details = JSON.stringify((error as AppError).details ?? {});
      expect(details).not.toContain("secret-content-do-not-log");
      expect((error as AppError).details).toMatchObject({ field: "contentHtml" });
    }
  });

  test("supports overriding the per-field and aggregate maxima", () => {
    expect(() =>
      assertContentFieldBudget([{ name: "content", value: "abcdef" }], { fieldMaxBytes: 5 }),
    ).toThrow(AppError);
    expect(() =>
      assertContentFieldBudget([{ name: "content", value: "abcde" }], { fieldMaxBytes: 5 }),
    ).not.toThrow();
  });
});
