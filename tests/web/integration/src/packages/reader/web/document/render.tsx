import { render } from "@testing-library/react";
import { RenderDocument } from "@kyomi/reader/web";
import type { ReaderBlock } from "@kyomi/reader/document";
import { documentOf } from "./fixtures";

export function renderBlocks(
  blocks: ReaderBlock[],
  props: Partial<Parameters<typeof RenderDocument>[0]> = {},
) {
  const result = render(
    <RenderDocument document={documentOf(blocks)} showLinkPreviews={false} {...props} />,
  );
  const body = result.container.querySelector<HTMLElement>(".article-body");
  if (!body) {
    throw new Error("article body missing");
  }
  return { ...result, body };
}
