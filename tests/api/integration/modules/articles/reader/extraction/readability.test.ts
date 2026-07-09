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

  test("normalizes readability prose captured in a preformatted article wrapper", () => {
    const body = `
      <html>
        <head><title>PlayStation can delete all your digital games after 3 years of inactivity (EU)</title></head>
        <body>
          <article>
            <h1>PlayStation can delete all your digital games after 3 years of inactivity (EU)</h1>
            <pre>PlayStation is facing mounting backlash over its decision to abandon physical game discs in favor of all-digital distribution, raising important questions about ownership.

The official announcement came last week. Starting in 2028, new PlayStation games will no longer be released on physical discs.

The decision has sparked outrage among gamers, with accusations of greed and claims that Sony is trying to establish a monopoly through the PlayStation Store as the sole distribution platform for console games, ultimately leading to higher prices.

PlayStation can delete your games after 36 months of account inactivity in the EU, according to the company terms.

Whether PlayStation actually enforces this policy is another matter, but consumer rights advocates have warned that digital ownership can remain fragile.</pre>
          </article>
        </body>
      </html>
    `;

    const result = extractArticleContentFromHtml({
      body,
      finalUrl: "https://www.flatpanelshd.com/news.php?subaction=showfull&id=1783340582",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(result.errorMessage);
    }
    expect(result.content.contentHtml).not.toContain("<pre");
    expect(result.content.contentHtml).toContain("<p>PlayStation is facing");
    expect(result.content.contentText).toContain("digital ownership can remain fragile");
  });
});
