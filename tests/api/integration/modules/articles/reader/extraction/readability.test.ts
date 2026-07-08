import { describe, expect, test } from "bun:test";
import { extractArticleContentFromHtml } from "@modules/articles/reader/extraction/readability";

const PERFORMANCE_DEV_LINEAR_FIXTURE = new URL(
  "../../../../../fixtures/articles/performance-dev-linear.html",
  import.meta.url,
);

describe("articles.reader.extraction.readability", () => {
  test("extracts a performance.dev-style article from a local fixture without live network", async () => {
    const html = await Bun.file(PERFORMANCE_DEV_LINEAR_FIXTURE).text();

    const result = extractArticleContentFromHtml({
      body: html,
      finalUrl: "https://performance.dev/how-is-linear-so-fast-a-technical-breakdown",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(result.errorMessage);
    }

    expect(result.content.title).toBe("How's Linear so fast? A technical breakdown");
    expect(result.content.byline).toBe("Dennis Brotzky");
    expect(result.content.siteName).toBe("performance.dev");
    expect(result.content.contentText).toContain("Linear feels immediate");
    expect(result.content.contentText).toContain("fixture-backed tests");
    expect(result.content.contentHtml).toContain(
      'href="https://performance.dev/how-is-linear-so-fast-a-technical-breakdown"',
    );
    expect(result.content.contentHtml).toContain(
      'src="https://performance.dev/images/linear-cache-flow.png"',
    );
    expect(result.content.contentHtml).not.toContain("Related posts");
  });

  test("rejects non-article URLs before parsing fixture HTML", () => {
    const result = extractArticleContentFromHtml({
      body: "<article><p>This body should not matter once the URL is rejected.</p></article>",
      finalUrl: "https://performance.dev/search",
    });

    expect(result).toEqual({
      ok: false,
      errorCode: "NO_READABLE_CONTENT",
      errorMessage: "This source is not a readable article page.",
    });
  });
});
