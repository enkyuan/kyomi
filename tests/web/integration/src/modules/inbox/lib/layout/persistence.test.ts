import { describe, expect, test } from "vitest";
import { readInboxArticleOpenBehaviorCookie } from "@modules/inbox/lib/layout/persistence";

const NAME = "cronos_inbox_article_open_behavior";

describe("readInboxArticleOpenBehaviorCookie", () => {
  test("reads a stored behavior", () => {
    expect(readInboxArticleOpenBehaviorCookie(`a=1; ${NAME}=reader`)).toBe("reader");
    expect(readInboxArticleOpenBehaviorCookie(`${NAME}=split`)).toBe("split");
  });

  test.each([[`x=%E0%A4%A; ${NAME}=reader`], [`${NAME}=reader; x=%E0%A4%A`]])(
    "still reads it beside a cookie with malformed percent-encoding: %s",
    (header) => {
      expect(() => readInboxArticleOpenBehaviorCookie(header)).not.toThrow();
      expect(readInboxArticleOpenBehaviorCookie(header)).toBe("reader");
    },
  );

  test("ignores a value that is not a behavior", () => {
    expect(readInboxArticleOpenBehaviorCookie(`${NAME}=%E0%A4%A`)).toBeUndefined();
    expect(readInboxArticleOpenBehaviorCookie(`${NAME}=other`)).toBeUndefined();
    expect(readInboxArticleOpenBehaviorCookie(null)).toBeUndefined();
  });
});
