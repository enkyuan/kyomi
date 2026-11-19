import { describe, expect, test } from "bun:test";
import { Effect } from "effect";
import { extractArticleContentFromHtml } from "@modules/articles/reader/extraction/readability";

const PERFORMANCE_DEV_LINEAR_FIXTURE = new URL(
  "../../../../../fixtures/articles/performance-dev-linear.html",
  import.meta.url,
);

describe("articles.reader.extraction.readability", () => {
  test("extracts a performance.dev-style article from a local fixture without live network", async () => {
    const html = await Bun.file(PERFORMANCE_DEV_LINEAR_FIXTURE).text();

    const result = await Effect.runPromise(
      extractArticleContentFromHtml({
        body: html,
        finalUrl: "https://performance.dev/how-is-linear-so-fast-a-technical-breakdown",
      }),
    );

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

  test("rejects non-article URLs before parsing fixture HTML", async () => {
    const failure = await Effect.runPromise(
      Effect.flip(
        extractArticleContentFromHtml({
          body: "<article><p>This body should not matter once the URL is rejected.</p></article>",
          finalUrl: "https://performance.dev/search",
        }),
      ),
    );

    expect(failure).toMatchObject({
      _tag: "ExtractionFailed",
      errorCode: "NO_READABLE_CONTENT",
      errorMessage: "This source is not a readable article page.",
    });
  });

  test("fails typed when Readability finds no article body", async () => {
    const failure = await Effect.runPromise(
      Effect.flip(
        extractArticleContentFromHtml({
          body: "<html><body></body></html>",
          finalUrl: "https://performance.dev/post",
        }),
      ),
    );

    expect(failure).toMatchObject({
      _tag: "ExtractionFailed",
      errorCode: "NO_READABLE_CONTENT",
      errorMessage: "No readable article body was found.",
    });
  });

  test("fails typed with BLOCKED_URL when the final URL does not parse", async () => {
    const failure = await Effect.runPromise(
      Effect.flip(extractArticleContentFromHtml({ body: "<p>x</p>", finalUrl: "not a url" })),
    );

    expect(failure).toMatchObject({ _tag: "ExtractionFailed", errorCode: "BLOCKED_URL" });
  });

  describe("pages past the structure budget", () => {
    const url = "https://performance.dev/post";
    const sentence =
      "Linear feels immediate because the client keeps a local copy of every issue and applies changes optimistically. ";
    const articleParagraphs = `<p>${sentence.repeat(4)}</p><p>${sentence.repeat(4)}</p><p>${sentence.repeat(4)}</p>`;
    const failure = (body: string) =>
      Effect.runPromise(Effect.flip(extractArticleContentFromHtml({ body, finalUrl: url })));

    test.each([
      ["nested divs", `${"<div>".repeat(1_200)}${articleParagraphs}`],
      // Each of these is a line of markup an estimate from the tag text reads as shallow.
      ["self-closing divs the parser opens", `${"<div/>".repeat(600)}${articleParagraphs}`],
      ["closers that close nothing", `${"<div></x>".repeat(600)}${articleParagraphs}`],
      [
        "links past the element limit",
        `${'<a href="/x">l</a>'.repeat(50_500)}${articleParagraphs}`,
      ],
    ])("fails typed, and quickly, for a page of %s", async (_, body) => {
      const started = performance.now();
      const error = await failure(body);
      const elapsed = performance.now() - started;

      expect(error).toMatchObject({
        _tag: "ExtractionFailed",
        errorCode: "NO_READABLE_CONTENT",
        errorMessage: "This source is too complex to read as an article.",
      });
      // Readability took seconds on these (cubic in the nesting, quadratic in the element count:
      // about 5 s at 1,200 levels, 54 s at 2,400, 10 s on 170k links); the budget needs milliseconds.
      expect(elapsed).toBeLessThan(3_000);
    });

    test("still extracts a page with a large inline script full of comparisons", async () => {
      const body = `<html><head><title>Post</title><script>${"for(var i=0;i<n;i++){x[i]=i>>1}".repeat(2_000)}</script></head>
        <body><article><h1>How Linear is so fast</h1>${articleParagraphs}</article></body></html>`;

      const result = await Effect.runPromise(
        extractArticleContentFromHtml({ body, finalUrl: url }),
      );

      expect(result.content.contentText).toContain("Linear feels immediate");
    });

    test("still extracts a long page of a few thousand elements", async () => {
      const body = `<html><body><article>${`<div><p>${sentence.repeat(2)}</p></div>`.repeat(2_000)}</article></body></html>`;

      const result = await Effect.runPromise(
        extractArticleContentFromHtml({ body, finalUrl: url }),
      );

      expect(result.content.contentText).toContain("Linear feels immediate");
    });
  });

  test("normalizes readability prose captured in a preformatted article wrapper", async () => {
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

    const result = await Effect.runPromise(
      extractArticleContentFromHtml({
        body,
        finalUrl: "https://www.flatpanelshd.com/news.php?subaction=showfull&id=1783340582",
      }),
    );
    expect(result.content.contentHtml).not.toContain("<pre");
    expect(result.content.contentHtml).toContain("<p>PlayStation is facing");
    expect(result.content.contentText).toContain("digital ownership can remain fragile");
  });
});
