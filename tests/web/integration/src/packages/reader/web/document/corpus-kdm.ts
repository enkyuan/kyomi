import type { ReaderBlock, ReaderDocument } from "@kyomi/reader/document";
import { documentOf, text } from "./fixtures";

const p = (...children: Extract<ReaderBlock, { type: "paragraph" }>["children"]): ReaderBlock => ({
  type: "paragraph",
  children,
});
const cell = (
  value: string,
  extra: { header?: boolean; colSpan?: number; rowSpan?: number } = {},
) => ({
  header: extra.header ?? false,
  ...(extra.colSpan ? { colSpan: extra.colSpan } : {}),
  ...(extra.rowSpan ? { rowSpan: extra.rowSpan } : {}),
  children: [p(text(value))],
});

const WP = "https://blog.wp.example/wp-content/uploads/2026/10";

/** What the compiler is specified to produce for `corpus/html/wordpress-gutenberg.html`. */
export const wordpressGutenbergKdm: ReaderDocument = documentOf(
  [
    p(
      text("Offline sync shipped this week. The client now keeps a "),
      { type: "format", format: "strong", children: [text("local journal")] },
      text(" of every edit, replays it when the network returns, and marks "),
      { type: "format", format: "emphasis", children: [text("conflicted")] },
      text(" rows instead of overwriting them. The old "),
      { type: "format", format: "strike", children: [text("last-write-wins")] },
      text(" policy is gone."),
    ),
    {
      type: "figure",
      placement: "wide",
      image: {
        src: `${WP}/sync-diagram-1024x576.png`,
        alt: "Diagram of the sync journal",
        width: 1024,
        height: 576,
      },
      caption: [
        text("Edits flow from the local journal to the server, then fan out to other devices."),
      ],
    },
    { type: "heading", level: 2, anchor: "what-changed", children: [text("What changed")] },
    {
      type: "gallery",
      placement: "content",
      layout: "grid",
      caption: [text("Saving before and after the journal.")],
      items: [
        {
          image: {
            src: `${WP}/before.png`,
            alt: "Before: a spinner on every save",
            width: 800,
            height: 600,
          },
        },
        {
          image: {
            src: `${WP}/after.png`,
            alt: "After: saves appear instantly",
            width: 800,
            height: 600,
          },
        },
      ],
    },
    {
      type: "mediaText",
      mediaPosition: "start",
      image: { src: `${WP}/team.jpg`, alt: "The sync team", width: 600, height: 600 },
      children: [p(text("Three people built this over two quarters, mostly by deleting code."))],
    },
    {
      type: "pullQuote",
      children: [text("The fastest request is the one you never wait for.")],
      attribution: [text("Sync team notes")],
    },
    {
      type: "code",
      value: "npm run sync -- --dry-run",
      language: "bash",
      languageSource: "explicit",
      label: "Bash",
    },
    p(
      text("Conflict handling follows the approach in our earlier post"),
      { type: "footnoteRef", id: "f1a2", label: "1" },
      text("."),
    ),
  ],
  {
    source: {
      format: "html",
      origin: "extracted_html",
      baseUrl: "https://blog.wp.example/2026/10/offline-sync/",
    },
    footnotes: [
      {
        id: "f1a2",
        label: "1",
        presentation: "footnote",
        children: [p(text("See the March post on vector clocks."))],
      },
    ],
  },
);

/** What the compiler is specified to produce for `corpus/html/data-tables.html`. */
export const dataTablesKdm: ReaderDocument = documentOf(
  [
    p(text("Revenue grew in every region except the west.")),
    {
      type: "table",
      caption: [text("Q3 revenue by region, in thousands")],
      head: [
        [
          cell("Region", { header: true, rowSpan: 2 }),
          cell("Revenue", { header: true, colSpan: 2 }),
        ],
        [cell("2025", { header: true }), cell("2026", { header: true })],
      ],
      body: [
        [cell("North", { header: true }), cell("1,204"), cell("1,388")],
        [cell("South", { header: true }), cell("986"), cell("1,102")],
        [cell("West", { header: true }), cell("910"), cell("870")],
      ],
      foot: [[cell("Total", { header: true }), cell("3,100"), cell("3,360")]],
    },
    p(text("Notes on the regions:")),
    {
      type: "table",
      head: [[cell("Region", { header: true }), cell("Notes", { header: true })]],
      body: [
        [
          cell("West"),
          {
            header: false,
            children: [
              {
                type: "list",
                ordered: false,
                items: [
                  { checked: null, children: [p(text("Lost one large account."))] },
                  { checked: null, children: [p(text("Pipeline recovering."))] },
                ],
              },
            ],
          },
        ],
        [
          cell("North"),
          {
            header: false,
            children: [
              p({
                type: "image",
                image: {
                  src: "https://blog.wp.example/charts/north-sparkline.png",
                  alt: "North trend",
                  width: 120,
                  height: 24,
                },
              }),
            ],
          },
        ],
      ],
    },
  ],
  {
    source: {
      format: "html",
      origin: "extracted_html",
      baseUrl: "https://blog.wp.example/2026/10/offline-sync/",
    },
  },
);
