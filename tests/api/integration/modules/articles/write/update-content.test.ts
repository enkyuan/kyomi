import { describe, expect, mock, test } from "bun:test";
import { ARTICLE_HTML_SANITIZER_VERSION } from "@kyomi/worker/sanitization";
import { updateArticleForUser } from "@modules/articles/write/update";

function createFakeDb() {
  const set = mock((patch: Record<string, unknown>) => {
    void patch;
    return { where: () => Promise.resolve() };
  });
  return {
    set,
    db: {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () =>
              Promise.resolve([
                {
                  id: "article-1",
                  feedId: "feed-1",
                  link: "https://example.com/posts/entry",
                  title: "Entry",
                },
              ]),
          }),
        }),
      }),
      update: () => ({ set }),
    },
  };
}

function firstPatch(fake: ReturnType<typeof createFakeDb>): Record<string, unknown> {
  const call = fake.set.mock.calls[0];
  expect(call).toBeDefined();
  return call![0];
}

describe("updateArticleForUser content", () => {
  test("compiles replacement HTML and stores it as raw source with the current version", async () => {
    const fake = createFakeDb();
    const contentHtml = `<p data-kyomi-url="https://evil.example/">See <a href="../about">about</a></p><iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe>`;

    await updateArticleForUser(fake.db as never, "user-1", "article-1", { contentHtml });

    const patch = firstPatch(fake);
    expect(patch.contentRaw).toBe(contentHtml);
    expect(patch.contentSanitizerVersion).toBe(ARTICLE_HTML_SANITIZER_VERSION);
    expect(String(patch.contentHtml)).toContain('href="https://example.com/about"');
    expect(String(patch.contentHtml)).toContain('data-kyomi-embed="youtube"');
    expect(String(patch.contentHtml)).not.toContain("evil.example");
  });

  test("clearing the HTML clears its raw source and version", async () => {
    const fake = createFakeDb();

    await updateArticleForUser(fake.db as never, "user-1", "article-1", { contentHtml: null });

    expect(firstPatch(fake)).toMatchObject({
      contentHtml: null,
      contentRaw: null,
      contentSanitizerVersion: null,
    });
  });

  test("updates that leave contentHtml alone do not touch the version", async () => {
    const fake = createFakeDb();

    await updateArticleForUser(fake.db as never, "user-1", "article-1", {
      contentText: "Plain text",
    });

    expect(firstPatch(fake)).not.toHaveProperty("contentSanitizerVersion");
    expect(firstPatch(fake)).not.toHaveProperty("contentRaw");
  });
});
