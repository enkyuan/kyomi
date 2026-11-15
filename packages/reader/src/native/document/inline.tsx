import { Text, View, type TextStyle } from "react-native";
import { SvgXml } from "react-native-svg";
import type { ReactNode } from "react";
import type { ReaderInline } from "../../core/document";
import { useReaderNative, type ReaderNativeContextValue } from "./context";
import { inlinesToText, safeExternalUrl, shiftScript } from "./text";
import { layoutMathSvg, texToUnicode } from "./tex";

type InlineContext = Pick<ReaderNativeContextValue, "theme" | "host" | "footnotes"> & {
  /** Which faces an ancestor already applied, so strong inside emphasis gets the bold-italic face. */
  readonly ambient?: { readonly strong: boolean; readonly emphasis: boolean };
};

const QUOTE_OPEN = "“";
const QUOTE_CLOSE = "”";
const CODE_PAD = " ";

function plainText(children: readonly ReaderInline[]): string | null {
  let out = "";
  for (const child of children) {
    if (child.type !== "text") return null;
    out += child.value;
  }
  return out;
}

function renderFootnoteRef(
  node: Extract<ReaderInline, { type: "footnoteRef" }>,
  ctx: InlineContext,
  key: string,
): ReactNode {
  const { theme, host, footnotes } = ctx;
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

function renderLink(
  node: Extract<ReaderInline, { type: "link" }>,
  ctx: InlineContext,
  key: string,
): ReactNode {
  const { theme, host, footnotes } = ctx;
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

function renderFormat(
  node: Extract<ReaderInline, { type: "format" }>,
  ctx: InlineContext,
  key: string,
): ReactNode {
  const { theme } = ctx;
  const ambient = ctx.ambient ?? { strong: false, emphasis: false };
  const next = {
    strong: ambient.strong || node.format === "strong",
    emphasis: ambient.emphasis || node.format === "emphasis" || node.format === "cite",
  };
  const children = renderInlines(node.children, { ...ctx, ambient: next }, key);
  const style: TextStyle = {};
  switch (node.format) {
    case "strong":
      style.fontFamily = next.emphasis ? theme.fonts.strongItalic : theme.fonts.strong;
      style.fontWeight = theme.fonts.strong === "System" ? "700" : "normal";
      break;
    case "emphasis":
    case "cite":
      if (theme.fonts.italic === "System") style.fontStyle = "italic";
      else style.fontFamily = next.strong ? theme.fonts.strongItalic : theme.fonts.italic;
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

function renderNode(node: ReaderInline, ctx: InlineContext, key: string): ReactNode {
  const { theme } = ctx;
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
          {/* Nested `Text` has no padding or radius; narrow no-break spaces inside the span give the
              chip the same breathing room as the web reader's `padding: 0.1em 0.3em`. */}
          {`${CODE_PAD}${node.value}${CODE_PAD}`}
        </Text>
      );
    case "math":
      // Compiler SVG first (full layout, no WebView per formula). Without it, simple formulas
      // become Unicode in the body font; anything else keeps its TeX source in mono so it is
      // never shown wrong.
      const layout =
        node.svg === undefined
          ? null
          : layoutMathSvg(node.svg, theme.fontSize, theme.colors.foreground);
      if (layout) {
        // An inline view's bottom edge sits on the text baseline, so push it down by the descent.
        return (
          <View
            key={key}
            accessible
            accessibilityRole="image"
            accessibilityLabel={node.tex ?? "Math"}
            style={{
              width: layout.width,
              height: layout.height,
              transform: [{ translateY: layout.descent }],
            }}
          >
            <SvgXml xml={layout.xml} width={layout.width} height={layout.height} />
          </View>
        );
      }
      const unicode = node.tex === undefined ? null : texToUnicode(node.tex);
      return unicode !== null ? (
        <Text key={key} style={{ fontFamily: theme.fonts.italic }}>
          {unicode}
        </Text>
      ) : (
        <Text key={key} style={{ fontFamily: theme.fonts.mono, fontSize: theme.fontSize * 0.9 }}>
          {node.tex ?? ""}
        </Text>
      );
    case "image":
      return node.image.alt;
    case "abbr":
      return renderInlines(node.children, ctx, key);
    case "footnoteRef":
      return renderFootnoteRef(node, ctx, key);
    case "link":
      return renderLink(node, ctx, key);
    case "format":
      return renderFormat(node, ctx, key);
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
