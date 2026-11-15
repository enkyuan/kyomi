import type { ReaderBlock } from "@kyomi/reader/document";
import type { DocumentPass } from "../document-draft";
import { embedFrame, providerIsFramed } from "../embed-frames";
import { recognizeEmbedUrl, recognizeMastodonUrl } from "../embed-providers";
import { walkBlockLists } from "../kdm-tree";

/**
 * Pass 15. Finalizes `embed` blocks. `frameUrl` comes only from the provider allowlist template
 * applied to the canonical public URL; an embed whose URL does not match its provider, or whose
 * framed provider yields no valid frame, becomes a `linkCard`.
 */
export const embeds: DocumentPass = (draft) => {
  walkBlockLists(draft.blocks, (list) => {
    for (const [index, block] of list.entries()) {
      if (block.type !== "embed") {
        continue;
      }
      const recognized = recognizeEmbedUrl(block.url) ?? recognizeMastodonUrl(block.url);
      const frame = embedFrame(block.provider, block.url);
      if (recognized?.provider !== block.provider || (providerIsFramed(block.provider) && !frame)) {
        const card: ReaderBlock = { type: "linkCard", url: block.url };
        if (block.anchor) {
          card.anchor = block.anchor;
        }
        list[index] = card;
        continue;
      }
      delete block.frameUrl;
      delete block.aspectRatio;
      if (frame) {
        block.providerId = frame.providerId.slice(0, 256);
        if (frame.frameUrl) {
          block.frameUrl = frame.frameUrl;
        }
        if (frame.aspectRatio) {
          block.aspectRatio = frame.aspectRatio;
        }
      }
    }
  });
};
