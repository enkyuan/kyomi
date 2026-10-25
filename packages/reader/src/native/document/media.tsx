import { FlatList, Image, Pressable, Text, View } from "react-native";
import type { ReactElement } from "react";
import type { ReaderBlock, ReaderImage, ReaderInline, ReaderPlacement } from "../../core/document";
import { useReaderNative } from "./context";
import { Inlines } from "./inline";
import { imageAspectRatio } from "./style";
import { inlinesToText } from "./text";

const IMAGE_RADIUS = 6;

function useMediaRenderer() {
  const { host, theme } = useReaderNative();
  return (
    image: ReaderImage,
    options: {
      fit?: "cover" | "contain";
      aspectRatio?: number;
      caption?: string | undefined;
      radius?: number;
    },
  ): ReactElement => {
    const aspectRatio = options.aspectRatio ?? imageAspectRatio(image);
    const label = image.alt || options.caption || undefined;
    const open = host.openImage ? () => host.openImage?.(image, options.caption) : undefined;
    if (host.renderImage) {
      return host.renderImage({
        image,
        aspectRatio,
        accessibilityLabel: label,
        radius: options.radius ?? IMAGE_RADIUS,
        fit: options.fit ?? "cover",
        onPress: open,
      });
    }
    return (
      <Pressable
        accessibilityLabel={label ?? "Image"}
        accessibilityRole="imagebutton"
        disabled={!open}
        onPress={open}
        style={{
          aspectRatio,
          backgroundColor: theme.colors.codeBackground,
          borderRadius: options.radius ?? IMAGE_RADIUS,
          overflow: "hidden",
          width: "100%",
        }}
      >
        <Image
          accessibilityIgnoresInvertColors
          resizeMode={options.fit === "contain" ? "contain" : "cover"}
          source={{ uri: image.src }}
          style={{ height: "100%", width: "100%" }}
        />
      </Pressable>
    );
  };
}

function placementStyle(placement: ReaderPlacement, bleed: number) {
  switch (placement) {
    case "full":
      return { marginHorizontal: -bleed };
    case "wide":
      return { marginHorizontal: -bleed / 2 };
    case "start":
      return { alignSelf: "flex-start" as const, width: "50%" as const };
    case "end":
      return { alignSelf: "flex-end" as const, width: "50%" as const };
    default:
      return undefined;
  }
}

export function Caption({
  caption,
  credit,
}: {
  readonly caption?: readonly ReaderInline[] | undefined;
  readonly credit?: readonly ReaderInline[] | undefined;
}) {
  const { theme } = useReaderNative();
  if (!caption?.length && !credit?.length) return null;
  const style = {
    color: theme.colors.muted,
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize * 0.82,
    lineHeight: theme.fontSize * 0.82 * 1.45,
  };
  return (
    <View style={{ gap: 2, marginTop: 8 }}>
      {caption?.length ? (
        <Text maxFontSizeMultiplier={theme.maxFontSizeMultiplier} selectable style={style}>
          <Inlines inlines={caption} />
        </Text>
      ) : null}
      {credit?.length ? (
        <Text maxFontSizeMultiplier={theme.maxFontSizeMultiplier} selectable style={style}>
          <Inlines inlines={credit} />
        </Text>
      ) : null}
    </View>
  );
}

export function FigureBlock({
  block,
}: {
  readonly block: Extract<ReaderBlock, { type: "figure" }>;
}) {
  const { theme } = useReaderNative();
  const renderMedia = useMediaRenderer();
  return (
    <View accessibilityRole="image" style={placementStyle(block.placement, theme.bleed)}>
      {renderMedia(block.image, {
        caption: inlinesToText(block.caption) || undefined,
        fit: "contain",
      })}
      <Caption caption={block.caption} credit={block.credit} />
    </View>
  );
}

export function GalleryBlock({
  block,
}: {
  readonly block: Extract<ReaderBlock, { type: "gallery" }>;
}) {
  const { theme } = useReaderNative();
  const renderMedia = useMediaRenderer();
  const gap = 8;

  if (block.layout === "carousel") {
    const itemWidth = Math.round(theme.columnWidth * 0.86);
    return (
      <View style={placementStyle(block.placement, theme.bleed)}>
        {/* Virtualized: photo essays can hold dozens of images, and each cell has a fixed width. */}
        <FlatList
          accessibilityLabel={`Gallery of ${block.items.length} images`}
          contentContainerStyle={{ gap }}
          data={block.items}
          decelerationRate="fast"
          getItemLayout={(_, index) => ({
            index,
            length: itemWidth + gap,
            offset: (itemWidth + gap) * index,
          })}
          horizontal
          initialNumToRender={3}
          keyExtractor={(item, index) => `${item.image.src}.${index}`}
          renderItem={({ item }) => (
            <View style={{ width: itemWidth }}>
              {renderMedia(item.image, {
                caption: inlinesToText(item.caption) || undefined,
                fit: "cover",
                aspectRatio: imageAspectRatio(item.image, 4 / 3),
              })}
              <Caption caption={item.caption} />
            </View>
          )}
          showsHorizontalScrollIndicator={false}
          snapToInterval={itemWidth + gap}
          windowSize={3}
        />
        <Caption caption={block.caption} />
      </View>
    );
  }

  const columns = 2;
  const cell = (theme.columnWidth - gap * (columns - 1)) / columns;
  return (
    <View style={placementStyle(block.placement, theme.bleed)}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap }}>
        {block.items.map((item, index) => (
          <View key={`${item.image.src}.${index}`} style={{ width: cell }}>
            {renderMedia(item.image, {
              caption: inlinesToText(item.caption) || undefined,
              fit: "cover",
              aspectRatio: 1,
            })}
          </View>
        ))}
      </View>
      <Caption caption={block.caption} />
    </View>
  );
}

export function MediaFileBlock({
  block,
}: {
  readonly block: Extract<ReaderBlock, { type: "video" | "audio" }>;
}) {
  const { host, theme } = useReaderNative();
  const renderMedia = useMediaRenderer();
  const source = block.sources[0];
  if (!source) return null;
  const isVideo = block.type === "video";
  const label = isVideo ? "Play video" : (block.title ?? "Play audio");
  const poster: ReaderImage | undefined =
    isVideo && block.poster
      ? { src: block.poster, alt: "", width: block.width, height: block.height }
      : undefined;
  return (
    <View style={isVideo ? placementStyle(block.placement, theme.bleed) : undefined}>
      <Pressable
        accessibilityHint="Opens in the system player"
        accessibilityLabel={label}
        accessibilityRole="button"
        onPress={() => host.openUrl(source.url)}
        style={{
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.border,
          borderRadius: 10,
          borderWidth: 1,
          overflow: "hidden",
        }}
      >
        {poster
          ? renderMedia(poster, {
              aspectRatio: poster.width && poster.height ? poster.width / poster.height : 16 / 9,
              radius: 0,
            })
          : null}
        <View style={{ padding: 12 }}>
          <Text
            maxFontSizeMultiplier={theme.maxFontSizeMultiplier}
            style={{
              color: theme.colors.foreground,
              fontFamily: theme.fonts.strong,
              fontSize: theme.fontSize * 0.9,
            }}
          >
            {isVideo ? "▶  Play video" : `♪  ${label}`}
          </Text>
        </View>
      </Pressable>
      <Caption caption={block.caption} />
    </View>
  );
}
