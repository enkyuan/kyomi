import { describe, expect, test } from "bun:test";
import { ARTICLE_COMPILER_VERSION, compileArticleDocument } from "@kyomi/worker/document";
import { readerDocumentSchema } from "@kyomi/reader/document";
import { loadCorpusManifest, readFixtureHtml, UPDATE_CORPUS_ENV } from "./corpus";
import {
  buildDocumentReport,
  documentBaselineUrl,
  scoreDocument,
  stableDocument,
  type DocumentExpectation,
  type DocumentFixtureReport,
} from "./corpus-document";

const fixtures = (await loadCorpusManifest()) as (Awaited<
  ReturnType<typeof loadCorpusManifest>
>[number] & {
  document?: DocumentExpectation;
})[];
const shouldUpdate = process.env[UPDATE_CORPUS_ENV] === "1";

const compiled = await Promise.all(
  fixtures.map(async (fixture) => {
    const result = await compileArticleDocument({
      body: await readFixtureHtml(fixture.name),
      origin: "feed_html",
      baseUrl: fixture.baseUrl,
      meta: { title: fixture.title },
    });
    return { fixture, result };
  }),
);

const reports: Record<string, DocumentFixtureReport> = {};
for (const { fixture, result } of compiled) {
  reports[fixture.name] = scoreDocument(
    result.html,
    result.document,
    result.diagnostics.warnings,
    fixture.title,
    fixture.document ?? { elements: {}, htmlBlocks: 0 },
  );
}
const report = buildDocumentReport(ARTICLE_COMPILER_VERSION, 1, reports);

if (shouldUpdate) {
  for (const { fixture, result } of compiled) {
    await Bun.write(
      documentBaselineUrl(ARTICLE_COMPILER_VERSION, `${fixture.name}.json`),
      `${JSON.stringify(stableDocument(result.document!), null, 2)}\n`,
    );
  }
  await Bun.write(
    documentBaselineUrl(ARTICLE_COMPILER_VERSION, "report.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );
}

describe("articles.reader.content corpus: document", () => {
  test("every fixture declares its authored element counts", () => {
    for (const fixture of fixtures) {
      expect(fixture.document, fixture.name).toBeDefined();
    }
  });

  test("every fixture compiles to a schema-valid document with no warnings", () => {
    for (const { fixture, result } of compiled) {
      expect(result.diagnostics.warnings, fixture.name).toEqual([]);
      expect(readerDocumentSchema.safeParse(result.document).success, fixture.name).toBe(true);
    }
  });

  test("html escape-hatch blocks match the authored allowance", () => {
    for (const fixture of fixtures) {
      expect(reports[fixture.name]?.htmlBlocks, fixture.name).toBe(
        fixture.document?.htmlBlocks ?? 0,
      );
    }
    expect(report.summary.htmlBlocks).toBe(0);
  });

  test("every authored element is present in the document", () => {
    for (const fixture of fixtures) {
      for (const [type, { expected, actual }] of Object.entries(reports[fixture.name]!.elements)) {
        expect(actual, `${fixture.name} ${type}`).toBe(expected);
      }
    }
    expect(report.summary.elementRecall).toBe(1);
  });

  test("text recall and reading order stay above the floor", () => {
    expect(report.summary.textRecall).toBeGreaterThanOrEqual(0.97);
    expect(report.summary.order).toBeGreaterThanOrEqual(0.97);
    for (const fixture of fixtures) {
      expect(reports[fixture.name]!.textRecall, fixture.name).toBeGreaterThanOrEqual(0.95);
      // Sidenotes move from the sentence to the footnote list, which costs order by design.
      expect(reports[fixture.name]!.order, fixture.name).toBeGreaterThanOrEqual(0.7);
    }
  });

  test(`report matches the recorded ${ARTICLE_COMPILER_VERSION} baseline`, async () => {
    const recorded = Bun.file(documentBaselineUrl(ARTICLE_COMPILER_VERSION, "report.json"));
    if (!(await recorded.exists())) {
      throw new Error(
        `No document baseline for ${ARTICLE_COMPILER_VERSION}. Record one with ${UPDATE_CORPUS_ENV}=1.`,
      );
    }
    expect(report).toEqual(await recorded.json());
  });

  test.each(fixtures.map((fixture) => fixture.name))(
    "%s document matches the recorded baseline",
    async (name) => {
      const entry = compiled.find(({ fixture }) => fixture.name === name)!;
      // Compared as data: the formatter may reflow the recorded JSON.
      const baseline = await Bun.file(
        documentBaselineUrl(ARTICLE_COMPILER_VERSION, `${name}.json`),
      ).json();
      expect(stableDocument(entry.result.document!)).toEqual(baseline);
    },
  );
});
