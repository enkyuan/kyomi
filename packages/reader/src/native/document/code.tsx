import { ScrollView, Text, View } from "react-native";
import type { ReaderBlock } from "../../core/document";
import { useReaderNative } from "./context";
import { tokenStyle } from "./style";

type CodeBlock = Extract<ReaderBlock, { type: "code" }>;

/** Tokens are precomputed by the compiler; this only maps them to nested `Text`. */
export function CodeBlockView({ block }: { readonly block: CodeBlock }) {
  const { theme } = useReaderNative();
  const emphasized = new Set(block.highlightLines);
  const fontSize = theme.fontSize * 0.82;
  const lines =
    block.highlight?.lines ??
    block.value.split("\n").map((line) => [[line, 0]] as [string, number][]);
  const header = block.filename ?? (block.language ? block.label : null);

  return (
    <View
      style={{
        backgroundColor: theme.colors.codeBackground,
        borderColor: theme.colors.border,
        borderRadius: 10,
        borderWidth: 1,
        overflow: "hidden",
      }}
    >
      {header ? (
        <Text
          accessibilityRole="header"
          maxFontSizeMultiplier={theme.maxFontSizeMultiplier}
          style={{
            color: theme.colors.muted,
            fontFamily: theme.fonts.strong,
            fontSize: theme.fontSize * 0.74,
            paddingHorizontal: 12,
            paddingTop: 10,
          }}
        >
          {header}
        </Text>
      ) : null}
      <ScrollView
        accessibilityLabel={`${block.label} code`}
        contentContainerStyle={{ padding: 12 }}
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        <Text
          maxFontSizeMultiplier={theme.maxFontSizeMultiplier}
          selectable
          style={{
            color: theme.colors.foreground,
            fontFamily: theme.fonts.mono,
            fontSize,
            lineHeight: fontSize * 1.55,
          }}
        >
          {lines.map((line, lineIndex) => (
            <Text
              key={lineIndex}
              style={
                emphasized.has(lineIndex + 1)
                  ? { backgroundColor: theme.colors.highlight }
                  : undefined
              }
            >
              {line.map(([text, styleIndex], tokenIndex) => (
                <Text
                  key={tokenIndex}
                  style={tokenStyle(block.highlight?.styles[styleIndex], theme.scheme)}
                >
                  {text}
                </Text>
              ))}
              {lineIndex < lines.length - 1 ? "\n" : ""}
            </Text>
          ))}
        </Text>
      </ScrollView>
    </View>
  );
}
