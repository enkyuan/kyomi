import katex from "katex";
import type {
  BlockNode,
  InlineNode,
  MarkdownDocument,
  MarkdownExtension,
} from "@tanstack/markdown";
import { renderHtml } from "@tanstack/markdown/html";
import { createReaderMarkdownExtension, type ReaderMarkdownRenderOptions } from "./markdown-core";

const LEFT_PAREN = "\uE000";
const RIGHT_PAREN = "\uE001";
const LEFT_BRACKET = "\uE002";
const RIGHT_BRACKET = "\uE003";

function protectMathDelimiters(markdown: string): string {
  return markdown
    .replaceAll(String.raw`\(`, `${LEFT_PAREN}(`)
    .replaceAll(String.raw`\)`, `${RIGHT_PAREN})`)
    .replaceAll(String.raw`\[`, `${LEFT_BRACKET}[`)
    .replaceAll(String.raw`\]`, `${RIGHT_BRACKET}]`);
}

function restoreMathDelimiters(value: string): string {
  return value
    .replaceAll(`${LEFT_PAREN}(`, String.raw`\(`)
    .replaceAll(`${RIGHT_PAREN})`, String.raw`\)`)
    .replaceAll(`${LEFT_BRACKET}[`, String.raw`\[`)
    .replaceAll(`${RIGHT_BRACKET}]`, String.raw`\]`);
}

const MATH_RE =
  /\\begin\{([A-Za-z*]+)\}([\s\S]+?)\\end\{\1\}|\$\$([\s\S]+?)\$\$|\uE002\[([\s\S]+?)\uE003\]|\uE000\(([\s\S]+?)\uE001\)|(?<!\$)\$([^$\n]+?)\$(?!\$)/g;

function transformMathInlineNodes(nodes: InlineNode[]): InlineNode[] {
  const transformed: InlineNode[] = [];
  for (const node of nodes) {
    if (node.type !== "text") {
      if ("children" in node && Array.isArray(node.children)) {
        transformed.push({
          ...node,
          children: transformMathInlineNodes(node.children),
        });
      } else {
        transformed.push(node);
      }
      continue;
    }

    const value = node.value;
    MATH_RE.lastIndex = 0;
    let cursor = 0;
    let match: RegExpExecArray | null;
    while ((match = MATH_RE.exec(value))) {
      if (match.index > cursor) {
        transformed.push({
          type: "text",
          value: restoreMathDelimiters(value.slice(cursor, match.index)),
        });
      }
      const environment = match[1];
      const body = match[2] ?? match[3] ?? match[4] ?? match[5] ?? match[6] ?? match[7];
      if (!body) {
        transformed.push({ type: "text", value: restoreMathDelimiters(match[0]) });
      } else {
        const valueToRender = environment
          ? `\\begin{${environment}}${body}\\end{${environment}}`
          : body;
        transformed.push({
          type: "inlineHtml",
          value: katex.renderToString(valueToRender, {
            displayMode: Boolean(environment || match[3] || match[4]),
            throwOnError: false,
          }),
        });
      }
      cursor = match.index + match[0].length;
    }
    if (cursor === 0) {
      transformed.push({ type: "text", value: restoreMathDelimiters(value) });
    } else if (cursor < value.length) {
      transformed.push({
        type: "text",
        value: restoreMathDelimiters(value.slice(cursor)),
      });
    }
  }
  return transformed;
}

function transformMathDocument(document: MarkdownDocument): MarkdownDocument {
  const transformBlock = (block: BlockNode): BlockNode => {
    if (block.type === "paragraph" || block.type === "heading") {
      return { ...block, children: transformMathInlineNodes(block.children) };
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
          children: transformMathInlineNodes(cell.children),
        })),
        rows: block.rows.map((row) =>
          row.map((cell) => ({
            ...cell,
            children: transformMathInlineNodes(cell.children),
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

function mathExtension(): MarkdownExtension {
  return {
    name: "kyomi-katex",
    transformInline: transformMathInlineNodes,
    transformDocument: transformMathDocument,
  };
}

/** Render Markdown with the shared Kyomi URL policy and KaTeX extension. */
export function readerMarkdownToHtmlWithKatex(
  markdown: string,
  options?: ReaderMarkdownRenderOptions,
): string {
  return renderHtml(protectMathDelimiters(markdown), {
    allowHtml: true,
    extensions: [
      createReaderMarkdownExtension(options?.baseUrl, options?.openLinksInNewTab ?? true),
      mathExtension(),
    ],
  });
}
