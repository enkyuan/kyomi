import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import type { ReaderBlock } from "../../core/document";
import { useReaderNative } from "./context";
import { CheckIcon, CopyIcon } from "./icons";
import { tokenStyle } from "./style";

type CodeBlock = Extract<ReaderBlock, { type: "code" }>;

const COPIED_MS = 1500;

function CopyButton({ value }: { readonly value: string }) {
  const { theme, host } = useReaderNative();
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const copyText = host.copyText;
  if (!copyText) return null;
  const color = copied ? theme.colors.foreground : theme.colors.muted;
  return (
    <Pressable
      accessibilityLabel={copied ? "Copied" : "Copy code"}
      accessibilityRole="button"
      hitSlop={14}
      onPress={() => {
        void Promise.resolve(copyText(value)).then(() => {
          setCopied(true);
          clearTimeout(timer.current);
          timer.current = setTimeout(() => setCopied(false), COPIED_MS);
        });
      }}
      style={({ pressed }) => ({
        alignItems: "center",
        height: 28,
        justifyContent: "center",
        opacity: pressed && !theme.reduceMotion ? 0.5 : 1,
        width: 28,
      })}
    >
      {copied ? <CheckIcon color={color} size={16} /> : <CopyIcon color={color} size={16} />}
    </Pressable>
  );
}

/** Tokens are precomputed by the compiler; this only maps them to nested `Text`. */
export function CodeBlockView({ block }: { readonly block: CodeBlock }) {
  const { theme, host } = useReaderNative();
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
      {header || host.copyText ? (
        <View
          style={{
            alignItems: "center",
            flexDirection: "row",
            justifyContent: "space-between",
            paddingHorizontal: 12,
            paddingTop: 6,
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
                flexShrink: 1,
              }}
            >
              {header}
            </Text>
          ) : (
            <View />
          )}
          <CopyButton value={block.value} />
        </View>
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
