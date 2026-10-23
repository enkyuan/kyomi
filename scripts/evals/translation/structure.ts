import { processArticleHtml } from "../../../apps/api/src/modules/articles/reader/content/sanitize";

const BLOCK_TAGS = new Set([
  "p",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "ul",
  "ol",
  "li",
  "dl",
  "dt",
  "dd",
  "pre",
  "blockquote",
  "figure",
  "figcaption",
  "table",
  "thead",
  "tbody",
  "tfoot",
  "tr",
  "td",
  "th",
  "img",
  "hr",
  "video",
  "audio",
  "iframe",
]);
const INLINE_TAGS = new Set([
  "a",
  "strong",
  "em",
  "b",
  "i",
  "code",
  "sup",
  "sub",
  "mark",
  "s",
  "u",
  "br",
]);

type Skeleton = { blocks: string[]; inline: Map<string, number>; urls: string[]; pre: string[] };

// Both sides are serialized by the same sanitizer pass, so tags and attributes arrive in one
// canonical, double-quoted form that a tokenizer can read without a DOM.
function skeleton(html: string): Skeleton {
  const blocks: string[] = [];
  const inline = new Map<string, number>();
  const urls: string[] = [];
  for (const match of html.matchAll(/<([a-z][a-z0-9]*)\b([^>]*)>/gi)) {
    const tag = match[1].toLowerCase();
    if (BLOCK_TAGS.has(tag)) blocks.push(tag);
    if (INLINE_TAGS.has(tag)) inline.set(tag, (inline.get(tag) ?? 0) + 1);
    for (const attr of match[2].matchAll(/\b(href|src)="([^"]*)"/g)) urls.push(attr[2]);
  }
  const pre = [...html.matchAll(/<pre\b[^>]*>([\s\S]*?)<\/pre>/gi)].map((match) =>
    match[1].replace(/<[^>]+>/g, "").trimEnd(),
  );
  return { blocks, inline, urls, pre };
}

export function structureGrade(sourceHtml: string, outputHtml: string) {
  const source = skeleton(sourceHtml);
  const output = skeleton(processArticleHtml(outputHtml, { sanitizerVersion: null }).html);

  const blocksMatch =
    source.blocks.length === output.blocks.length &&
    source.blocks.every((tag, index) => tag === output.blocks[index]);

  let inlineShared = 0;
  let inlineTotal = 0;
  for (const tag of new Set([...source.inline.keys(), ...output.inline.keys()])) {
    const a = source.inline.get(tag) ?? 0;
    const b = output.inline.get(tag) ?? 0;
    inlineShared += Math.min(a, b);
    inlineTotal += Math.max(a, b);
  }

  const remaining = new Map<string, number>();
  for (const url of output.urls) remaining.set(url, (remaining.get(url) ?? 0) + 1);
  let urlsKept = 0;
  for (const url of source.urls) {
    const left = remaining.get(url) ?? 0;
    if (left > 0) {
      urlsKept++;
      remaining.set(url, left - 1);
    }
  }

  const urlKeep = source.urls.length ? urlsKept / source.urls.length : 1;
  const inlineKeep = inlineTotal ? inlineShared / inlineTotal : 1;
  const codeKept =
    source.pre.length === output.pre.length &&
    source.pre.every((text, index) => text === output.pre[index]);
  return {
    markup_ok: blocksMatch && urlKeep === 1 && inlineKeep === 1 && codeKept ? 1 : 0,
    url_keep: urlKeep,
    details: { blocksMatch, inlineKeep, codeKept, sourcePre: source.pre.length },
  };
}
