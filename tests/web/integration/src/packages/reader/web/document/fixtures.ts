import type { ReaderBlock, ReaderDocument, ReaderInline } from "@kyomi/reader/document";

/** Hand-written KDM, shaped as the compiler is specified to emit it. */
export const text = (value: string): ReaderInline => ({ type: "text", value });

export function documentOf(
  blocks: ReaderBlock[],
  overrides: Partial<Omit<ReaderDocument, "features">> & {
    features?: Partial<ReaderDocument["features"]>;
  } = {},
): ReaderDocument {
  const { features, ...rest } = overrides;
  return {
    version: 1,
    source: { format: "html", origin: "extracted_html", baseUrl: "https://example.com/post" },
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
      wordCount: 0,
      readingMinutes: 1,
      leadImage: null,
    },
    features: { math: false, codeLanguages: [], embedProviders: [], ...features },
    blocks,
    footnotes: [],
    diagnostics: { droppedElements: {}, htmlBlocks: 0, warnings: [] },
    ...rest,
  };
}

/** One of every block and inline type, so a single parse proves the fixtures match the schema. */
export const everyBlock: ReaderBlock[] = [
  {
    type: "paragraph",
    anchor: "intro",
    children: [
      text("Plain, "),
      {
        type: "format",
        format: "strong",
        children: [
          text("bold "),
          { type: "format", format: "emphasis", children: [text("and italic")] },
        ],
      },
      text(", "),
      { type: "format", format: "strike", children: [text("struck")] },
      text(", "),
      { type: "format", format: "underline", children: [text("underlined")] },
      text(", "),
      { type: "format", format: "insert", children: [text("inserted")] },
      text(", H"),
      { type: "format", format: "subscript", children: [text("2")] },
      text("O and x"),
      { type: "format", format: "superscript", children: [text("2")] },
      text(" "),
      { type: "format", format: "highlight", children: [text("marked")] },
      text(" "),
      { type: "format", format: "small", children: [text("fine print")] },
      text(" "),
      { type: "format", format: "keyboard", children: [text("⌘K")] },
      text(" "),
      { type: "format", format: "cite", children: [text("A Book")] },
      text(" "),
      { type: "format", format: "quote", children: [text("quoted")] },
      text(" "),
      { type: "code", value: "inline()" },
      text(" "),
      { type: "abbr", title: "HyperText Markup Language", children: [text("HTML")] },
      { type: "break" },
      {
        type: "link",
        href: "https://example.org/a",
        title: "Example",
        children: [text("external")],
      },
      text(" "),
      { type: "link", href: "#details", children: [text("jump")] },
      text(" "),
      { type: "math", tex: "x^2", rendered: '<span class="katex">x²</span>' },
      { type: "footnoteRef", id: "note", label: "1" },
      {
        type: "image",
        image: { src: "https://cdn.example/emoji.png", alt: "party", width: 16, height: 16 },
      },
    ],
  },
  { type: "heading", level: 2, anchor: "details", children: [text("Details")] },
  { type: "heading", level: 3, children: [text("No anchor")] },
  {
    type: "list",
    ordered: false,
    items: [
      { checked: null, children: [{ type: "paragraph", children: [text("plain item")] }] },
      { checked: true, children: [{ type: "paragraph", children: [text("done")] }] },
      { checked: false, children: [{ type: "paragraph", children: [text("todo")] }] },
    ],
  },
  {
    type: "list",
    ordered: true,
    start: 3,
    items: [
      {
        checked: null,
        children: [
          { type: "paragraph", children: [text("third")] },
          {
            type: "list",
            ordered: false,
            items: [
              { checked: null, children: [{ type: "paragraph", children: [text("nested")] }] },
            ],
          },
        ],
      },
    ],
  },
  {
    type: "quote",
    citeUrl: "https://example.org/source",
    attribution: [text("Someone")],
    children: [{ type: "paragraph", children: [text("A quoted line.")] }],
  },
  { type: "pullQuote", children: [text("Say it loud.")], attribution: [text("Editor")] },
  { type: "divider" },
  {
    type: "code",
    value: "const a = 1;\nconst b = 2;",
    language: "typescript",
    languageSource: "explicit",
    label: "TypeScript",
    filename: "index.ts",
    highlightLines: [2],
    highlight: {
      engine: "shiki@4.5.0:github-light/github-dark",
      styles: [{}, { light: "#d73a49", dark: "#ff7b72", fontStyle: 1 }],
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
  {
    type: "math",
    tex: "E=mc^2",
    rendered: '<span class="katex-display"><span class="katex">E=mc²</span></span>',
  },
  {
    type: "table",
    caption: [text("Scores")],
    head: [
      [
        { header: true, children: [{ type: "paragraph", children: [text("Name")] }] },
        {
          header: true,
          align: "end",
          children: [{ type: "paragraph", children: [text("Score")] }],
        },
      ],
    ],
    body: [
      [
        { header: true, children: [{ type: "paragraph", children: [text("Ada")] }] },
        {
          header: false,
          align: "end",
          children: [
            { type: "paragraph", children: [text("10")] },
            {
              type: "list",
              ordered: false,
              items: [
                { checked: null, children: [{ type: "paragraph", children: [text("bonus")] }] },
              ],
            },
          ],
        },
      ],
      [
        {
          header: false,
          colSpan: 2,
          children: [{ type: "paragraph", children: [text("merged")] }],
        },
      ],
    ],
    foot: [
      [
        { header: true, children: [{ type: "paragraph", children: [text("Total")] }] },
        { header: false, children: [{ type: "paragraph", children: [text("10")] }] },
      ],
    ],
  },
  {
    type: "figure",
    placement: "wide",
    image: {
      src: "https://cdn.example/a.png",
      alt: "Diagram",
      width: 1024,
      height: 576,
      srcset: [{ url: "https://cdn.example/a@2x.png", width: 2048 }],
    },
    caption: [text("A diagram.")],
    credit: [text("Photo: Someone")],
  },
  {
    type: "gallery",
    placement: "content",
    layout: "grid",
    caption: [text("Before and after.")],
    items: [
      { image: { src: "https://cdn.example/b.png", alt: "Before" }, caption: [text("Before")] },
      { image: { src: "https://cdn.example/c.png", alt: "After" } },
    ],
  },
  {
    type: "gallery",
    placement: "content",
    layout: "carousel",
    items: [
      { image: { src: "https://cdn.example/d.png", alt: "One" } },
      { image: { src: "https://cdn.example/e.png", alt: "Two" } },
    ],
  },
  {
    type: "video",
    placement: "content",
    sources: [{ url: "https://media.example/v.mp4", mimeType: "video/mp4" }],
    poster: "https://media.example/v.jpg",
    caption: [text("A clip.")],
  },
  {
    type: "audio",
    sources: [{ url: "https://media.example/a.mp3", mimeType: "audio/mpeg" }],
    title: "Episode 1",
  },
  {
    type: "embed",
    provider: "youtube",
    placement: "content",
    url: "https://www.youtube.com/watch?v=abcdefghijk",
    providerId: "abcdefghijk",
    frameUrl: "https://www.youtube-nocookie.com/embed/abcdefghijk",
    aspectRatio: 16 / 9,
    caption: [text("A talk.")],
  },
  {
    type: "embed",
    provider: "bluesky",
    placement: "content",
    url: "https://bsky.app/profile/a.example/post/3abc",
    snapshot: {
      text: [text("Snapshot post text.")],
      author: { name: "Ada", handle: "@ada.example" },
      publishedAt: "2026-10-20T12:00:00.000Z",
      fetchedAt: "2026-10-21T12:00:00.000Z",
    },
  },
  {
    type: "embed",
    provider: "tiktok",
    placement: "content",
    url: "https://www.tiktok.com/@a/video/123",
  },
  {
    type: "linkCard",
    url: "https://example.org/story",
    title: "A story",
    description: "Why it matters.",
    siteName: "Example",
    image: { src: "https://cdn.example/card.png", alt: "" },
  },
  {
    type: "callout",
    variant: "warning",
    title: [text("Heads up")],
    children: [{ type: "paragraph", children: [text("Careful.")] }],
  },
  {
    type: "details",
    open: true,
    summary: [text("More")],
    children: [{ type: "paragraph", children: [text("Hidden text.")] }],
  },
  {
    type: "definitionList",
    items: [
      {
        terms: [[text("Term")]],
        definitions: [[{ type: "paragraph", children: [text("Meaning")] }]],
      },
    ],
  },
  {
    type: "mediaText",
    mediaPosition: "end",
    image: { src: "https://cdn.example/team.jpg", alt: "Team" },
    children: [{ type: "paragraph", children: [text("Built by three people.")] }],
  },
  { type: "html", html: "<p>Escape <b>hatch</b></p>", reason: "unsupported-element" },
];

export const everyBlockDocument = documentOf(everyBlock, {
  features: {
    math: true,
    codeLanguages: ["typescript"],
    embedProviders: ["youtube", "bluesky", "tiktok"],
  },
  footnotes: [
    {
      id: "note",
      label: "1",
      presentation: "footnote",
      children: [{ type: "paragraph", children: [text("The footnote text.")] }],
    },
  ],
});
