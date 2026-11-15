import type {
  BlockNode,
  InlineNode,
  ListItemNode,
  TableCellNode,
  TableNode,
} from "@tanstack/markdown";
import { parseMarkdown } from "@tanstack/markdown";
import type { ReaderBlock, ReaderInline, ReaderTableCell } from "@kyomi/reader/document";
import { httpUrl, lowerHtml, lowerInlines, type LowerContext } from "./lower-html";

/** Bare `\(` and `\[` are consumed as escapes by the parser; keep them for the math pass. */
const MARKERS: readonly [string, string][] = [
  [String.raw`\(`, ""],
  [String.raw`\)`, ""],
  [String.raw`\[`, ""],
  [String.raw`\]`, ""],
];
const FOOTNOTE_OPEN = "";
const FOOTNOTE_CLOSE = "";
const ALERT = /^\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/i;

function protectDelimiters(markdown: string): string {
  let value = markdown;
  for (const [source, marker] of MARKERS) {
    value = value.replaceAll(source, `${marker}${source.slice(1)}`);
  }
  return value;
}

function restoreDelimiters(value: string): string {
  let restored = value;
  for (const [source, marker] of MARKERS) {
    restored = restored.replaceAll(`${marker}${source.slice(1)}`, source);
  }
  return restored;
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 54)
    .replace(/-+$/, "");
}

function footnoteAnchor(id: string): string {
  return `kyomi-fn-${slug(id) || "note"}`;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replace(/"/g, "&quot;");
}

/** Serializes inline nodes to HTML so mixed Markdown and raw HTML goes through the HTML passes. */
function inlineToHtml(node: InlineNode): string {
  const inner = (children: InlineNode[]) => children.map(inlineToHtml).join("");
  switch (node.type) {
    case "text":
      return escapeHtml(node.value);
    case "inlineCode":
      return `<code>${escapeHtml(node.value)}</code>`;
    case "strong":
      return `<strong>${inner(node.children)}</strong>`;
    case "emphasis":
      return `<em>${inner(node.children)}</em>`;
    case "strike":
      return `<del>${inner(node.children)}</del>`;
    case "link":
      return `<a href="${escapeAttribute(node.href)}"${node.title ? ` title="${escapeAttribute(node.title)}"` : ""}>${inner(node.children)}</a>`;
    case "image":
      return `<img src="${escapeAttribute(node.src)}" alt="${escapeAttribute(node.alt)}">`;
    case "break":
      return "<br>";
    case "inlineHtml":
      return node.value;
    case "footnoteReference":
      return `${FOOTNOTE_OPEN}${node.id}${FOOTNOTE_CLOSE}`;
  }
}

export type MarkdownLowerOptions = {
  ctx: LowerContext;
  baseUrl: string | null;
  /** Runs raw HTML through the ingest passes and returns the sanitized root. */
  sanitizeFragment: (html: string) => Element;
};

type State = MarkdownLowerOptions & { headingIds: Set<string> };

function resolve(href: string, baseUrl: string | null): string | null {
  try {
    return httpUrl(new URL(href.trim(), baseUrl ?? undefined).href);
  } catch {
    return null;
  }
}

function link(
  href: string,
  title: string | undefined,
  children: ReaderInline[],
  baseUrl: string | null,
): ReaderInline[] {
  const target = href.startsWith("#") ? href : resolve(href, baseUrl);
  return target && children.length > 0
    ? [{ type: "link", href: target, ...(title ? { title } : {}), children }]
    : children;
}

/** Replaces footnote placeholders left by `inlineToHtml` with links to the definition anchor. */
function restorePlaceholders(inlines: ReaderInline[]): ReaderInline[] {
  return inlines.flatMap((inline): ReaderInline[] => {
    if (inline.type === "text") {
      const pieces = inline.value.split(
        new RegExp(`${FOOTNOTE_OPEN}([^${FOOTNOTE_CLOSE}]*)${FOOTNOTE_CLOSE}`),
      );
      return pieces.flatMap((piece, index): ReaderInline[] =>
        index % 2 === 1
          ? [
              {
                type: "link",
                href: `#${footnoteAnchor(piece)}`,
                children: [{ type: "text", value: piece }],
              },
            ]
          : piece
            ? [{ type: "text", value: restoreDelimiters(piece) }]
            : [],
      );
    }
    if ("children" in inline) {
      return [{ ...inline, children: restorePlaceholders(inline.children) } as ReaderInline];
    }
    return [inline];
  });
}

function lowerInline(node: InlineNode, state: State): ReaderInline[] {
  const inner = (children: InlineNode[]) => lowerInlineList(children, state);
  switch (node.type) {
    case "text":
      return node.value ? [{ type: "text", value: restoreDelimiters(node.value) }] : [];
    case "inlineCode":
      return [{ type: "code", value: restoreDelimiters(node.value) }];
    case "strong":
      return [{ type: "format", format: "strong", children: inner(node.children) }];
    case "emphasis":
      return [{ type: "format", format: "emphasis", children: inner(node.children) }];
    case "strike":
      return [{ type: "format", format: "strike", children: inner(node.children) }];
    case "link": {
      const href = node.href.startsWith("#") ? `#kyomi-${slug(node.href.slice(1))}` : node.href;
      return link(href, node.title, inner(node.children), state.baseUrl);
    }
    case "image": {
      const src = resolve(node.src, state.baseUrl);
      return src
        ? [{ type: "image", image: { src, alt: node.alt } }]
        : node.alt
          ? [{ type: "text", value: node.alt }]
          : [];
    }
    case "break":
      return [{ type: "break" }];
    case "footnoteReference":
      return [
        {
          type: "link",
          href: `#${footnoteAnchor(node.id)}`,
          children: [{ type: "text", value: String(node.number) }],
        },
      ];
    case "inlineHtml":
      return [];
  }
}

function lowerInlineList(nodes: InlineNode[], state: State): ReaderInline[] {
  if (!nodes.some((node) => node.type === "inlineHtml")) {
    return nodes.flatMap((node) => lowerInline(node, state));
  }
  const root = state.sanitizeFragment(`<p>${nodes.map(inlineToHtml).join("")}</p>`);
  const paragraph = root.querySelector("p");
  const anchors: string[] = [];
  return restorePlaceholders(
    lowerInlines(Array.from((paragraph ?? root).childNodes), { ctx: state.ctx, anchors }),
  );
}

function lowerCell(
  cell: TableCellNode,
  header: boolean,
  align: TableNode["align"][number],
  state: State,
): ReaderTableCell {
  const inlines = lowerInlineList(cell.children, state);
  return {
    header,
    ...(align === "left"
      ? { align: "start" as const }
      : align === "right"
        ? { align: "end" as const }
        : align === "center"
          ? { align: "center" as const }
          : {}),
    children: inlines.length > 0 ? [{ type: "paragraph", children: inlines }] : [],
  };
}

function lowerListItem(item: ListItemNode, state: State) {
  return {
    checked: item.checked === undefined ? null : item.checked,
    children: lowerBlocks(item.children, state),
  };
}

const CALLOUTS = new Set(["note", "tip", "important", "warning", "caution"]);

function lowerBlock(node: BlockNode, state: State): ReaderBlock[] {
  switch (node.type) {
    case "heading": {
      const children = lowerInlineList(node.children, state);
      const anchor = node.id ? `kyomi-${slug(node.id)}` : undefined;
      if (anchor) {
        state.headingIds.add(anchor);
      }
      return children.length > 0
        ? [{ type: "heading", ...(anchor ? { anchor } : {}), level: node.depth as 2, children }]
        : [];
    }
    case "paragraph": {
      const children = lowerInlineList(node.children, state);
      return children.length > 0 ? [{ type: "paragraph", children }] : [];
    }
    case "code": {
      const filename = node.file ?? node.title;
      const block: ReaderBlock = {
        type: "code",
        value: restoreDelimiters(node.value),
        language: null,
        languageSource: "none",
        label: "Plain text",
        ...(filename ? { filename: filename.slice(0, 256) } : {}),
        ...(node.highlightLines?.length ? { highlightLines: node.highlightLines } : {}),
      };
      if (node.lang) {
        state.ctx.hints.set(block, { codeLanguage: node.lang });
      }
      return [block];
    }
    case "list":
      return [
        {
          type: "list",
          ordered: node.ordered,
          ...(node.ordered && node.start !== undefined ? { start: node.start } : {}),
          items: node.items.map((item) => lowerListItem(item, state)),
        },
      ];
    case "blockquote": {
      const children = lowerBlocks(node.children, state);
      const first = children[0];
      const lead = first?.type === "paragraph" ? first.children[0] : undefined;
      const alert = lead?.type === "text" ? ALERT.exec(lead.value) : null;
      if (alert && lead?.type === "text" && first?.type === "paragraph") {
        lead.value = lead.value.slice(alert[0].length);
        if (!lead.value && first.children.length === 1) {
          children.shift();
        }
        return [{ type: "callout", variant: alert[1]!.toLowerCase() as "note", children }];
      }
      return [{ type: "quote", children }];
    }
    case "table":
      return [
        {
          type: "table",
          head: [node.header.map((cell, index) => lowerCell(cell, true, node.align[index], state))],
          body: node.rows.map((row) =>
            row.map((cell, index) => lowerCell(cell, false, node.align[index], state)),
          ),
        },
      ];
    case "footnotes":
      for (const item of node.items) {
        const children = lowerBlocks(item.children, state);
        if (children.length > 0) {
          state.ctx.defs.push({
            anchors: [footnoteAnchor(item.id)],
            presentation: "footnote",
            children,
          });
        }
      }
      return [];
    case "thematicBreak":
      return [{ type: "divider" }];
    case "html":
      return lowerHtml(state.sanitizeFragment(node.value), state.ctx);
    case "callout": {
      const variant = CALLOUTS.has(node.kind.toLowerCase())
        ? (node.kind.toLowerCase() as "note")
        : "note";
      const title = node.title ? [{ type: "text" as const, value: node.title }] : [];
      return [
        {
          type: "callout",
          variant,
          ...(title.length > 0 ? { title } : {}),
          children: lowerBlocks(node.children, state),
        },
      ];
    }
    case "component":
      // Unknown MDX-style component: its content is still the author's text.
      return lowerBlocks(node.children, state);
  }
}

function lowerBlocks(nodes: BlockNode[], state: State): ReaderBlock[] {
  return nodes.flatMap((node) => lowerBlock(node, state));
}

/** Lowers Markdown to KDM blocks through the TanStack AST; raw HTML goes through the HTML passes. */
export function lowerMarkdown(markdown: string, options: MarkdownLowerOptions): ReaderBlock[] {
  const document = parseMarkdown(protectDelimiters(markdown), {
    allowHtml: true,
    headingIds: true,
  });
  const state: State = { ...options, headingIds: new Set() };
  return lowerBlocks(document.children, state);
}

/** Paragraphs on blank lines; a single newline is a line break. */
export function lowerPlainText(value: string): ReaderBlock[] {
  return value
    .replace(/\r\n?/g, "\n")
    .split(/\n{2,}/)
    .flatMap((paragraph): ReaderBlock[] => {
      const lines = paragraph
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      const children = lines.flatMap((line, index): ReaderInline[] => [
        ...(index > 0 ? [{ type: "break" as const }] : []),
        { type: "text" as const, value: line },
      ]);
      return children.length > 0 ? [{ type: "paragraph", children }] : [];
    });
}
