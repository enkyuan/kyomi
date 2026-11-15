import { Image } from "expo-image";
import { Modal, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { ReaderImage } from "@kyomi/reader/document";
import { readerImageProxyUrl } from "./reader-image";

export type ImageViewerState = {
  readonly image: ReaderImage;
  readonly caption?: string | undefined;
};

/** Full-screen viewer: pinch-to-zoom on iOS (ScrollView zoom); Android shows the fitted image. */
export function ImageViewer({
  onClose,
  state,
}: {
  readonly onClose: () => void;
  readonly state: ImageViewerState | null;
}) {
  const { height, width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      transparent={false}
      visible={state !== null}
    >
      <View style={{ backgroundColor: "#000", flex: 1 }}>
        {state ? (
          <ScrollView
            centerContent
            contentContainerStyle={{
              alignItems: "center",
              justifyContent: "center",
              minHeight: height,
            }}
            maximumZoomScale={4}
            minimumZoomScale={1}
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
          >
            <Image
              accessibilityLabel={state.image.alt || state.caption || "Image"}
              contentFit="contain"
              placeholder={
                state.image.placeholder ? { thumbhash: state.image.placeholder } : undefined
              }
              source={{ uri: readerImageProxyUrl(state.image.src) }}
              style={{ height: height - insets.top - insets.bottom, width }}
            />
          </ScrollView>
        ) : null}
        <Pressable
          accessibilityLabel="Close image"
          accessibilityRole="button"
          hitSlop={12}
          onPress={onClose}
          style={{
            backgroundColor: "rgba(255,255,255,0.18)",
            borderRadius: 22,
            minHeight: 44,
            minWidth: 44,
            alignItems: "center",
            justifyContent: "center",
            position: "absolute",
            right: 16,
            top: insets.top + 8,
          }}
        >
          <Text style={{ color: "#fff", fontSize: 20 }}>✕</Text>
        </Pressable>
      </View>
    </Modal>
  );
}
