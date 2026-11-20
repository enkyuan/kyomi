import type { DocumentTarget } from "@kyomi/ingest";

// Literal public IPs keep the SSRF check off the network (no DNS lookup).
export const IMG = "https://93.184.216.34/a.png";

export function documentWith(blocks: unknown[]) {
  return { version: 1, blocks, footnotes: [], meta: { leadImage: null } };
}

export const figure = (src: string, extra: object = {}) => ({
  type: "figure",
  image: { src, alt: "", ...extra },
});

export const TARGET: DocumentTarget = { table: "feed_items", id: "a1", body: "original" };
