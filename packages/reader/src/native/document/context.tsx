import { createContext, useContext, type ReactElement } from "react";
import type { ReaderDocument, ReaderImage } from "../../core/document";
import type { ReaderNativeTheme } from "./theme";

export type ReaderFootnote = ReaderDocument["footnotes"][number];

export type ReaderImageRenderProps = {
  image: ReaderImage;
  /** width / height, reserved before the bitmap loads. */
  aspectRatio: number;
  accessibilityLabel?: string | undefined;
  /** Corner radius of the media box. */
  radius: number;
  /** `cover` fills the box (grids, thumbnails); `contain` shows the whole image. */
  fit: "cover" | "contain";
  onPress?: (() => void) | undefined;
};

export type ReaderIslandProps =
  | { kind: "html" | "math"; html: string; title: string }
  | { kind: "embed"; frameUrl: string; aspectRatio: number; title: string };

/**
 * Everything the renderer needs from the app. The package owns layout and semantics; the app
 * owns navigation, image loading (thumbhash placeholders, caching, the image proxy) and the
 * WebView island for content native text cannot express.
 */
export type ReaderNativeHost = {
  /** Called only with http(s) and mailto URLs. */
  openUrl: (url: string) => void;
  shareUrl?: ((url: string) => void) | undefined;
  openImage?: ((image: ReaderImage, caption: string | undefined) => void) | undefined;
  openFootnote?: ((footnote: ReaderFootnote) => void) | undefined;
  /** Scrolls to an in-document anchor; returns false when the anchor is unknown. */
  scrollToAnchor?: ((anchor: string) => boolean) | undefined;
  renderImage?: ((props: ReaderImageRenderProps) => ReactElement) | undefined;
  /** Without it, `html`, math and unsnapshotted embeds degrade to text and link cards. */
  renderIsland?: ((props: ReaderIslandProps) => ReactElement | null) | undefined;
};

export type ReaderNativeContextValue = {
  theme: ReaderNativeTheme;
  host: ReaderNativeHost;
  footnotes: Record<string, ReaderFootnote>;
};

const ReaderNativeContext = createContext<ReaderNativeContextValue | null>(null);

export const ReaderNativeProvider = ReaderNativeContext.Provider;

export function useReaderNative(): ReaderNativeContextValue {
  const value = useContext(ReaderNativeContext);
  if (!value)
    throw new Error("Reader native components must render inside <ReaderNativeProvider>.");
  return value;
}
