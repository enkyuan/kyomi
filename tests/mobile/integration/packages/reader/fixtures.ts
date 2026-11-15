import type { ReaderBlock, ReaderDocument } from "../../../../../packages/reader/src/core/document";

const img = (name: string, extra: Record<string, unknown> = {}) => ({
  src: `https://example.com/${name}.jpg`,
  alt: `${name} alt`,
  ...extra,
});

const t = (value: string) => ({ type: "text" as const, value });

export const blocksByType = {
  paragraph: {
    type: "paragraph",
    children: [
      t("Plain "),
      { type: "format", format: "strong", children: [t("bold")] },
      t(" and "),
      { type: "format", format: "emphasis", children: [t("italic")] },
      t(" with a "),
      { type: "link", href: "https://example.com/a", children: [t("link")] },
      t(" and note"),
      { type: "footnoteRef", id: "fn-1", label: "1" },
      t(" H"),
      { type: "format", format: "subscript", children: [t("2")] },
      t("O x"),
      { type: "format", format: "superscript", children: [t("2")] },
      { type: "break" },
      { type: "code", value: "inline()" },
    ],
  },
  heading: { type: "heading", level: 2, anchor: "intro", children: [t("Intro")] },
  list: {
    type: "list",
    ordered: true,
    start: 3,
    items: [
      { checked: null, children: [{ type: "paragraph", children: [t("third")] }] },
      { checked: true, children: [{ type: "paragraph", children: [t("done task")] }] },
      { checked: false, children: [{ type: "paragraph", children: [t("open task")] }] },
    ],
  },
  quote: {
    type: "quote",
    attribution: [t("Someone")],
    children: [{ type: "paragraph", children: [t("Quoted text")] }],
  },
  pullQuote: { type: "pullQuote", children: [t("Pulled")], attribution: [t("Them")] },
  divider: { type: "divider" },
  code: {
    type: "code",
    value: "const a = 1;\nconst b = 2;",
    language: "typescript",
    languageSource: "explicit",
    label: "TypeScript",
    filename: "a.ts",
    highlightLines: [2],
    highlight: {
      engine: "test",
      styles: [{}, { light: "#ff0000", dark: "#00ff00", fontStyle: 3 }],
      lines: [
        [
          ["const", 1],
          [" a = 1;", 0],
        ],
        [
          ["const", 1],
          [" b = 2;", 0],
        ],
      ],
    },
  },
  math: { type: "math", tex: "E=mc^2", rendered: '<span class="katex">E</span>' },
  table: {
    type: "table",
    caption: [t("Table caption")],
    head: [[{ header: true, children: [{ type: "paragraph", children: [t("Name")] }] }]],
    body: [
      [
        {
          header: false,
          colSpan: 2,
          children: [
            { type: "paragraph", children: [t("cell one")] },
            { type: "paragraph", children: [t("cell two")] },
          ],
        },
      ],
    ],
  },
  figure: {
    type: "figure",
    placement: "wide",
    image: img("photo", { width: 800, height: 400, placeholder: "YTkGJwaRhWUIt4lbgnhHdJR3dg==" }),
    caption: [t("Figure caption")],
    credit: [t("Credit line")],
  },
  gallery: {
    type: "gallery",
    placement: "content",
    layout: "grid",
    items: [{ image: img("g1", { width: 10, height: 10 }) }, { image: img("g2") }],
    caption: [t("Gallery caption")],
  },
  video: {
    type: "video",
    placement: "content",
    sources: [{ url: "https://example.com/v.mp4", mimeType: "video/mp4" }],
    poster: "https://example.com/poster.jpg",
    width: 1280,
    height: 720,
  },
  audio: {
    type: "audio",
    sources: [{ url: "https://example.com/a.mp3" }],
    title: "Episode 1",
  },
  embed: {
    type: "embed",
    provider: "bluesky",
    placement: "content",
    url: "https://bsky.app/profile/a/post/1",
    snapshot: {
      text: [t("Snapshot post text")],
      author: { name: "Ada", handle: "@ada" },
      fetchedAt: "2026-10-20T00:00:00.000Z",
    },
  },
  linkCard: {
    type: "linkCard",
    url: "https://example.com/card",
    title: "Card title",
    description: "Card description",
    siteName: "Example",
  },
  callout: {
    type: "callout",
    variant: "warning",
    title: [t("Heads up")],
    children: [{ type: "paragraph", children: [t("Callout body")] }],
  },
  details: {
    type: "details",
    summary: [t("More")],
    open: true,
    children: [{ type: "paragraph", children: [t("Hidden body")] }],
  },
  definitionList: {
    type: "definitionList",
    items: [
      { terms: [[t("Term")]], definitions: [[{ type: "paragraph", children: [t("Definition")] }]] },
    ],
  },
  mediaText: {
    type: "mediaText",
    mediaPosition: "start",
    image: img("side", { width: 400, height: 300 }),
    children: [{ type: "paragraph", children: [t("Beside the picture")] }],
  },
  html: { type: "html", html: "<marquee>odd</marquee>", reason: "unsupported-element" },
} satisfies Record<ReaderBlock["type"], ReaderBlock>;

export function makeDocument(
  blocks: ReaderBlock[],
  footnotes: ReaderDocument["footnotes"] = [],
): unknown {
  return {
    version: 1,
    source: { format: "html", origin: "feed_html", baseUrl: "https://example.com/" },
    compiler: { version: "test", sanitizerVersion: "test" },
    meta: {
      title: "Fixture",
      subtitle: null,
      authors: [],
      siteName: null,
      language: "en",
      direction: "ltr",
      publishedAt: null,
      updatedAt: null,
      wordCount: 10,
      readingMinutes: 1,
      leadImage: null,
    },
    features: { math: true, codeLanguages: ["typescript"], embedProviders: ["bluesky"] },
    blocks,
    footnotes,
    diagnostics: { droppedElements: {}, htmlBlocks: 1, warnings: [] },
  };
}

export const footnoteFixture: ReaderDocument["footnotes"] = [
  {
    id: "fn-1",
    label: "1",
    presentation: "footnote",
    children: [{ type: "paragraph", children: [t("Footnote body")] }],
  },
];

export function longDocument(paragraphs: number): unknown {
  const blocks: ReaderBlock[] = [];
  for (let i = 0; i < paragraphs; i++) {
    if (i % 25 === 0) {
      blocks.push({ type: "heading", level: 2, anchor: `h-${i}`, children: [t(`Section ${i}`)] });
    }
    blocks.push({ type: "paragraph", children: [t(`Paragraph ${i} `.repeat(30))] });
  }
  return makeDocument(blocks);
}
