import type { ReaderContent } from "@kyomi/reader";

/**
 * Long-article fixture for on-device comparison. Set `EXPO_PUBLIC_KYOMI_READER_FIXTURE=long` and the
 * reader shows this article, as HTML for the DOM path and as KDM for the native path, so both render
 * identical content. Block mix mirrors a long-form essay: prose, headings, lists, a table, code.
 */
export const READER_FIXTURE_ENABLED = process.env.EXPO_PUBLIC_KYOMI_READER_FIXTURE === "long";

const SENTENCE =
  "The quick brown fox jumps over the lazy dog while the reader scrolls steadily through a very long article. ";

function paragraph(index: number): string {
  return `Paragraph ${index}. ${SENTENCE.repeat(3 + (index % 4))}`;
}

export function createLongArticleDocument(paragraphs = 400): Record<string, unknown> {
  const text = (value: string) => ({ type: "text", value });
  const blocks: unknown[] = [];
  for (let i = 0; i < paragraphs; i++) {
    if (i % 20 === 0) {
      blocks.push({
        type: "heading",
        level: 2,
        anchor: `section-${i}`,
        children: [text(`Section ${i / 20 + 1}`)],
      });
    }
    blocks.push({ type: "paragraph", children: [text(paragraph(i))] });
    if (i % 50 === 25) {
      blocks.push({
        type: "list",
        ordered: false,
        items: [0, 1, 2].map((n) => ({
          checked: null,
          children: [{ type: "paragraph", children: [text(`List item ${n} near paragraph ${i}`)] }],
        })),
      });
    }
    if (i % 100 === 50) {
      blocks.push({
        type: "code",
        value: `const value = ${i};\nconsole.log(value);`,
        language: "typescript",
        languageSource: "explicit",
        label: "TypeScript",
      });
    }
    if (i % 100 === 75) {
      blocks.push({
        type: "table",
        head: [
          [
            { header: true, children: [{ type: "paragraph", children: [text("Column")] }] },
            { header: true, children: [{ type: "paragraph", children: [text("Value")] }] },
          ],
        ],
        body: [
          [
            { header: false, children: [{ type: "paragraph", children: [text(`row ${i}`)] }] },
            { header: false, children: [{ type: "paragraph", children: [text(String(i))] }] },
          ],
        ],
      });
    }
  }
  return {
    version: 1,
    source: { format: "html", origin: "feed_html", baseUrl: null },
    compiler: { version: "fixture", sanitizerVersion: "fixture" },
    meta: {
      title: "Long article fixture",
      subtitle: null,
      authors: [],
      siteName: null,
      language: "en",
      direction: "ltr",
      publishedAt: null,
      updatedAt: null,
      wordCount: paragraphs * 60,
      readingMinutes: Math.ceil((paragraphs * 60) / 230),
      leadImage: null,
    },
    features: { math: false, codeLanguages: ["typescript"], embedProviders: [] },
    blocks,
    footnotes: [],
    diagnostics: { droppedElements: {}, htmlBlocks: 0, warnings: [] },
  };
}

export function createLongArticleHtml(paragraphs = 400): string {
  const parts: string[] = [];
  for (let i = 0; i < paragraphs; i++) {
    if (i % 20 === 0) parts.push(`<h2>Section ${i / 20 + 1}</h2>`);
    parts.push(`<p>${paragraph(i)}</p>`);
    if (i % 50 === 25) {
      parts.push(
        `<ul>${[0, 1, 2].map((n) => `<li>List item ${n} near paragraph ${i}</li>`).join("")}</ul>`,
      );
    }
    if (i % 100 === 50) {
      parts.push(`<pre><code>const value = ${i};\nconsole.log(value);</code></pre>`);
    }
    if (i % 100 === 75) {
      parts.push(
        `<table><thead><tr><th>Column</th><th>Value</th></tr></thead><tbody><tr><td>row ${i}</td><td>${i}</td></tr></tbody></table>`,
      );
    }
  }
  return parts.join("\n");
}

export function createLongArticleReader(paragraphs = 400): ReaderContent {
  return {
    bodyKind: "html",
    contentHtml: createLongArticleHtml(paragraphs),
    contentStatus: "ready",
  };
}
