import { Dimensions, ScrollView, Text, View, type TextStyle } from "react-native";
import { SvgXml } from "react-native-svg";
import type { ReactNode } from "react";
import type { ReaderInline } from "../../core/document";
import { useReaderNative, type ReaderNativeContextValue } from "./context";
import { inlinesToText, safeExternalUrl, shiftScript } from "./text";
import { fitMathLayout, layoutMathSvg, mathmlToPlainText, texToUnicode } from "./tex";

type InlineContext = Pick<ReaderNativeContextValue, "theme" | "host" | "footnotes"> & {
  /** Which faces an ancestor already applied, so strong inside emphasis gets the bold-italic face. */
  readonly ambient?: { readonly strong: boolean; readonly emphasis: boolean };
};

const QUOTE_OPEN = "“";
const QUOTE_CLOSE = "”";
const NO_BREAK_SPACE = "\u00A0";
/** Where a chip may wrap. It sits outside the tint, so a line that ends here paints nothing past its last word. */
const BREAK_POINT = "\u200B";
const CODE_PAD = " ";

function plainText(children: readonly ReaderInline[]): string | null {
  let out = "";
  for (const child of children) {
    if (child.type !== "text") return null;
    out += child.value;
  }
  return out;
}

/**
 * Inline code and keyboard keys: a tinted chip. Nested `Text` has no padding or radius, so the
 * breathing room is a narrow no-break space at each end, set in the body face (the mono face has no
 * such glyph and would draw a full-width cell). Surrounding whitespace is trimmed so it doesn't
 * double the padding, and a value with nothing visible draws no chip.
 */
function renderChip(
  value: string,
  ctx: InlineContext,
  key: string,
  face: Pick<TextStyle, "fontFamily" | "fontSize">,
): ReactNode {
  const text = value.trim();
  if (text === "") return value;
  const tint = { backgroundColor: ctx.theme.colors.codeBackground, fontSize: face.fontSize };
  // One tinted span per word. A space that wraps inside a tinted span is painted out to the line's
  // right edge, so the tint carries the gap as a no-break space and the break itself is untinted.
  const words = text.split(/ +/).map((word, position, all) => ({
    first: position === 0,
    id: `${key}:${position}:${word}`,
    last: position === all.length - 1,
    word,
  }));
  return (
    <Text key={key}>
      {words.map(({ first, id, last, word }) => (
        <Text key={id}>
          {first ? null : BREAK_POINT}
          <Text style={tint}>
            {first ? CODE_PAD : null}
            <Text style={{ fontFamily: face.fontFamily }}>{word}</Text>
            {last ? CODE_PAD : NO_BREAK_SPACE}
          </Text>
        </Text>
      ))}
    </Text>
  );
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
  const special = renderSpecialFormat(node, ctx, key, children);
  if (special !== null) return special;
  return (
    <Text key={key} style={formatStyle(node.format, next, theme)}>
      {children}
    </Text>
  );
}

/** Formats drawn as something other than a styled span; `null` when the node is a plain span. */
function renderSpecialFormat(
  node: Extract<ReaderInline, { type: "format" }>,
  ctx: InlineContext,
  key: string,
  children: ReactNode,
): ReactNode {
  const { theme } = ctx;
  switch (node.format) {
    case "keyboard": {
      const keys = plainText(node.children);
      return keys === null
        ? null
        : renderChip(keys, ctx, key, {
            fontFamily: theme.fonts.mono,
            fontSize: theme.fontSize * 0.86,
          });
    }
    case "subscript":
    case "superscript": {
      const text = plainText(node.children);
      return text === null
        ? null
        : shiftScript(text, node.format === "subscript" ? "sub" : "super");
    }
    case "quote":
      return (
        <Text key={key}>
          {QUOTE_OPEN}
          {children}
          {QUOTE_CLOSE}
        </Text>
      );
    default:
      return null;
  }
}

function formatStyle(
  format: Extract<ReaderInline, { type: "format" }>["format"],
  next: { strong: boolean; emphasis: boolean },
  theme: InlineContext["theme"],
): TextStyle {
  switch (format) {
    case "strong":
      return {
        fontFamily: next.emphasis ? theme.fonts.strongItalic : theme.fonts.strong,
        fontWeight: theme.fonts.strong === "System" ? "700" : "normal",
      };
    case "emphasis":
    case "cite":
      return theme.fonts.italic === "System"
        ? { fontStyle: "italic" }
        : { fontFamily: next.strong ? theme.fonts.strongItalic : theme.fonts.italic };
    case "underline":
    case "insert":
      return { textDecorationLine: "underline" };
    case "strike":
      return { textDecorationLine: "line-through" };
    case "highlight":
      return { backgroundColor: theme.colors.highlight };
    case "small":
      return { fontSize: theme.fontSize * 0.85 };
    case "keyboard":
      return {
        backgroundColor: theme.colors.codeBackground,
        fontFamily: theme.fonts.mono,
        fontSize: theme.fontSize * 0.86,
      };
    case "subscript":
    case "superscript":
      return { fontSize: theme.fontSize * 0.75 };
    default:
      return {};
  }
}

function mathFontSize(theme: InlineContext["theme"]): number {
  // Text scales with the system font size up to `maxFontSizeMultiplier`; the SVG must follow it,
  // or a formula stays small next to enlarged text.
  const fontScale = Dimensions.get("window").fontScale;
  const scale = Number.isFinite(fontScale) && fontScale > 0 ? fontScale : 1;
  return theme.fontSize * Math.min(scale, theme.maxFontSizeMultiplier);
}

function renderMath(
  node: Extract<ReaderInline, { type: "math" }>,
  ctx: InlineContext,
  key: string,
): ReactNode {
  const { theme } = ctx;
  // Compiler SVG first (full layout, no WebView per formula). Without it, simple formulas become
  // Unicode in the body font; anything else keeps its TeX source in mono so it is never shown
  // wrong.
  const layout =
    node.svg === undefined
      ? null
      : layoutMathSvg(node.svg, mathFontSize(theme), theme.colors.foreground);
  if (layout) {
    const label = node.tex ?? "Math";
    // An inline view's bottom edge sits on the text baseline (React Native positions the
    // attachment at `glyphRect.bottom - height + font.descender`, and the descender is negative,
    // so the bottom lands on the baseline). The formula's own baseline is `descent` above its
    // bottom edge, so push the box down by exactly that.
    const fit = fitMathLayout(layout, theme.columnWidth);
    const drawing = (
      <SvgXml
        xml={fit.natural.xml}
        width={fit.scroll ? fit.natural.width : fit.layout.width}
        height={fit.scroll ? fit.natural.height : fit.layout.height}
      />
    );
    return (
      <View
        key={key}
        accessible
        accessibilityRole="image"
        accessibilityLabel={label}
        style={{
          width: fit.layout.width,
          height: fit.layout.height,
          transform: [{ translateY: fit.layout.descent }],
        }}
      >
        {fit.scroll ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ width: fit.layout.width, height: fit.layout.height }}
          >
            {drawing}
          </ScrollView>
        ) : (
          drawing
        )}
      </View>
    );
  }
  if (node.tex === undefined) {
    // Publisher MathML without TeX or an SVG: flat token runs read honestly as text, anything
    // laid out (scripts, fractions) gets a placeholder rather than a wrong flattening.
    const plain = node.mathml === undefined ? null : mathmlToPlainText(node.mathml);
    return (
      <Text key={key} style={{ fontFamily: theme.fonts.italic }}>
        {plain ?? "[formula]"}
      </Text>
    );
  }
  const unicode = texToUnicode(node.tex);
  return unicode !== null ? (
    <Text key={key} style={{ fontFamily: theme.fonts.italic }}>
      {unicode}
    </Text>
  ) : (
    <Text key={key} style={{ fontFamily: theme.fonts.mono, fontSize: theme.fontSize * 0.9 }}>
      {node.tex}
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
      return renderChip(node.value, ctx, key, {
        fontFamily: theme.fonts.mono,
        fontSize: theme.fontSize * 0.88,
      });
    case "math":
      return renderMath(node, ctx, key);
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
