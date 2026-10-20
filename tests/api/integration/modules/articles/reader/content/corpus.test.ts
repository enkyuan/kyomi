import { describe, expect, test } from "bun:test";
import { readdir } from "node:fs/promises";
import { sanitizeArticleHtml } from "@modules/articles/reader/content";
import { compileArticleHtml } from "@kyomi/worker/document";
import { ARTICLE_HTML_SANITIZER_VERSION } from "@kyomi/worker/sanitization";
import {
  baselineUrl,
  buildCorpusReport,
  CORPUS_DIR,
  evaluateChecks,
  loadCorpusManifest,
  readFixtureHtml,
  UPDATE_CORPUS_ENV,
  type CorpusFixture,
} from "./corpus";

const fixtures = await loadCorpusManifest();
const shouldUpdate = process.env[UPDATE_CORPUS_ENV] === "1";

/** What a client receives for a feed item: the ingest compile, then the read pass. */
function renderFeedItem(fixture: CorpusFixture, raw: string): string {
  const stored = compileArticleHtml(raw, { baseUrl: fixture.baseUrl }).html;
  return sanitizeArticleHtml(stored, {
    baseUrl: fixture.baseUrl,
    title: fixture.title,
    byline: null,
    excerpt: null,
  });
}

const rendered = await Promise.all(
  fixtures.map(async (fixture) => {
    const html = renderFeedItem(fixture, await readFixtureHtml(fixture.name));
    return { fixture, html, checks: evaluateChecks(html, fixture.checks) };
  }),
);

const report = buildCorpusReport(
  ARTICLE_HTML_SANITIZER_VERSION,
  rendered.map(({ fixture, checks }) => ({ name: fixture.name, checks })),
);

if (shouldUpdate) {
  for (const { fixture, html } of rendered) {
    await Bun.write(
      baselineUrl(ARTICLE_HTML_SANITIZER_VERSION, `${fixture.name}.html`),
      `${html}\n`,
    );
  }
  await Bun.write(
    baselineUrl(ARTICLE_HTML_SANITIZER_VERSION, "report.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );
}

describe("articles.reader.content corpus", () => {
  test("manifest lists every fixture file exactly once with unique check ids", async () => {
    const files = (await readdir(new URL("html/", CORPUS_DIR)))
      .filter((file) => file.endsWith(".html"))
      .map((file) => file.slice(0, -".html".length))
      .sort();

    expect(fixtures.map((fixture) => fixture.name).sort()).toEqual(files);
    for (const fixture of fixtures) {
      const ids = fixture.checks.map((check) => check.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  test(`fidelity report matches the recorded ${ARTICLE_HTML_SANITIZER_VERSION} baseline`, async () => {
    const recorded = Bun.file(baselineUrl(ARTICLE_HTML_SANITIZER_VERSION, "report.json"));
    if (!(await recorded.exists())) {
      throw new Error(
        `No corpus baseline for ${ARTICLE_HTML_SANITIZER_VERSION}. Record one with ${UPDATE_CORPUS_ENV}=1.`,
      );
    }
    expect(report).toEqual(await recorded.json());
  });

  test.each(fixtures.map((fixture) => fixture.name))(
    "%s output matches the recorded baseline",
    async (name) => {
      const entry = rendered.find(({ fixture }) => fixture.name === name);
      const baseline = await Bun.file(
        baselineUrl(ARTICLE_HTML_SANITIZER_VERSION, `${name}.html`),
      ).text();
      expect(`${entry?.html}\n`).toBe(baseline);
    },
  );
});
