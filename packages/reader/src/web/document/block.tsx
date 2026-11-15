"use client";

import { cn } from "@kyomi/ui/lib/utils";
import { Fragment, type ComponentType } from "react";
import type { ReaderBlock, ReaderTableCell } from "../../core/document";
import { normalizeSafeHttpUrl } from "../../core/url";
import { RenderHtml } from "../html";
import { CodeBlock } from "./code";
import { useDocumentContext } from "./context";
import { EmbedBlock, LinkCardBlock } from "./embed";
import { DocumentImage } from "./image";
import { Inlines } from "./inline";
import { anchorId, inlinesToText, scrollToAnchor } from "./lib";
import { Audio, Figure, Gallery, Video } from "./media";
import { BlockMath } from "./math";

type BlockOf<T extends ReaderBlock["type"]> = Extract<ReaderBlock, { type: T }>;

const HEADINGS = { 2: "h2", 3: "h3", 4: "h4", 5: "h5", 6: "h6" } as const;

const CALLOUT_ACCENTS: Record<BlockOf<"callout">["variant"], string> = {
  note: "border-info",
  tip: "border-success",
  important: "border-foreground/50",
  warning: "border-warning",
  caution: "border-destructive",
};

function Heading({ block, id }: { block: BlockOf<"heading">; id: string | undefined }) {
  const Tag = HEADINGS[block.level as keyof typeof HEADINGS] ?? "h6";
  return (
    <Tag className="group relative scroll-mt-20" id={id}>
      {id ? (
        <a
          aria-label="Link to this section"
          className="absolute top-0 -left-[1.1em] font-normal text-muted-foreground no-underline opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
          data-reader-heading-anchor=""
          href={`#${id}`}
          onClick={(event) => scrollToAnchor(event, id)}
        >
          #
        </a>
      ) : null}
      <Inlines nodes={block.children} />
    </Tag>
  );
}

/** A lone paragraph is unwrapped so tight list items and cells keep inline rhythm. */
function Flow({ blocks }: { blocks: ReaderBlock[] }) {
  const [only] = blocks;
  if (blocks.length === 1 && only?.type === "paragraph") {
    return <Inlines nodes={only.children} />;
  }
  return <Blocks blocks={blocks} />;
}

function Cell({ cell, scope }: { cell: ReaderTableCell; scope: "col" | "row" }) {
  const Tag = cell.header ? "th" : "td";
  return (
    <Tag
      align={cell.align === "start" ? undefined : cell.align === "end" ? "right" : cell.align}
      colSpan={cell.colSpan}
      rowSpan={cell.rowSpan}
      scope={cell.header ? scope : undefined}
    >
      <Flow blocks={cell.children} />
    </Tag>
  );
}

function Rows({ rows, scope }: { rows: ReaderTableCell[][]; scope: "col" | "row" }) {
  return (
    <>
      {rows.map((row, rowIndex) => (
        <tr key={rowIndex}>
          {row.map((cell, cellIndex) => (
            <Cell cell={cell} key={cellIndex} scope={scope} />
          ))}
        </tr>
      ))}
    </>
  );
}

function Table({ block, id }: { block: BlockOf<"table">; id: string | undefined }) {
  const label = inlinesToText(block.caption).trim();
  return (
    <div
      aria-label={label || "Table"}
      className="overflow-x-auto overscroll-x-contain focus-visible:outline-2 focus-visible:outline-ring"
      data-reader-table=""
      id={id}
      role="region"
      tabIndex={0}
    >
      <table>
        {block.caption ? (
          <caption>
            <Inlines nodes={block.caption} />
          </caption>
        ) : null}
        {block.head.length > 0 ? (
          <thead>
            <Rows rows={block.head} scope="col" />
          </thead>
        ) : null}
        <tbody>
          <Rows rows={block.body} scope="row" />
        </tbody>
        {block.foot && block.foot.length > 0 ? (
          <tfoot>
            <Rows rows={block.foot} scope="row" />
          </tfoot>
        ) : null}
      </table>
    </div>
  );
}

function List({ block, id }: { block: BlockOf<"list">; id: string | undefined }) {
  const Tag = block.ordered ? "ol" : "ul";
  return (
    <Tag id={id} start={block.ordered ? block.start : undefined}>
      {block.items.map((item, index) => (
        <li
          data-kyomi-checked={item.checked === null ? undefined : String(item.checked)}
          key={index}
        >
          <Flow blocks={item.children} />
        </li>
      ))}
    </Tag>
  );
}

function MediaText({ block, id }: { block: BlockOf<"mediaText">; id: string | undefined }) {
  return (
    <div
      className={cn(block.mediaPosition === "end" && "flex-row-reverse")}
      data-reader-media-aside=""
      id={id}
    >
      <DocumentImage image={block.image} />
      <div className="min-w-0 flex-1">
        <Blocks blocks={block.children} />
      </div>
    </div>
  );
}

/** `html` blocks go through the same sanitize-and-enhance path as an HTML-bodied article. */
function HtmlBlock({ block }: { block: BlockOf<"html"> }) {
  const { baseUrl, openLinksInNewTab, showLinkPreviews, imageLoading, transformImageUrl } =
    useDocumentContext();
  return (
    <div data-reader-html-block="" id={block.anchor ? anchorId(block.anchor) : undefined}>
      <RenderHtml
        baseUrl={baseUrl}
        html={block.html}
        imageLoading={imageLoading}
        layoutMode="fidelity"
        openLinksInNewTab={openLinksInNewTab}
        showLinkPreviews={showLinkPreviews}
        transformImageUrl={transformImageUrl}
      />
    </div>
  );
}

function Quote({ block, id }: { block: BlockOf<"quote">; id: string | undefined }) {
  const cite = block.citeUrl ? normalizeSafeHttpUrl(block.citeUrl) : null;
  return (
    <blockquote cite={cite ?? undefined} id={id}>
      <Blocks blocks={block.children} />
      {block.attribution ? (
        <footer>
          <Inlines nodes={block.attribution} />
        </footer>
      ) : null}
    </blockquote>
  );
}

function PullQuote({ block, id }: { block: BlockOf<"pullQuote">; id: string | undefined }) {
  return (
    <blockquote data-reader-pull-quote="" id={id}>
      <p>
        <Inlines nodes={block.children} />
      </p>
      {block.attribution ? (
        <footer>
          <Inlines nodes={block.attribution} />
        </footer>
      ) : null}
    </blockquote>
  );
}

function Callout({ block, id }: { block: BlockOf<"callout">; id: string | undefined }) {
  return (
    <aside
      className={cn("border-s-2", CALLOUT_ACCENTS[block.variant])}
      data-reader-callout={block.variant}
      id={id}
    >
      {block.title ? (
        <p className="font-semibold">
          <Inlines nodes={block.title} />
        </p>
      ) : null}
      <Blocks blocks={block.children} />
    </aside>
  );
}

function Details({ block, id }: { block: BlockOf<"details">; id: string | undefined }) {
  return (
    <details id={id} open={block.open || undefined}>
      <summary>
        <Inlines nodes={block.summary} />
      </summary>
      <Blocks blocks={block.children} />
    </details>
  );
}

function DefinitionList({
  block,
  id,
}: {
  block: BlockOf<"definitionList">;
  id: string | undefined;
}) {
  return (
    <dl id={id}>
      {block.items.map((item, index) => (
        <Fragment key={index}>
          {item.terms.map((term, termIndex) => (
            <dt key={termIndex}>
              <Inlines nodes={term} />
            </dt>
          ))}
          {item.definitions.map((definition, definitionIndex) => (
            <dd key={definitionIndex}>
              <Flow blocks={definition} />
            </dd>
          ))}
        </Fragment>
      ))}
    </dl>
  );
}

type BlockProps<T extends ReaderBlock["type"]> = { block: BlockOf<T>; id: string | undefined };

function Paragraph({ block, id }: BlockProps<"paragraph">) {
  return (
    <p id={id}>
      <Inlines nodes={block.children} />
    </p>
  );
}

function Divider({ id }: BlockProps<"divider">) {
  return <hr id={id} />;
}

function MathBlock({ block }: BlockProps<"math">) {
  return <BlockMath math={block} />;
}

/** One component per block type; the mapped type makes a new KDM block a compile error here. */
const BLOCK_COMPONENTS: { [T in ReaderBlock["type"]]: ComponentType<BlockProps<T>> } = {
  paragraph: Paragraph,
  heading: Heading,
  list: List,
  quote: Quote,
  pullQuote: PullQuote,
  divider: Divider,
  code: CodeBlock,
  math: MathBlock,
  table: Table,
  figure: Figure,
  gallery: Gallery,
  video: Video,
  audio: Audio,
  embed: EmbedBlock,
  linkCard: LinkCardBlock,
  callout: Callout,
  details: Details,
  definitionList: DefinitionList,
  mediaText: MediaText,
  html: HtmlBlock,
};

function BlockNode({ block }: { block: ReaderBlock }) {
  const id = "anchor" in block && block.anchor ? anchorId(block.anchor) : undefined;
  const Component = BLOCK_COMPONENTS[block.type] as ComponentType<{
    block: ReaderBlock;
    id: string | undefined;
  }>;
  return <Component block={block} id={id} />;
}

export function Blocks({ blocks }: { blocks: readonly ReaderBlock[] }) {
  return (
    <>
      {blocks.map((block, index) => (
        <BlockNode block={block} key={index} />
      ))}
    </>
  );
}
