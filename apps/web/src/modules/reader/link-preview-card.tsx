"use client";

import type React from "react";
import { createRoot, type Root } from "react-dom/client";
import { PreviewCard, PreviewCardPopup, PreviewCardTrigger } from "@components/ui/preview-card";
import { getFeedSourceLabel } from "@lib/feed-source-label";

type ReaderLinkPreviewCardProps = {
  anchorProps: Record<string, string>;
  anchorInnerHtml: string;
  href: string;
};

function resolvePreviewHref(href: string) {
  try {
    if (typeof window === "undefined") {
      return href;
    }
    return new URL(href, window.location.href).toString();
  } catch {
    return href;
  }
}

function ReaderLinkPreviewCard({
  anchorProps,
  anchorInnerHtml,
  href,
}: ReaderLinkPreviewCardProps): React.ReactElement {
  const previewHref = resolvePreviewHref(href);
  const label = getFeedSourceLabel(previewHref, previewHref);

  const nativeTitle =
    anchorProps.title !== undefined && String(anchorProps.title).trim() !== ""
      ? anchorProps.title
      : previewHref;

  return (
    <PreviewCard>
      <PreviewCardTrigger
        delay={280}
        render={
          <a
            {...anchorProps}
            title={nativeTitle}
            dangerouslySetInnerHTML={{ __html: anchorInnerHtml }}
          />
        }
      />
      <PreviewCardPopup align="start" className="w-72 gap-0 p-3">
        <div className="flex flex-col gap-1.5">
          <h4 className="truncate font-medium text-sm">{label}</h4>
          <p className="break-all text-muted-foreground text-xs">{previewHref}</p>
        </div>
      </PreviewCardPopup>
    </PreviewCard>
  );
}

function shouldEnhanceAnchor(anchor: HTMLAnchorElement): boolean {
  const href = anchor.getAttribute("href");
  if (!href || href.startsWith("#")) {
    return false;
  }
  if (anchor.getAttribute("data-reader-link-preview") === "true") {
    return false;
  }
  const lowered = href.toLowerCase();
  return !lowered.startsWith("javascript:");
}

function collectAnchorProps(anchor: HTMLAnchorElement): Record<string, string> {
  const props: Record<string, string> = {};
  for (const attr of Array.from(anchor.attributes)) {
    if (attr.name === "style") {
      continue;
    }
    if (attr.name === "class") {
      props.className = attr.value;
      continue;
    }
    props[attr.name] = attr.value;
  }
  props["data-reader-link-preview"] = "true";
  return props;
}

export function mountReaderLinkPreviewCards(container: HTMLElement): () => void {
  const mountedRoots: Root[] = [];
  const mountedHosts: HTMLElement[] = [];

  for (const anchor of Array.from(container.querySelectorAll<HTMLAnchorElement>("a[href]"))) {
    if (!shouldEnhanceAnchor(anchor)) {
      continue;
    }
    const parent = anchor.parentElement;
    if (!parent) {
      continue;
    }

    const href = anchor.getAttribute("href");
    if (!href) {
      continue;
    }

    const host = document.createElement("span");
    host.className = "contents";
    parent.insertBefore(host, anchor);

    const root = createRoot(host);
    root.render(
      <ReaderLinkPreviewCard
        anchorInnerHtml={anchor.innerHTML}
        anchorProps={collectAnchorProps(anchor)}
        href={href}
      />,
    );

    anchor.remove();
    mountedRoots.push(root);
    mountedHosts.push(host);
  }

  return () => {
    for (const root of mountedRoots) {
      root.unmount();
    }
    for (const host of mountedHosts) {
      host.remove();
    }
  };
}
