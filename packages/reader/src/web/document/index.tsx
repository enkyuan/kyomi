"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReaderDocument } from "../../core/document";
import type { ReaderImageLoading, ReaderLayoutMode } from "../../core/types";
import { ReaderPhotoSlider } from "../components/photo-slider";
import type { ReaderImageUrlTransformer } from "../html/url-resolve";
import { Blocks } from "./block";
import { DocumentProvider, type DocumentContextValue } from "./context";
import { Footnotes } from "./footnotes";
import { collectDocumentPhotos } from "./photos";

/**
 * Renders a compiled Kyomi Document. Output is plain semantic markup inside `.article-body`, so
 * reader preferences (font size, width, theme) flow through the same CSS variables and classes
 * the HTML reader uses and nothing re-flows after hydration.
 */
export function RenderDocument({
  document,
  baseUrl,
  openLinksInNewTab = true,
  showLinkPreviews = true,
  layoutMode = "fidelity",
  imageLoading = "lazy",
  transformImageUrl,
}: {
  document: ReaderDocument;
  baseUrl?: string | null;
  openLinksInNewTab?: boolean;
  showLinkPreviews?: boolean;
  layoutMode?: ReaderLayoutMode;
  imageLoading?: ReaderImageLoading;
  transformImageUrl?: ReaderImageUrlTransformer;
}) {
  const photos = useMemo(
    () => collectDocumentPhotos(document, transformImageUrl),
    [document, transformImageUrl],
  );
  const [photoIndex, setPhotoIndex] = useState(0);
  const [photoVisible, setPhotoVisible] = useState(false);
  const [photoOpenedWithKeyboard, setPhotoOpenedWithKeyboard] = useState(false);

  const openPhoto = useCallback(
    (src: string, openedWithKeyboard: boolean) => {
      const index = photos.findIndex((photo) => photo.src === src);
      if (index < 0) {
        return;
      }
      setPhotoOpenedWithKeyboard(openedWithKeyboard);
      setPhotoIndex(index);
      setPhotoVisible(true);
    },
    [photos],
  );

  const context = useMemo<DocumentContextValue>(
    () => ({
      baseUrl: baseUrl ?? document.source.baseUrl,
      openLinksInNewTab,
      showLinkPreviews,
      imageLoading,
      transformImageUrl,
      openPhoto,
    }),
    [
      baseUrl,
      document.source.baseUrl,
      imageLoading,
      openLinksInNewTab,
      openPhoto,
      showLinkPreviews,
      transformImageUrl,
    ],
  );

  const usesMath = document.features.math;
  useEffect(() => {
    if (usesMath) {
      void import("../katex-styles");
    }
  }, [usesMath]);

  return (
    <DocumentProvider value={context}>
      <div
        className="article-body"
        data-reader-layout-mode={layoutMode}
        data-reader-document=""
        dir={document.meta.direction}
        lang={document.meta.language ?? undefined}
      >
        <Blocks blocks={document.blocks} />
        <Footnotes footnotes={document.footnotes} />
      </div>
      <ReaderPhotoSlider
        index={photoIndex}
        onClose={() => setPhotoVisible(false)}
        onIndexChange={setPhotoIndex}
        openedWithKeyboard={photoOpenedWithKeyboard}
        photos={photos}
        visible={photoVisible}
      />
    </DocumentProvider>
  );
}
