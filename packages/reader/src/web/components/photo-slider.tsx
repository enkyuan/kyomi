"use client";

import { PhotoSlider } from "react-photo-view";
import { getReaderPhotoTransitionSpeed } from "../html/photo-preview";

export type ReaderPhoto = {
  key: string;
  src: string;
  alt?: string | undefined;
};

/** The reader's photo viewer, shared by the HTML and document renderers. */
export function ReaderPhotoSlider({
  photos,
  visible,
  index,
  openedWithKeyboard,
  onIndexChange,
  onClose,
}: {
  photos: ReaderPhoto[];
  visible: boolean;
  index: number;
  openedWithKeyboard: boolean;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}) {
  return (
    <PhotoSlider
      easing={() => "cubic-bezier(0.23, 1, 0.32, 1)"}
      images={photos}
      visible={visible && photos.length > 0}
      index={Math.min(index, Math.max(photos.length - 1, 0))}
      speed={(type) => getReaderPhotoTransitionSpeed(type, openedWithKeyboard)}
      onIndexChange={onIndexChange}
      onClose={onClose}
    />
  );
}
