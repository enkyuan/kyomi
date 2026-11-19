import { ScrollView, Text, View } from "react-native";
import type { ReaderBlock } from "../../core/document";
import { useReaderNative } from "./context";
import { mathmlToPlainText } from "./tex";

type Block<T extends ReaderBlock["type"]> = Extract<ReaderBlock, { type: T }>;

export function MathBlock({ block }: { readonly block: Block<"math"> }) {
  const { host, theme } = useReaderNative();
  const html = block.rendered ?? block.mathml;
  const label = block.tex ?? "Equation";
  const island = html ? host.renderIsland?.({ kind: "math", html, title: label }) : null;
  if (island) return <View accessibilityLabel={label}>{island}</View>;
  // Without a WebView island, show the TeX source; MathML-only equations show flat text or a
  // placeholder (a flattened fraction or script would read as a different formula).
  const source =
    block.tex ??
    (block.mathml === undefined ? null : mathmlToPlainText(block.mathml)) ??
    "[equation]";
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <Text
        accessibilityLabel={label}
        maxFontSizeMultiplier={theme.maxFontSizeMultiplier}
        selectable
        style={{
          color: theme.colors.foreground,
          fontFamily: theme.fonts.mono,
          fontSize: theme.fontSize * 0.9,
        }}
      >
        {source}
      </Text>
    </ScrollView>
  );
}

export function HtmlBlock({ block }: { readonly block: Block<"html"> }) {
  const { host } = useReaderNative();
  return (
    <>{host.renderIsland?.({ kind: "html", html: block.html, title: block.reason }) ?? null}</>
  );
}
