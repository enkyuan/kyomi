import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import type { ReaderFootnote, ReaderNativeContextValue } from "@kyomi/reader/native";
import { Blocks, ReaderNativeProvider } from "@kyomi/reader/native";

/** Native page sheet on iOS, full-screen modal on Android. Content reuses the reader's own block renderers. */
export function FootnoteSheet({
  context,
  footnote,
  onClose,
}: {
  readonly context: ReaderNativeContextValue;
  readonly footnote: ReaderFootnote | null;
  readonly onClose: () => void;
}) {
  const { theme } = context;
  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="pageSheet"
      visible={footnote !== null}
    >
      <View style={{ backgroundColor: theme.colors.background, flex: 1 }}>
        <View
          style={{
            alignItems: "center",
            flexDirection: "row",
            justifyContent: "space-between",
            padding: 16,
          }}
        >
          <Text
            accessibilityRole="header"
            style={{
              color: theme.colors.foreground,
              fontFamily: theme.fonts.strong,
              fontSize: theme.fontSize,
            }}
          >
            {footnote ? `Footnote ${footnote.label}` : ""}
          </Text>
          <Pressable
            accessibilityLabel="Close footnote"
            accessibilityRole="button"
            hitSlop={8}
            onPress={onClose}
            style={{ minHeight: 44, minWidth: 44, alignItems: "center", justifyContent: "center" }}
          >
            <Text style={{ color: theme.colors.muted, fontSize: 18 }}>✕</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ paddingBottom: 32, paddingHorizontal: 20 }}>
          {footnote ? (
            <ReaderNativeProvider value={context}>
              <Blocks blocks={footnote.children} />
            </ReaderNativeProvider>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}
