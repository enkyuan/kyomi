import type {
  BlockNode,
  InlineNode,
  MarkdownDocument,
  MarkdownExtension,
} from "@tanstack/markdown";
import { normalizeSafeHttpUrl } from "../core/url";

export type ReaderMarkdownRenderOptions = {
  baseUrl?: string | null;
  openLinksInNewTab?: boolean;
};

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function transformInlineNodes(nodes: InlineNode[], baseUrl?: string | null): InlineNode[] {
  const transformed: InlineNode[] = [];

  for (const node of nodes) {
    if (node.type === "link") {
      const href = normalizeSafeHttpUrl(node.href, baseUrl);
      if (!href) {
        transformed.push(...transformInlineNodes(node.children, baseUrl));
      } else {
        transformed.push({
          ...node,
          href,
          children: transformInlineNodes(node.children, baseUrl),
        });
      }
      continue;
    }

    if (node.type === "image") {
      const src = normalizeSafeHttpUrl(node.src, baseUrl);
      if (!src) {
        transformed.push({ type: "text", value: node.alt });
      } else {
        transformed.push({ ...node, src });
      }
      continue;
    }

    if ("children" in node && Array.isArray(node.children)) {
      transformed.push({
        ...node,
        children: transformInlineNodes(node.children, baseUrl),
      });
      continue;
    }

    transformed.push(node);
  }

  return transformed;
}

function transformDocument(document: MarkdownDocument, baseUrl?: string | null): MarkdownDocument {
  const transformBlock = (block: BlockNode): BlockNode => {
    if (block.type === "paragraph" || block.type === "heading") {
      return { ...block, children: transformInlineNodes(block.children, baseUrl) };
    }
    if (block.type === "list") {
      return {
        ...block,
        items: block.items.map((item) => ({
          ...item,
          children: item.children.map(transformBlock),
        })),
      };
    }
    if (block.type === "blockquote" || block.type === "callout") {
      return { ...block, children: block.children.map(transformBlock) };
    }
    if (block.type === "table") {
      return {
        ...block,
        header: block.header.map((cell) => ({
          ...cell,
          children: transformInlineNodes(cell.children, baseUrl),
        })),
        rows: block.rows.map((row) =>
          row.map((cell) => ({
            ...cell,
            children: transformInlineNodes(cell.children, baseUrl),
          })),
        ),
      };
    }
    if (block.type === "footnotes") {
      return {
        ...block,
        items: block.items.map((item) => ({
          ...item,
          children: item.children.map(transformBlock),
        })),
      };
    }
    if (block.type === "component") {
      return { ...block, children: block.children.map(transformBlock) };
    }
    return block;
  };

  return { ...document, children: document.children.map(transformBlock) };
}

export function createReaderMarkdownExtension(
  baseUrl?: string | null,
  openLinksInNewTab = true,
): MarkdownExtension {
  return {
    name: "kyomi-reader-markdown",
    transformDocument: (document) => transformDocument(document, baseUrl),
    renderHtml: (node, context) => {
      if (node.type !== "link" || !openLinksInNewTab) {
        return undefined;
      }
      const titleAttr = node.title ? ` title="${escapeAttr(node.title)}"` : "";
      return `<a href="${escapeAttr(node.href)}"${titleAttr} rel="noopener noreferrer" target="_blank">${node.children.map(context.renderInline).join("")}</a>`;
    },
  };
}
