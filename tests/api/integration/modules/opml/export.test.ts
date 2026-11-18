import { describe, expect, test } from "bun:test";
import { Effect, Layer } from "effect";
import { TestClock } from "effect/testing";
import { buildOpmlExportDocument, exportOpmlForUser } from "@modules/opml/export";
import { parseOpmlDocument as parseOpmlDocumentEffect } from "@modules/opml/parse";
import { fakeDb } from "@api-tests/support/layers";

const generatedAt = new Date("2026-05-25T18:00:00.000Z");
const parseOpmlDocument = (xml: string, fallbackFolderName: string) =>
  Effect.runSync(parseOpmlDocumentEffect(xml, fallbackFolderName));

describe("opml export", () => {
  test("builds a valid OPML document that round-trips through the parser", () => {
    const xml = buildOpmlExportDocument(
      [
        {
          title: "Alpha Feed",
          xmlUrl: "https://example.com/alpha.xml",
          htmlUrl: "https://example.com/alpha",
          folderName: "Research",
        },
        {
          title: "Beta Feed",
          xmlUrl: "https://example.com/beta.xml",
          htmlUrl: null,
          folderName: null,
        },
        {
          title: "Gamma Feed",
          xmlUrl: "https://example.com/gamma.xml",
          htmlUrl: "https://example.com/gamma",
          folderName: "Unsorted",
        },
      ],
      { generatedAt },
    );

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<opml version="2.0">');
    expect(xml).toContain("<dateCreated>Mon, 25 May 2026 18:00:00 GMT</dateCreated>");

    const parsed = parseOpmlDocument(xml, "Unsorted");
    expect(parsed.opmlTitle).toBe("kyomi Subscriptions");
    expect(parsed.feeds).toEqual([
      {
        xmlUrl: "https://example.com/beta.xml",
        originalUrl: "https://example.com/beta.xml",
        normalizedUrl: "https://example.com/beta.xml",
        title: "Beta Feed",
        folderName: "Unsorted",
      },
      {
        xmlUrl: "https://example.com/gamma.xml",
        originalUrl: "https://example.com/gamma.xml",
        normalizedUrl: "https://example.com/gamma.xml",
        title: "Gamma Feed",
        folderName: "Unsorted",
      },
      {
        xmlUrl: "https://example.com/alpha.xml",
        originalUrl: "https://example.com/alpha.xml",
        normalizedUrl: "https://example.com/alpha.xml",
        title: "Alpha Feed",
        folderName: "Research",
      },
    ]);
  });

  test("escapes XML-special characters in titles, folders, and URLs", () => {
    const xml = buildOpmlExportDocument(
      [
        {
          title: `Tom & Jerry <Daily> "Quotes" 'Edition'`,
          xmlUrl: "https://example.com/feed?x=1&y=2",
          htmlUrl: "https://example.com/page?caption=Tom&mode=full",
          folderName: `R&D <Lab> "North" 'A'`,
        },
      ],
      { generatedAt },
    );

    expect(xml).toContain("Tom &amp; Jerry &lt;Daily&gt; &quot;Quotes&quot; &#39;Edition&#39;");
    expect(xml).toContain("R&amp;D &lt;Lab&gt; &quot;North&quot; &#39;A&#39;");
    expect(xml).toContain('xmlUrl="https://example.com/feed?x=1&amp;y=2"');
    expect(xml).toContain('htmlUrl="https://example.com/page?caption=Tom&amp;mode=full"');

    const parsed = parseOpmlDocument(xml, "Unsorted");
    expect(parsed.feeds).toEqual([
      {
        xmlUrl: "https://example.com/feed?x=1&y=2",
        originalUrl: "https://example.com/feed?x=1&y=2",
        normalizedUrl: "https://example.com/feed?x=1&y=2",
        title: `Tom & Jerry <Daily> "Quotes" 'Edition'`,
        folderName: `R&D <Lab> "North" 'A'`,
      },
    ]);
  });

  test("is deterministic: folders are grouped once and feeds are sorted stably", () => {
    const xml = buildOpmlExportDocument(
      [
        {
          title: "Zoo",
          xmlUrl: "https://example.com/z.xml",
          htmlUrl: null,
          folderName: "Science",
        },
        {
          title: "Alpha",
          xmlUrl: "https://example.com/a.xml",
          htmlUrl: null,
          folderName: "Science",
        },
        {
          title: "Beta",
          xmlUrl: "https://example.com/b.xml",
          htmlUrl: null,
          folderName: "Arts",
        },
        {
          title: "Root",
          xmlUrl: "https://example.com/root.xml",
          htmlUrl: null,
          folderName: null,
        },
        {
          title: "Gamma",
          xmlUrl: "https://example.com/g.xml",
          htmlUrl: null,
          folderName: "Unsorted",
        },
      ],
      { generatedAt },
    );

    expect(xml.match(/<outline text="Science"/g)?.length).toBe(1);
    expect(xml.indexOf('xmlUrl="https://example.com/root.xml"')).toBeLessThan(
      xml.indexOf('<outline text="Unsorted"'),
    );
    expect(xml.indexOf('<outline text="Unsorted"')).toBeLessThan(
      xml.indexOf('<outline text="Arts"'),
    );
    expect(xml.indexOf('<outline text="Arts"')).toBeLessThan(
      xml.indexOf('<outline text="Science"'),
    );
    expect(xml.indexOf('xmlUrl="https://example.com/a.xml"')).toBeLessThan(
      xml.indexOf('xmlUrl="https://example.com/z.xml"'),
    );
  });

  test("falls back to xmlUrl when title is blank and emits an empty body for zero feeds", () => {
    const emptyXml = buildOpmlExportDocument([], { generatedAt });
    expect(emptyXml).toContain("<body></body>");

    const titledXml = buildOpmlExportDocument(
      [
        {
          title: "   ",
          xmlUrl: "https://example.com/fallback.xml",
          htmlUrl: null,
          folderName: null,
        },
      ],
      { generatedAt },
    );
    expect(titledXml).toContain('text="https://example.com/fallback.xml"');

    const parsed = parseOpmlDocument(titledXml, "Unsorted");
    expect(parsed.feeds[0]).toEqual({
      xmlUrl: "https://example.com/fallback.xml",
      originalUrl: "https://example.com/fallback.xml",
      normalizedUrl: "https://example.com/fallback.xml",
      title: "https://example.com/fallback.xml",
      folderName: "Unsorted",
    });
  });

  test("queries user subscriptions and returns XML using decoded display titles", async () => {
    const select = () => ({
      from: () => ({
        innerJoin: () => ({
          leftJoin: () => ({
            where: () =>
              Promise.resolve([
                {
                  customTitle: "  My &amp; Feed  ",
                  feedTitle: "Global &amp; Feed",
                  xmlUrl: "https://example.com/feed.xml",
                  htmlUrl: "https://example.com/site",
                  folderName: "Research",
                },
              ]),
          }),
        }),
      }),
    });
    const xml = await Effect.runPromise(
      Effect.gen(function* () {
        yield* TestClock.setTime(generatedAt.getTime());
        return yield* exportOpmlForUser("user-1");
      }).pipe(Effect.provide(Layer.mergeAll(fakeDb({ select }), TestClock.layer()))),
    );

    expect(xml).toContain('text="My &amp; Feed"');
    const parsed = parseOpmlDocument(xml, "Unsorted");
    expect(parsed.feeds).toEqual([
      {
        xmlUrl: "https://example.com/feed.xml",
        originalUrl: "https://example.com/feed.xml",
        normalizedUrl: "https://example.com/feed.xml",
        title: "My & Feed",
        folderName: "Research",
      },
    ]);
  });
});
