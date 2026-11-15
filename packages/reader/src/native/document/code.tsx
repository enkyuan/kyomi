import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, ScrollView, Text, View } from "react-native";
import type { ReaderBlock } from "../../core/document";
import { useReaderNative } from "./context";
import { CheckIcon, CopyIcon } from "./icons";
import { tokenStyle } from "./style";

type CodeBlock = Extract<ReaderBlock, { type: "code" }>;

const COPIED_MS = 1500;
/**
 * The web button's icon swap (`styles.css`, `.rcb-icon`): the outgoing glyph shrinks to a quarter of
 * its size as it fades, the incoming one grows from that, over 300ms on the same ease-out curve. React
 * Native has no blur filter on iOS, so the web's 4px blur is the one part left out.
 */
const SWAP_MS = 300;
const SWAP_EASING = Easing.bezier(0.2, 0, 0, 1);
const SWAP_SCALE = 0.25;

function CopyButton({ value }: { readonly value: string }) {
  const { theme, host } = useReaderNative();
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // 0 shows the copy glyph, 1 the check. A timing value retargets from where it is, so pressing
  // again mid-swap reverses smoothly instead of restarting.
  const swap = useRef(new Animated.Value(0)).current;
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    Animated.timing(swap, {
      duration: theme.reduceMotion ? 150 : SWAP_MS,
      easing: SWAP_EASING,
      toValue: copied ? 1 : 0,
      useNativeDriver: true,
    }).start();
  }, [copied, swap, theme.reduceMotion]);
  const copyText = host.copyText;
  if (!copyText) return null;
  const color = copied ? theme.colors.foreground : theme.colors.muted;
  // Reduce Motion keeps the cross-fade and drops the scale.
  const scale = (from: number, to: number) =>
    theme.reduceMotion ? 1 : swap.interpolate({ inputRange: [0, 1], outputRange: [from, to] });
  const layer = {
    alignItems: "center",
    height: 28,
    justifyContent: "center",
    position: "absolute",
    width: 28,
  } as const;
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
      <Animated.View
        style={[
          layer,
          {
            opacity: swap.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
            transform: [{ scale: scale(1, SWAP_SCALE) }],
          },
        ]}
      >
        <CopyIcon color={color} size={16} />
      </Animated.View>
      <Animated.View
        style={[layer, { opacity: swap, transform: [{ scale: scale(SWAP_SCALE, 1) }] }]}
      >
        <CheckIcon color={color} size={16} />
      </Animated.View>
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
  // As on the web: the filename, else the language the highlighter used, always shown.
  // Colour inferred without a language (no hint, filename or context) must not read "Plain text".
  const header =
    block.filename ?? (block.language === null && block.highlight ? null : block.label);

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
              numberOfLines={1}
              // The web's `.reader-code-lang-label`: sans, medium, 0.8125em, the foreground at 62%.
              style={{
                color: theme.colors.muted,
                flex: 1,
                fontFamily: theme.fonts.sans,
                fontSize: theme.fontSize * 0.8125,
              }}
            >
              {header}
            </Text>
          ) : (
            <View style={{ flex: 1 }} />
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
