import { ScrollView, Text, View } from "react-native";
import type { ReaderBlock } from "../../core/document";
import { useReaderNative } from "./context";

type Block<T extends ReaderBlock["type"]> = Extract<ReaderBlock, { type: T }>;

export function MathBlock({ block }: { readonly block: Block<"math"> }) {
  const { host, theme } = useReaderNative();
  const html = block.rendered ?? block.mathml;
  const island = html
    ? host.renderIsland?.({ kind: "math", html, title: block.tex ?? "Equation" })
    : null;
  if (island) return <View accessibilityLabel={block.tex ?? "Equation"}>{island}</View>;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <Text
        accessibilityLabel={block.tex ?? "Equation"}
        maxFontSizeMultiplier={theme.maxFontSizeMultiplier}
        selectable
        style={{
          color: theme.colors.foreground,
          fontFamily: theme.fonts.mono,
          fontSize: theme.fontSize * 0.9,
        }}
      >
        {block.tex ?? ""}
      </Text>
    </ScrollView>
  );
}

export function HtmlBlock({ block }: { readonly block: Block<"html"> }) {
  const { host } = useReaderNative();
  return host.renderIsland?.({ kind: "html", html: block.html, title: block.reason }) ?? null;
}
