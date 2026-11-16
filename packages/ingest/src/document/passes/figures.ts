import type { ReaderBlock, ReaderInline } from "@kyomi/reader/document";
import type { BlockHint, DocumentPass } from "../document-draft";
import { inlinesText, walkBlockLists } from "../kdm-tree";

const MAX_CAPTION_LENGTH = 400;
const CREDIT_PREFIX = /^(?:photo|photograph|image|illustration|credit|source|courtesy)\b/i;

function hintOf(draft: Parameters<DocumentPass>[0], block: ReaderBlock): BlockHint {
  return draft.hints.get(block) ?? {};
}

/** The inlines of a paragraph that is one emphasis span, the usual "caption under an image". */
function emphasizedLine(block: ReaderBlock): ReaderInline[] | null {
  if (block.type !== "paragraph") {
    return null;
  }
  const content = block.children.filter(
    (inline) => !(inline.type === "text" && !inline.value.trim()),
  );
  const only = content.length === 1 ? content[0] : undefined;
  if (only?.type !== "format" || only.format !== "emphasis") {
    return null;
  }
  return inlinesText(only.children).length <= MAX_CAPTION_LENGTH ? only.children : null;
}

function captionLine(draft: Parameters<DocumentPass>[0], block: ReaderBlock | undefined) {
  if (block?.type !== "paragraph") {
    return null;
  }
  const hint = hintOf(draft, block);
  if (hint.role === "caption" || hint.role === "credit") {
    return { inlines: block.children, role: hint.role };
  }
  const emphasized = emphasizedLine(block);
  if (!emphasized) {
    return null;
  }
  return {
    inlines: emphasized,
    role: CREDIT_PREFIX.test(inlinesText(emphasized).trim())
      ? ("credit" as const)
      : ("caption" as const),
  };
}

function foldMediaText(list: ReaderBlock[], draft: Parameters<DocumentPass>[0]): void {
  for (const [index, block] of list.entries()) {
    const mediaText = block.type === "figure" ? hintOf(draft, block).mediaText : undefined;
    if (block.type === "figure" && mediaText) {
      list[index] = {
        type: "mediaText",
        ...(block.anchor ? { anchor: block.anchor } : {}),
        mediaPosition: mediaText.position,
        image: block.image,
        children: mediaText.content,
      };
    }
  }
}

function groupGalleries(list: ReaderBlock[], draft: Parameters<DocumentPass>[0]): void {
  let index = 0;
  while (index < list.length) {
    const block = list[index]!;
    const group = block.type === "figure" ? hintOf(draft, block).gallery : undefined;
    if (block.type !== "figure" || !group) {
      index += 1;
      continue;
    }
    let end = index;
    while (end < list.length) {
      const next = list[end]!;
      if (next.type !== "figure" || hintOf(draft, next).gallery !== group) {
        break;
      }
      end += 1;
    }
    const members = list.slice(index, end) as Extract<ReaderBlock, { type: "figure" }>[];
    if (members.length < 2) {
      index = end;
      continue;
    }
    const anchor = members.find((member) => member.anchor)?.anchor;
    list.splice(index, members.length, {
      type: "gallery",
      ...(anchor ? { anchor } : {}),
      placement: members[0]!.placement,
      layout: group.layout,
      items: members.map((member) => ({
        image: member.image,
        ...(member.caption ? { caption: member.caption } : {}),
      })),
      ...(group.caption ? { caption: group.caption } : {}),
    });
    index += 1;
  }
}

function pairCaptions(list: ReaderBlock[], draft: Parameters<DocumentPass>[0]): void {
  for (let index = 0; index < list.length; index += 1) {
    const block = list[index]!;
    if (block.type !== "figure" || hintOf(draft, block).gallery) {
      continue;
    }
    if (!block.caption) {
      const line = captionLine(draft, list[index + 1]);
      if (line?.role === "caption") {
        block.caption = line.inlines;
        list.splice(index + 1, 1);
      }
    }
    if (block.caption && !block.credit) {
      const line = captionLine(draft, list[index + 1]);
      if (line?.role === "credit") {
        block.credit = line.inlines;
        list.splice(index + 1, 1);
      }
    }
  }
}

/** An `alt` that repeats the caption makes screen readers say everything twice. */
function clearDuplicateAlt(list: ReaderBlock[]): void {
  const same = (alt: string, caption: ReaderInline[] | undefined) =>
    caption !== undefined &&
    alt.trim() !== "" &&
    alt.trim().replace(/\s+/g, " ").toLowerCase() ===
      inlinesText(caption).trim().replace(/\s+/g, " ").toLowerCase();
  for (const block of list) {
    if (block.type === "figure" && same(block.image.alt, block.caption)) {
      block.image = { ...block.image, alt: "" };
    }
    if (block.type === "gallery") {
      for (const item of block.items) {
        if (same(item.image.alt, item.caption)) {
          item.image = { ...item.image, alt: "" };
        }
      }
    }
  }
}

/**
 * Pass 11. Folds lowering hints into figure structure: media-text pairs, galleries, captions
 * and credits that sit beside an image instead of inside a `figcaption`, and alt text that
 * duplicates the caption.
 */
export const figures: DocumentPass = (draft) => {
  walkBlockLists(draft.blocks, (list) => {
    foldMediaText(list, draft);
    groupGalleries(list, draft);
    pairCaptions(list, draft);
    clearDuplicateAlt(list);
  });
};
