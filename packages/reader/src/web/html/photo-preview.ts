"use client";

import { useCallback, useEffectEvent, useRef, useState } from "react";
import { READER_IMG_FRAME } from "./constants";

type ReaderPhoto = {
  key: string;
  src: string;
  alt?: string;
};

const PHOTO_TRANSITION_MS = 180;
const PHOTO_OPEN_ANIMATION = 1;
const PHOTO_SLIDE_ANIMATION = 3;

export function getReaderPhotoTransitionSpeed(type: number, openedWithKeyboard: boolean) {
  if (type === PHOTO_SLIDE_ANIMATION || (type === PHOTO_OPEN_ANIMATION && openedWithKeyboard)) {
    return 0;
  }
  return PHOTO_TRANSITION_MS;
}

function getPhotoSrc(img: HTMLImageElement): string | null {
  const src = img.currentSrc || img.src || img.getAttribute("src");
  return src && src.trim().length > 0 ? src : null;
}

function areReaderPhotosEqual(a: ReaderPhoto[], b: ReaderPhoto[]): boolean {
  if (a.length !== b.length) {
    return false;
  }

  for (let i = 0; i < a.length; i += 1) {
    if (a[i].key !== b[i].key || a[i].src !== b[i].src || a[i].alt !== b[i].alt) {
      return false;
    }
  }

  return true;
}

export function useReaderPhotoPreviewTargets() {
  const photoPreviewCleanupsRef = useRef<(() => void)[]>([]);
  const [photos, setPhotos] = useState<ReaderPhoto[]>([]);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [photoVisible, setPhotoVisible] = useState(false);
  const [photoOpenedWithKeyboard, setPhotoOpenedWithKeyboard] = useState(false);

  const disposePhotoPreviewTargets = useCallback(() => {
    for (let i = photoPreviewCleanupsRef.current.length - 1; i >= 0; i -= 1) {
      photoPreviewCleanupsRef.current[i]();
    }
    photoPreviewCleanupsRef.current = [];
  }, []);

  const installPhotoPreviewTargets = useEffectEvent((node: HTMLElement) => {
    disposePhotoPreviewTargets();

    const nextPhotos: ReaderPhoto[] = [];
    const cleanups: (() => void)[] = [];
    const seenSrcs = new Set<string>();

    for (const frame of node.querySelectorAll<HTMLElement>(`[${READER_IMG_FRAME}]`)) {
      const img = frame.querySelector<HTMLImageElement>("img");
      if (!img) {
        continue;
      }
      const src = getPhotoSrc(img);
      if (!src || seenSrcs.has(src)) {
        continue;
      }

      const index = nextPhotos.length;
      const alt = img.getAttribute("alt")?.trim() || undefined;
      const photo: ReaderPhoto = { key: `${index}:${src}`, src, alt };
      const link = frame.closest<HTMLElement>("a[href]");
      const target = link && node.contains(link) ? link : frame;
      const previousRole = target.getAttribute("role");
      const previousTabIndex = target.getAttribute("tabindex");
      const previousAriaLabel = target.getAttribute("aria-label");
      const previousPreview = target.getAttribute("data-reader-photo-view");
      const previousFramePreview = frame.getAttribute("data-reader-photo-view");

      nextPhotos.push(photo);
      seenSrcs.add(src);
      frame.setAttribute("data-reader-photo-view", "");
      target.setAttribute("data-reader-photo-view", "");
      if (!link) {
        target.setAttribute("role", "button");
        target.setAttribute("tabindex", "0");
      }
      target.setAttribute("aria-label", alt ? `Open image preview: ${alt}` : "Open image preview");

      const openPhoto = (openedWithKeyboard: boolean) => {
        setPhotoOpenedWithKeyboard(openedWithKeyboard);
        setPhotoIndex(index);
        setPhotoVisible(true);
      };
      const onClick = (event: MouseEvent) => {
        if (
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        ) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        openPhoto(false);
      };
      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key !== "Enter" && event.key !== " ") {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        openPhoto(true);
      };

      target.addEventListener("click", onClick);
      target.addEventListener("keydown", onKeyDown);
      cleanups.push(() => {
        target.removeEventListener("click", onClick);
        target.removeEventListener("keydown", onKeyDown);
        if (previousPreview === null) {
          target.removeAttribute("data-reader-photo-view");
        } else {
          target.setAttribute("data-reader-photo-view", previousPreview);
        }
        if (previousFramePreview === null) {
          frame.removeAttribute("data-reader-photo-view");
        } else {
          frame.setAttribute("data-reader-photo-view", previousFramePreview);
        }
        if (!link) {
          if (previousRole === null) {
            target.removeAttribute("role");
          } else {
            target.setAttribute("role", previousRole);
          }
          if (previousTabIndex === null) {
            target.removeAttribute("tabindex");
          } else {
            target.setAttribute("tabindex", previousTabIndex);
          }
        }
        if (previousAriaLabel === null) {
          target.removeAttribute("aria-label");
        } else {
          target.setAttribute("aria-label", previousAriaLabel);
        }
      });
    }

    photoPreviewCleanupsRef.current = cleanups;
    setPhotos((current) => (areReaderPhotosEqual(current, nextPhotos) ? current : nextPhotos));
    setPhotoIndex((current) => Math.min(current, Math.max(nextPhotos.length - 1, 0)));
    if (nextPhotos.length === 0) {
      setPhotoVisible(false);
    }
  });

  const resetPhotoPreviewTargets = useCallback(() => {
    disposePhotoPreviewTargets();
    setPhotos([]);
    setPhotoVisible(false);
    setPhotoOpenedWithKeyboard(false);
  }, [disposePhotoPreviewTargets]);

  return {
    disposePhotoPreviewTargets,
    installPhotoPreviewTargets,
    photoIndex,
    photoOpenedWithKeyboard,
    photoVisible,
    photos,
    resetPhotoPreviewTargets,
    setPhotoIndex,
    setPhotoVisible,
  };
}
