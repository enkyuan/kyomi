import { describe, expect, test } from "bun:test";
import { Effect } from "effect";
import { PayloadTooLarge } from "@shared/effect/errors";
import { type ContentField, checkContentFieldBudget } from "@shared/http/budget";

type Options = Parameters<typeof checkContentFieldBudget>[1];

/** The budget failure for `fields`, or `undefined` when they fit. */
const violation = (fields: ContentField[], options?: Options) =>
  Effect.runPromise(
    Effect.flip(checkContentFieldBudget(fields, options)).pipe(
      Effect.catch(() => Effect.succeed(undefined)),
    ),
  );

describe("checkContentFieldBudget", () => {
  test("allows exactly 1 MiB in a single field", async () => {
    const value = "a".repeat(1024 * 1024);
    expect(await violation([{ name: "contentHtml", value }])).toBeUndefined();
  });

  test("fails with PayloadTooLarge 413/ARTICLE_CONTENT_TOO_LARGE one byte over the per-field cap", async () => {
    const value = "a".repeat(1024 * 1024 + 1);

    const error = await violation([{ name: "contentHtml", value }]);

    expect(error).toBeInstanceOf(PayloadTooLarge);
    expect(error).toMatchObject({
      _tag: "PayloadTooLarge",
      code: "ARTICLE_CONTENT_TOO_LARGE",
      details: { field: "contentHtml", bytes: 1024 * 1024 + 1, maxBytes: 1024 * 1024 },
    });
  });

  test("checks the 2 MiB aggregate across all non-null content*, contentHtml, contentText, contentMarkdown values", async () => {
    const each = "a".repeat(700 * 1024);

    const error = await violation([
      { name: "content", value: each },
      { name: "contentHtml", value: each },
      { name: "contentText", value: each },
    ]);

    expect(error).toMatchObject({
      _tag: "PayloadTooLarge",
      message: "Content fields exceed maximum aggregate size",
    });
  });

  test("allows an aggregate at exactly the 2 MiB cap", async () => {
    const each = "a".repeat(Math.floor((2 * 1024 * 1024) / 3));

    expect(
      await violation([
        { name: "content", value: each },
        { name: "contentHtml", value: each },
        { name: "contentMarkdown", value: each },
      ]),
    ).toBeUndefined();
  });

  test("measures UTF-8 bytes, not JS string length, for emoji/non-Latin text", async () => {
    const value = "😀".repeat(300_000); // 4 bytes/char in UTF-8, ~1.2 MiB > 1 MiB cap
    expect(Buffer.byteLength(value, "utf8")).toBeGreaterThan(1024 * 1024);

    expect(await violation([{ name: "contentHtml", value }])).toBeInstanceOf(PayloadTooLarge);
  });

  test("null and undefined values cost zero", async () => {
    expect(
      await violation([
        { name: "contentHtml", value: null },
        { name: "contentText", value: undefined },
        { name: "content", value: "small" },
      ]),
    ).toBeUndefined();
  });

  test("error details contain only field name and byte counts, never the content itself", async () => {
    const value = "secret-content-do-not-log".repeat(100_000);

    const error = await violation([{ name: "contentHtml", value }], { fieldMaxBytes: 10 });

    expect(JSON.stringify(error?.details ?? {})).not.toContain("secret-content-do-not-log");
    expect(error?.details).toMatchObject({ field: "contentHtml" });
  });

  test("supports overriding the per-field and aggregate maxima", async () => {
    expect(
      await violation([{ name: "content", value: "abcdef" }], { fieldMaxBytes: 5 }),
    ).toBeInstanceOf(PayloadTooLarge);
    expect(
      await violation([{ name: "content", value: "abcde" }], { fieldMaxBytes: 5 }),
    ).toBeUndefined();
  });
});
