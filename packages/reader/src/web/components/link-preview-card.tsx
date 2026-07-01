/* eslint-disable react-doctor/only-export-components */
/* oxlint-disable react-doctor/only-export-components */
"use client";

import { PreviewCard as PreviewCardPrimitive } from "@base-ui/react/preview-card";
import { useMemo } from "react";
import type React from "react";
import { createRoot, type Root } from "react-dom/client";
import { getReaderSourceLabel } from "../../core/url";

type ReaderLinkPreviewCardProps = {
  anchorProps: Record<string, string>;
  anchorInnerHtml: string;
  href: string;
};

function extractAnchorText(anchorInnerHtml: string): string {
  if (typeof document === "undefined") {
    return anchorInnerHtml;
  }
  const container = document.createElement("div");
  container.innerHTML = anchorInnerHtml;
  return container.textContent ?? anchorInnerHtml;
}

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
  const label = getReaderSourceLabel(previewHref, previewHref);

  const nativeTitle =
    anchorProps.title !== undefined && String(anchorProps.title).trim() !== ""
      ? anchorProps.title
      : previewHref;

  const anchorText = useMemo(() => extractAnchorText(anchorInnerHtml), [anchorInnerHtml]);

  return (
    <PreviewCardPrimitive.Root>
      <PreviewCardPrimitive.Trigger
        delay={280}
        render={
          <a {...anchorProps} title={nativeTitle}>
            {anchorText}
          </a>
        }
      />
      <PreviewCardPrimitive.Portal>
        <PreviewCardPrimitive.Positioner align="start" className="z-50" sideOffset={8}>
          <PreviewCardPrimitive.Popup className="relative flex w-72 origin-(--transform-origin) flex-col gap-0 rounded-lg border border-border bg-popover p-3 text-balance text-popover-foreground text-sm shadow-lg/5 transition-[scale,opacity] data-ending-style:scale-98 data-starting-style:scale-98 data-ending-style:opacity-0 data-starting-style:opacity-0">
            <div className="flex flex-col gap-1.5">
              <h4 className="truncate font-medium text-sm">{label}</h4>
              <p className="break-all text-muted-foreground text-xs">{previewHref}</p>
            </div>
          </PreviewCardPrimitive.Popup>
        </PreviewCardPrimitive.Positioner>
      </PreviewCardPrimitive.Portal>
    </PreviewCardPrimitive.Root>
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
  let disposed = false;

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
    if (disposed) {
      return;
    }
    disposed = true;

    // These preview cards live in nested standalone React roots. Defer unmount to the next
    // task so parent reader cleanup does not synchronously unmount child roots mid-commit.
    window.setTimeout(() => {
      for (const root of mountedRoots) {
        root.unmount();
      }
      for (const host of mountedHosts) {
        host.remove();
      }
    }, 0);
  };
}
