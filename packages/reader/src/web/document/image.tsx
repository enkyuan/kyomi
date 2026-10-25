"use client";

import { cn } from "@kyomi/ui/lib/utils";
import { useCallback, useState, type ReactNode } from "react";
import type { ReaderImage } from "../../core/document";
import { normalizeSafeHttpUrl } from "../../core/url";
import { skeletonShimmerClassName } from "../html/image";
import { useDocumentContext } from "./context";
import { isPlainLeftClick, resolveImage } from "./lib";

function ImageUnavailableIcon() {
  return (
    <svg
      aria-hidden="true"
      className="reader-image-unavailable-icon"
      fill="none"
      viewBox="0 0 16 16"
    >
      <rect height="11" rx="1.5" width="13" x="1.5" y="2.5" />
      <path d="m3.5 11 2.4-2.4 1.8 1.8 1.3-1.3 2.5 2.5" />
      <circle cx="5.25" cy="6.25" r="0.75" />
      <path d="M2 2 14 14" />
    </svg>
  );
}

/** Failed media becomes a compact note; a failed decorative image disappears. */
function ImageUnavailable({ alt, description }: { alt: string; description?: string | undefined }) {
  const label = description?.trim() || alt.trim();
  if (!label) {
    return null;
  }
  return (
    <span data-reader-img-frame="" data-reader-img-unavailable="">
      <span
        aria-label={`Image unavailable: ${label}`}
        className="reader-image-unavailable"
        role="note"
      >
        <span className="reader-image-unavailable-label">
          <ImageUnavailableIcon />
          Image unavailable
        </span>
        {!description?.trim() ? (
          <span className="reader-image-unavailable-description">{alt.trim()}</span>
        ) : null}
      </span>
    </span>
  );
}

/** Wraps a framed image so a click opens the shared photo viewer, as the HTML reader does. */
function PhotoTarget({
  src,
  alt,
  href,
  children,
}: {
  src: string;
  alt: string;
  href: string | undefined;
  children: ReactNode;
}) {
  const { openPhoto, openLinksInNewTab } = useDocumentContext();
  const label = alt.trim() ? `Open image preview: ${alt.trim()}` : "Open image preview";

  const safeHref = href ? normalizeSafeHttpUrl(href) : null;

  if (safeHref) {
    return (
      <a
        data-reader-photo-view=""
        href={safeHref}
        onClick={(event) => {
          if (!isPlainLeftClick(event)) {
            return;
          }
          event.preventDefault();
          openPhoto(src, event.detail === 0);
        }}
        {...(openLinksInNewTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      >
        {children}
      </a>
    );
  }

  return (
    <button
      aria-label={label}
      className="block w-full cursor-zoom-in border-0 bg-transparent p-0 text-inherit"
      data-reader-photo-view=""
      onClick={(event) => openPhoto(src, event.detail === 0)}
      type="button"
    >
      {children}
    </button>
  );
}

/**
 * One framed block image. Mirrors the markup the HTML reader's DOM pass produces
 * (`[data-reader-img-frame] > img`, shimmer until decoded, unavailable note on error) so the
 * shared reader CSS styles both paths identically.
 */
export function DocumentImage({
  image,
  description,
  zoomable = true,
}: {
  image: ReaderImage;
  /** Plain-text caption, used when the image fails to load. */
  description?: string | undefined;
  zoomable?: boolean;
}) {
  const { transformImageUrl, imageLoading } = useDocumentContext();
  const resolved = resolveImage(image, transformImageUrl);
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");
  const imageRef = useCallback((node: HTMLImageElement | null) => {
    // Cached images can finish before React attaches `onLoad`.
    if (node?.complete && node.naturalWidth > 0) {
      setStatus("loaded");
    }
  }, []);

  if (!resolved || status === "error") {
    return <ImageUnavailable alt={image.alt} description={description} />;
  }

  const frame = (
    <span
      className="relative block overflow-hidden rounded-md"
      data-reader-img-frame=""
      data-reader-img-loading={status === "loading" ? "true" : undefined}
    >
      {status === "loading" ? (
        <div
          aria-hidden="true"
          className={cn(
            skeletonShimmerClassName,
            "pointer-events-none absolute inset-0 z-0 min-h-[4rem]",
          )}
        />
      ) : null}
      <img
        alt={image.alt}
        className={cn(
          "relative z-10 h-auto min-h-0 w-full max-w-full transition-opacity duration-200 ease-out",
          status === "loading" && "opacity-0",
        )}
        decoding="async"
        height={image.height}
        loading={imageLoading}
        onError={() => setStatus("error")}
        onLoad={() => setStatus("loaded")}
        ref={imageRef}
        src={resolved.src}
        srcSet={resolved.srcSet}
        width={image.width}
      />
    </span>
  );

  return zoomable ? (
    <PhotoTarget alt={image.alt} href={image.href} src={resolved.src}>
      {frame}
    </PhotoTarget>
  ) : (
    frame
  );
}
