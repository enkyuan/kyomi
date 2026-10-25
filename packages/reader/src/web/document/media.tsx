"use client";

import { cn } from "@kyomi/ui/lib/utils";
import type { ReaderBlock } from "../../core/document";
import { normalizeSafeHttpUrl } from "../../core/url";
import { useDocumentContext } from "./context";
import { DocumentImage } from "./image";
import { Inlines, inlinesToText } from "./inline";
import { resolveImageUrl } from "./lib";

type BlockOf<T extends ReaderBlock["type"]> = Extract<ReaderBlock, { type: T }>;

export function Figure({ block, id }: { block: BlockOf<"figure">; id: string | undefined }) {
  const caption = inlinesToText(block.caption);
  return (
    <figure
      data-reader-figure-has-caption={block.caption ? "" : undefined}
      data-reader-placement={block.placement}
      id={id}
    >
      <DocumentImage description={caption} image={block.image} />
      {block.caption ? (
        <figcaption>
          <Inlines nodes={block.caption} />
        </figcaption>
      ) : null}
      {block.credit ? (
        <p data-reader-figure-credit="">
          <Inlines nodes={block.credit} />
        </p>
      ) : null}
    </figure>
  );
}

export function Gallery({ block, id }: { block: BlockOf<"gallery">; id: string | undefined }) {
  const carousel = block.layout === "carousel";
  return (
    <figure
      data-reader-figure-has-caption={block.caption ? "" : undefined}
      data-reader-gallery={block.layout}
      data-reader-placement={block.placement}
      id={id}
    >
      <div
        aria-label={carousel ? "Image gallery" : undefined}
        aria-roledescription={carousel ? "carousel" : undefined}
        className={cn(
          "w-full",
          carousel
            ? "flex snap-x snap-mandatory gap-2 overflow-x-auto overscroll-x-contain"
            : "grid grid-cols-2 gap-2 sm:grid-cols-3",
        )}
        role={carousel ? "group" : undefined}
        tabIndex={carousel ? 0 : undefined}
      >
        {block.items.map((item, index) => (
          <div
            className={cn("min-w-0", carousel && "shrink-0 basis-[85%] snap-center")}
            key={index}
          >
            <DocumentImage description={inlinesToText(item.caption)} image={item.image} />
            {item.caption ? (
              <span className="mt-1 block text-start" data-reader-figure-caption="">
                <Inlines nodes={item.caption} />
              </span>
            ) : null}
          </div>
        ))}
      </div>
      {block.caption ? (
        <figcaption>
          <Inlines nodes={block.caption} />
        </figcaption>
      ) : null}
    </figure>
  );
}

export function Video({ block, id }: { block: BlockOf<"video">; id: string | undefined }) {
  const { transformImageUrl } = useDocumentContext();
  const poster = block.poster ? resolveImageUrl(block.poster, transformImageUrl) : null;
  return (
    <figure data-reader-placement={block.placement} id={id}>
      <video
        controls
        height={block.height}
        playsInline
        poster={poster ?? undefined}
        preload="metadata"
        width={block.width}
      >
        {block.sources.map((source) => {
          const url = normalizeSafeHttpUrl(source.url);
          return url ? <source key={url} src={url} type={source.mimeType} /> : null;
        })}
      </video>
      {block.caption ? (
        <figcaption>
          <Inlines nodes={block.caption} />
        </figcaption>
      ) : null}
    </figure>
  );
}

export function Audio({ block, id }: { block: BlockOf<"audio">; id: string | undefined }) {
  return (
    <figure id={id}>
      {block.title ? <figcaption className="order-first">{block.title}</figcaption> : null}
      <audio controls preload="none">
        {block.sources.map((source) => {
          const url = normalizeSafeHttpUrl(source.url);
          return url ? <source key={url} src={url} type={source.mimeType} /> : null;
        })}
      </audio>
      {block.caption ? (
        <figcaption>
          <Inlines nodes={block.caption} />
        </figcaption>
      ) : null}
    </figure>
  );
}
