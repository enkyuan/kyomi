"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@kyomi/ui/components/avatar";
import { cn } from "@kyomi/ui/lib/utils";
import { useState } from "react";
import type { ReaderBlock, ReaderEmbedProvider } from "../../core/document";
import { getReaderSourceLabel, normalizeSafeHttpUrl } from "../../core/url";
import { useDocumentContext } from "./context";
import { DocumentImage } from "./image";
import { Inlines } from "./inline";
import { allowedFrameUrl, resolveImageUrl } from "./lib";

type EmbedBlockModel = Extract<ReaderBlock, { type: "embed" }>;
type LinkCardModel = Extract<ReaderBlock, { type: "linkCard" }>;

const PROVIDER_LABELS: Record<ReaderEmbedProvider, string> = {
  youtube: "YouTube",
  vimeo: "Vimeo",
  x: "X",
  bluesky: "Bluesky",
  mastodon: "Mastodon",
  threads: "Threads",
  instagram: "Instagram",
  tiktok: "TikTok",
  spotify: "Spotify",
  soundcloud: "SoundCloud",
  "apple-podcasts": "Apple Podcasts",
  "github-gist": "GitHub Gist",
  codepen: "CodePen",
  codesandbox: "CodeSandbox",
  loom: "Loom",
  figma: "Figma",
};

/**
 * Hosts a player iframe may load from, per provider. The compiler already builds `frameUrl` from
 * its own allowlist; this is the renderer's independent check, so a malformed document can never
 * point a frame at an arbitrary origin. Providers absent here are snapshot or link only.
 */
const IFRAME_SANDBOX =
  "allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox";

function EmbedFrame({
  provider,
  frameUrl,
  aspectRatio,
  label,
}: {
  provider: ReaderEmbedProvider;
  frameUrl: string;
  aspectRatio: number | undefined;
  label: string;
}) {
  const [loaded, setLoaded] = useState(false);
  const name = PROVIDER_LABELS[provider];
  const ratio = aspectRatio ?? 16 / 9;

  return (
    <div
      className="relative w-full overflow-hidden rounded-md bg-muted"
      style={{ aspectRatio: ratio }}
    >
      {loaded ? (
        <iframe
          allow="fullscreen; picture-in-picture; clipboard-write; encrypted-media"
          allowFullScreen
          className="absolute inset-0 h-full w-full border-0"
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          sandbox={IFRAME_SANDBOX}
          src={frameUrl}
          title={label}
        />
      ) : (
        <button
          className="absolute inset-0 flex h-full w-full flex-col items-center justify-center gap-1 text-muted-foreground text-sm transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
          onClick={() => setLoaded(true)}
          type="button"
        >
          <span className="font-medium text-foreground">Load {name} player</span>
          <span className="text-xs">Content from {name} loads after you click.</span>
        </button>
      )}
    </div>
  );
}

function EmbedSnapshot({ block }: { block: EmbedBlockModel }) {
  const { transformImageUrl, openLinksInNewTab } = useDocumentContext();
  const snapshot = block.snapshot;
  if (!snapshot) {
    return null;
  }
  const avatarSrc = snapshot.author?.avatar
    ? resolveImageUrl(snapshot.author.avatar.src, transformImageUrl)
    : null;
  const authorUrl = snapshot.author?.url ? normalizeSafeHttpUrl(snapshot.author.url) : null;
  const href = normalizeSafeHttpUrl(block.url);
  const linkProps = openLinksInNewTab
    ? ({ target: "_blank", rel: "noopener noreferrer" } as const)
    : {};

  return (
    <div className="not-prose flex flex-col gap-3 rounded-lg border border-border bg-card p-4 text-start text-card-foreground">
      {snapshot.author ? (
        <div className="flex items-center gap-2.5">
          <Avatar className="size-9">
            {avatarSrc ? <AvatarImage alt="" src={avatarSrc} /> : null}
            <AvatarFallback>{snapshot.author.name.slice(0, 1).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 leading-tight">
            <div className="truncate font-medium text-sm">
              {authorUrl ? (
                <a href={authorUrl} {...linkProps}>
                  {snapshot.author.name}
                </a>
              ) : (
                snapshot.author.name
              )}
            </div>
            {snapshot.author.handle ? (
              <div className="truncate text-muted-foreground text-xs">{snapshot.author.handle}</div>
            ) : null}
          </div>
        </div>
      ) : null}
      {snapshot.title ? <div className="font-medium">{snapshot.title}</div> : null}
      {snapshot.text ? (
        <p className="m-0 text-pretty">
          <Inlines nodes={snapshot.text} />
        </p>
      ) : null}
      {snapshot.media?.map((image, index) => (
        <DocumentImage image={image} key={index} />
      ))}
      <div className="flex flex-wrap items-center gap-x-2 text-muted-foreground text-xs">
        <span>{PROVIDER_LABELS[block.provider]}</span>
        {snapshot.publishedAt ? (
          <time dateTime={snapshot.publishedAt}>
            {new Date(snapshot.publishedAt).toLocaleDateString(undefined, { dateStyle: "medium" })}
          </time>
        ) : null}
        {href ? (
          <a href={href} {...linkProps}>
            View original
          </a>
        ) : null}
      </div>
    </div>
  );
}

export function EmbedBlock({ block, id }: { block: EmbedBlockModel; id: string | undefined }) {
  const { openLinksInNewTab } = useDocumentContext();
  const frameUrl = allowedFrameUrl(block.provider, block.frameUrl);
  const href = normalizeSafeHttpUrl(block.url);
  const name = PROVIDER_LABELS[block.provider];
  const linkProps = openLinksInNewTab
    ? ({ target: "_blank", rel: "noopener noreferrer" } as const)
    : {};

  return (
    <figure data-kyomi-embed={block.provider} data-reader-placement={block.placement} id={id}>
      {frameUrl ? (
        <EmbedFrame
          aspectRatio={block.aspectRatio}
          frameUrl={frameUrl}
          label={`${name} embed`}
          provider={block.provider}
        />
      ) : block.snapshot ? (
        <EmbedSnapshot block={block} />
      ) : href ? (
        <a
          className="not-prose flex w-full flex-col gap-0.5 rounded-lg border border-border bg-card p-4 text-start text-card-foreground no-underline"
          href={href}
          {...linkProps}
        >
          <span className="font-medium text-sm">{name}</span>
          <span className="text-muted-foreground text-xs">{href}</span>
        </a>
      ) : null}
      {block.caption ? (
        <figcaption>
          <Inlines nodes={block.caption} />
        </figcaption>
      ) : null}
    </figure>
  );
}

export function LinkCardBlock({ block, id }: { block: LinkCardModel; id: string | undefined }) {
  const { openLinksInNewTab, transformImageUrl } = useDocumentContext();
  const href = normalizeSafeHttpUrl(block.url);
  if (!href) {
    return null;
  }
  const imageSrc = block.image ? resolveImageUrl(block.image.src, transformImageUrl) : null;
  const site = block.siteName ?? getReaderSourceLabel(href, href);

  return (
    <a
      className={cn(
        "not-prose my-[1.1em] flex w-full items-stretch overflow-hidden rounded-lg border border-border bg-card text-card-foreground no-underline",
        "transition-colors hover:bg-accent/40 focus-visible:outline-2 focus-visible:outline-ring",
      )}
      data-reader-link-card=""
      href={href}
      id={id}
      {...(openLinksInNewTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      <span className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 p-3.5">
        {block.title ? (
          <span className="line-clamp-2 font-medium text-sm">{block.title}</span>
        ) : null}
        {block.description ? (
          <span className="line-clamp-2 text-muted-foreground text-xs">{block.description}</span>
        ) : null}
        <span className="truncate text-muted-foreground text-xs">{site}</span>
      </span>
      {imageSrc ? (
        <img
          alt={block.image?.alt ?? ""}
          className="m-0 h-auto w-28 shrink-0 rounded-none object-cover"
          decoding="async"
          loading="lazy"
          src={imageSrc}
        />
      ) : null}
    </a>
  );
}
