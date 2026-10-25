import { Image } from "expo-image";
import { Pressable } from "react-native";
import type { ReaderImageRenderProps } from "@kyomi/reader/native";
import { resolveMobileApiUrl } from "@/lib/api";

export function readerImageProxyUrl(sourceUrl: string): string {
  return resolveMobileApiUrl(`/api/reader-image?url=${encodeURIComponent(sourceUrl)}`);
}

/**
 * The renderer reserves the box from stored dimensions; expo-image fills it and cross-fades from the
 * thumbhash. `transition` is zero under reduce motion so nothing animates on load.
 */
export function createReaderImageRenderer(options: {
  readonly background: string;
  readonly reduceMotion: boolean;
}) {
  return function renderReaderImage({
    accessibilityLabel,
    aspectRatio,
    fit,
    image,
    onPress,
    radius,
  }: ReaderImageRenderProps) {
    const content = (
      <Image
        accessibilityIgnoresInvertColors
        accessibilityLabel={accessibilityLabel}
        accessible={Boolean(accessibilityLabel)}
        contentFit={fit}
        placeholder={image.placeholder ? { thumbhash: image.placeholder } : undefined}
        recyclingKey={image.src}
        source={{ uri: readerImageProxyUrl(image.src) }}
        style={{
          aspectRatio,
          backgroundColor: options.background,
          borderRadius: radius,
          width: "100%",
        }}
        transition={options.reduceMotion ? 0 : 160}
      />
    );
    if (!onPress) return content;
    return (
      <Pressable
        accessibilityLabel={accessibilityLabel ?? "Image"}
        accessibilityRole="imagebutton"
        onPress={onPress}
      >
        {content}
      </Pressable>
    );
  };
}
