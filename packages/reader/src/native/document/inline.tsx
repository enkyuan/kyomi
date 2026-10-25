import { Text, type TextStyle } from "react-native";
import type { ReactNode } from "react";
import type { ReaderInline } from "../../core/document";
import { useReaderNative, type ReaderNativeContextValue } from "./context";
import { inlinesToText, safeExternalUrl, shiftScript } from "./text";

type InlineContext = Pick<ReaderNativeContextValue, "theme" | "host" | "footnotes">;

const QUOTE_OPEN = "“";
const QUOTE_CLOSE = "”";

function plainText(children: readonly ReaderInline[]): string | null {
  let out = "";
  for (const child of children) {
    if (child.type !== "text") return null;
    out += child.value;
  }
  return out;
}

function renderNode(node: ReaderInline, ctx: InlineContext, key: string): ReactNode {
  const { theme, host, footnotes } = ctx;
  switch (node.type) {
    case "text":
      return node.value;
    case "break":
      return "\n";
    case "code":
      return (
        <Text
          key={key}
          style={{
            backgroundColor: theme.colors.codeBackground,
            fontFamily: theme.fonts.mono,
            fontSize: theme.fontSize * 0.88,
          }}
        >
          {node.value}
        </Text>
      );
    case "math":
      // Inline islands would need one WebView per formula; show the TeX source in mono instead.
      return (
        <Text key={key} style={{ fontFamily: theme.fonts.mono, fontSize: theme.fontSize * 0.9 }}>
          {node.tex ?? ""}
        </Text>
      );
    case "image":
      return node.image.alt;
    case "abbr":
      return renderInlines(node.children, ctx, key);
    case "footnoteRef": {
      const footnote = footnotes[node.id];
      return (
        <Text
          key={key}
          accessibilityLabel={`Footnote ${node.label}`}
          accessibilityRole="link"
          onPress={() => {
            if (footnote) host.openFootnote?.(footnote);
            else host.scrollToAnchor?.(node.id);
          }}
          style={{
            color: theme.colors.muted,
            fontFamily: theme.fonts.strong,
            fontSize: theme.fontSize * 0.78,
          }}
        >
          {shiftScript(node.label, "super") ?? `[${node.label}]`}
        </Text>
      );
    }
    case "link": {
      const href = node.href;
      const onPress = () => {
        if (href.startsWith("#")) {
          const id = href.slice(1);
          const footnote = footnotes[id];
          if (footnote) host.openFootnote?.(footnote);
          else host.scrollToAnchor?.(id);
          return;
        }
        const safe = safeExternalUrl(href);
        if (safe) host.openUrl(safe);
      };
      return (
        <Text
          key={key}
          accessibilityRole="link"
          onLongPress={() => {
            const safe = href.startsWith("#") ? null : safeExternalUrl(href);
            if (safe) host.shareUrl?.(safe);
          }}
          onPress={onPress}
          style={{
            color: theme.colors.link,
            textDecorationLine: "underline",
            textDecorationColor: theme.colors.quoteRule,
          }}
        >
          {renderInlines(node.children, ctx, key)}
        </Text>
      );
    }
    case "format": {
      const children = renderInlines(node.children, ctx, key);
      const style: TextStyle = {};
      switch (node.format) {
        case "strong":
          style.fontFamily = theme.fonts.strong;
          style.fontWeight = theme.fonts.strong === "System" ? "700" : "normal";
          break;
        case "emphasis":
        case "cite":
          style.fontStyle = "italic";
          break;
        case "underline":
        case "insert":
          style.textDecorationLine = "underline";
          break;
        case "strike":
          style.textDecorationLine = "line-through";
          break;
        case "highlight":
          style.backgroundColor = theme.colors.highlight;
          break;
        case "small":
          style.fontSize = theme.fontSize * 0.85;
          break;
        case "keyboard":
          style.fontFamily = theme.fonts.mono;
          style.fontSize = theme.fontSize * 0.86;
          style.backgroundColor = theme.colors.codeBackground;
          break;
        case "subscript":
        case "superscript": {
          const text = plainText(node.children);
          const shifted =
            text === null ? null : shiftScript(text, node.format === "subscript" ? "sub" : "super");
          if (shifted !== null) return shifted;
          style.fontSize = theme.fontSize * 0.75;
          break;
        }
        case "quote":
          return (
            <Text key={key}>
              {QUOTE_OPEN}
              {children}
              {QUOTE_CLOSE}
            </Text>
          );
      }
      return (
        <Text key={key} style={style}>
          {children}
        </Text>
      );
    }
  }
}

export function renderInlines(
  inlines: readonly ReaderInline[],
  ctx: InlineContext,
  keyPrefix = "i",
): ReactNode[] {
  return inlines.map((node, index) => renderNode(node, ctx, `${keyPrefix}.${index}`));
}

/** Nested native `Text` for KDM inlines; style the parent `Text` for font, color and size. */
export function Inlines({ inlines }: { readonly inlines: readonly ReaderInline[] }): ReactNode {
  const ctx = useReaderNative();
  return renderInlines(inlines, ctx);
}

export { inlinesToText };
