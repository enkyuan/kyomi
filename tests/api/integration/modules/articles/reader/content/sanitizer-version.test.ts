import { describe, expect, test } from "bun:test";
import { ARTICLE_HTML_SANITIZER_VERSION } from "@kyomi/worker/sanitization";
import { compileArticleHtml } from "@kyomi/worker/document";
import {
  buildExtractedReaderViewFromDb,
  buildStoredReaderContent,
  processArticleHtml,
} from "@modules/articles/reader/content";

const CLEAN_HTML = "<article><h1>Title</h1><p>Intro</p></article>";
const DIRTY_HTML = '<article><p onclick="alert(1)">Intro</p></article>';

describe("processArticleHtml", () => {
  test("null sanitizer version runs the core sanitizer and returns the current version", () => {
    let coreSanitizerRuns = 0;
    let domsCreated = 0;
    const result = processArticleHtml(DIRTY_HTML, {
      sanitizerVersion: null,
      instrumentation: {
        onCoreSanitizerRun: () => {
          coreSanitizerRuns += 1;
        },
        onDomCreated: () => {
          domsCreated += 1;
        },
      },
    });

    expect(result.sanitizerVersion).toBe(ARTICLE_HTML_SANITIZER_VERSION);
    expect(result.coreSanitizerRan).toBe(true);
    expect(result.html).not.toContain("onclick");
    expect(coreSanitizerRuns).toBe(1);
    expect(domsCreated).toBe(1);
  });

  test("an old sanitizer version runs the core sanitizer", () => {
    const result = processArticleHtml(DIRTY_HTML, { sanitizerVersion: "article-html-v0" });
    expect(result.coreSanitizerRan).toBe(true);
    expect(result.html).not.toContain("onclick");
  });

  test("the current sanitizer version skips only the core sanitizer call", () => {
    let coreSanitizerRuns = 0;
    let domsCreated = 0;
    const result = processArticleHtml(CLEAN_HTML, {
      sanitizerVersion: ARTICLE_HTML_SANITIZER_VERSION,
      instrumentation: {
        onCoreSanitizerRun: () => {
          coreSanitizerRuns += 1;
        },
        onDomCreated: () => {
          domsCreated += 1;
        },
      },
    });

    expect(result.coreSanitizerRan).toBe(false);
    expect(coreSanitizerRuns).toBe(0);
    expect(domsCreated).toBe(1);
    expect(result.html).toContain("<h1>Title</h1>");
  });

  test("current-version and full paths produce identical output for an already-sanitized fixture", () => {
    const full = processArticleHtml(CLEAN_HTML, { sanitizerVersion: null });
    const fast = processArticleHtml(full.html, { sanitizerVersion: full.sanitizerVersion });
    expect(fast.html).toBe(full.html);
    expect(fast.text).toBe(full.text);
  });

  test("still normalizes URLs, strips carousels, and extracts text on the current-version fast path", () => {
    const html =
      '<article><p><a href="/relative">link</a></p><ul><li>•</li><li>•</li></ul></article>';
    const result = processArticleHtml(html, {
      sanitizerVersion: ARTICLE_HTML_SANITIZER_VERSION,
      baseUrl: "https://example.com/post",
    });
    expect(result.html).toContain('href="https://example.com/relative"');
    expect(result.html).not.toContain("<ul");
    expect(result.text).toContain("link");
  });

  test("strips leading redundant metadata using title/byline/excerpt on both paths", () => {
    const html = "<article><h1>My Title</h1><p>By Jane Doe</p><p>Body content here.</p></article>";
    const full = processArticleHtml(html, {
      sanitizerVersion: null,
      title: "My Title",
      byline: "Jane Doe",
    });
    expect(full.html).not.toContain("My Title");
    expect(full.html).not.toContain("Jane Doe");
    expect(full.html).toContain("Body content here.");
  });
});

describe("buildExtractedReaderViewFromDb sanitizer-version trust", () => {
  test("a null historical sanitizer version still fully sanitizes stored extracted HTML", () => {
    const reader = buildExtractedReaderViewFromDb({
      articleType: "feed",
      title: "T",
      summary: null,
      contentBaseUrl: "https://example.com/post",
      extractedContentHtml: '<article><p onclick="alert(1)">Intro</p></article>',
      extractedContentText: null,
      extractedContentStatus: "ready",
      extractedContentSanitizerVersion: null,
    });
    expect(reader?.contentHtml).not.toContain("onclick");
  });

  test("a current stored sanitizer version skips re-sanitizing already-safe HTML", () => {
    const reader = buildExtractedReaderViewFromDb({
      articleType: "feed",
      title: "T",
      summary: null,
      contentBaseUrl: "https://example.com/post",
      extractedContentHtml: "<article><p>Already clean.</p></article>",
      extractedContentText: null,
      extractedContentStatus: "ready",
      extractedContentSanitizerVersion: ARTICLE_HTML_SANITIZER_VERSION,
    });
    expect(reader?.contentHtml).toContain("Already clean.");
  });
});

describe("compiler hints on the read path", () => {
  const HINTED =
    '<pre data-kyomi-lang="ts"><code>x</code></pre><p><a href="#kyomi-fn-1">1</a></p><p id="kyomi-fn-1">Note</p>';

  function storedFeedInput(contentHtml: string, contentSanitizerVersion: string | null) {
    return {
      articleType: "feed" as const,
      title: "Article",
      summary: null,
      contentBaseUrl: "https://example.com/posts/entry",
      legacyContent: null,
      contentHtml,
      contentSanitizerVersion,
      contentText: null,
      contentMarkdown: null,
      contentStatus: "ready" as const,
      contentSource: "feed_html" as const,
      extractionErrorCode: null,
      extractionErrorMessage: null,
    };
  }

  test("the full path strips hints unless the caller trusts them", () => {
    expect(processArticleHtml(HINTED, { sanitizerVersion: null }).html).not.toContain("data-kyomi");
    expect(
      processArticleHtml(HINTED, { sanitizerVersion: null, trustCompilerHints: true }).html,
    ).toContain('data-kyomi-lang="ts"');
  });

  test("the current-version fast path keeps hints", () => {
    const html = processArticleHtml(HINTED, {
      sanitizerVersion: ARTICLE_HTML_SANITIZER_VERSION,
    }).html;

    expect(html).toContain('data-kyomi-lang="ts"');
    expect(html).toContain('<a href="#kyomi-fn-1">1</a>');
  });

  test("stored reader content trusts hints only on rows stored at the current version", () => {
    const compiled = compileArticleHtml(
      '<div class="language-ts"><pre><code>x</code></pre></div><iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe>',
      { baseUrl: "https://example.com/posts/entry" },
    ).html;

    const current = buildStoredReaderContent(
      storedFeedInput(compiled, ARTICLE_HTML_SANITIZER_VERSION),
    );
    const legacy = buildStoredReaderContent(storedFeedInput(compiled, null));

    expect(current.contentHtml).toContain('data-kyomi-lang="ts"');
    expect(current.contentHtml).toContain('data-kyomi-embed="youtube"');
    expect(legacy.contentHtml).not.toContain("data-kyomi");
  });

  test("reads never run the compiler", () => {
    const stored = buildStoredReaderContent(
      storedFeedInput(
        '<p>Video</p><iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe><img src="data:image/gif;base64,R0" data-src="/a.png" alt="">',
        ARTICLE_HTML_SANITIZER_VERSION,
      ),
    );

    expect(stored.contentHtml).not.toContain("data-kyomi-embed");
    expect(stored.contentHtml).not.toContain("/a.png");
  });
});
