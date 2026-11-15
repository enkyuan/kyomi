import { Text, View } from "react-native";
import type { ReaderBlock } from "../../core/document";
import { useReaderNative } from "./context";
import { Inlines } from "./inline";
import { useBodyTextStyle } from "./style";

type Block<T extends ReaderBlock["type"]> = Extract<ReaderBlock, { type: T }>;

const HEADING_SCALE = [0, 0, 1.45, 1.28, 1.14, 1.04, 1] as const;

export function HeadingBlock({ block }: { readonly block: Block<"heading"> }) {
  const { theme } = useReaderNative();
  const base = useBodyTextStyle();
  const size = theme.fontSize * (HEADING_SCALE[block.level] ?? 1);
  return (
    <Text
      accessibilityRole="header"
      maxFontSizeMultiplier={theme.maxFontSizeMultiplier}
      selectable
      style={{
        ...base,
        fontFamily: theme.fonts.heading,
        fontSize: size,
        lineHeight: Math.round(size * 1.25),
        marginTop: theme.blockGap * 0.6,
      }}
    >
      <Inlines inlines={block.children} />
    </Text>
  );
}

export function PullQuoteBlock({ block }: { readonly block: Block<"pullQuote"> }) {
  const { theme } = useReaderNative();
  const base = useBodyTextStyle();
  const size = theme.fontSize * 1.3;
  return (
    <View
      style={{
        borderColor: theme.colors.border,
        borderBottomWidth: 1,
        borderTopWidth: 1,
        gap: 6,
        paddingVertical: theme.blockGap * 0.8,
      }}
    >
      <Text
        maxFontSizeMultiplier={theme.maxFontSizeMultiplier}
        selectable
        style={{
          ...base,
          fontFamily: theme.fonts.heading,
          fontSize: size,
          fontStyle: "italic",
          lineHeight: Math.round(size * 1.4),
        }}
      >
        <Inlines inlines={block.children} />
      </Text>
      {block.attribution?.length ? (
        <Text
          maxFontSizeMultiplier={theme.maxFontSizeMultiplier}
          style={{ ...base, color: theme.colors.muted, fontSize: theme.fontSize * 0.85 }}
        >
          — <Inlines inlines={block.attribution} />
        </Text>
      ) : null}
    </View>
  );
}

export function DividerBlock() {
  const { theme } = useReaderNative();
  return (
    <View
      importantForAccessibility="no-hide-descendants"
      style={{
        alignSelf: "center",
        backgroundColor: theme.colors.border,
        height: 1,
        marginVertical: theme.blockGap * 0.6,
        width: "40%",
      }}
    />
  );
}
