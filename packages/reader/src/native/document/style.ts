import type { TextStyle } from "react-native";
import type { ReaderBlock, ReaderImage } from "../../core/document";
import { useReaderNative } from "./context";

export function useBodyTextStyle(): TextStyle {
  const { theme } = useReaderNative();
  return {
    color: theme.colors.foreground,
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize,
    lineHeight: Math.round(theme.fontSize * theme.lineHeight),
  };
}

/** Reserved when the enrichment job has not measured the image yet. */
export const FALLBACK_ASPECT_RATIO = 3 / 2;

export function imageAspectRatio(image: ReaderImage, fallback = FALLBACK_ASPECT_RATIO): number {
  return image.width && image.height ? image.width / image.height : fallback;
}

type CodeBlock = Extract<ReaderBlock, { type: "code" }>;
type Highlight = NonNullable<CodeBlock["highlight"]>;

const ITALIC = 1;
const BOLD = 2;
const UNDERLINE = 4;

export function tokenStyle(
  style: Highlight["styles"][number] | undefined,
  scheme: "light" | "dark",
): TextStyle | undefined {
  if (!style) return undefined;
  const out: TextStyle = {};
  const color = scheme === "dark" ? (style.dark ?? style.light) : (style.light ?? style.dark);
  if (color) out.color = color;
  const font = style.fontStyle ?? 0;
  if (font & ITALIC) out.fontStyle = "italic";
  if (font & BOLD) out.fontWeight = "700";
  if (font & UNDERLINE) out.textDecorationLine = "underline";
  return Object.keys(out).length ? out : undefined;
}
