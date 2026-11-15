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
const HEX_COLOR = /^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i;

const safeColor = (value: string | undefined) =>
  value && HEX_COLOR.test(value) ? value : undefined;

/**
 * The web's `.reader-token` rule: light uses the light colour only, dark prefers the dark colour
 * and falls back to the light one. A token with only a dark colour keeps the default foreground in
 * the light scheme instead of borrowing a colour that was picked against a dark background.
 */
export function tokenStyle(
  style: Highlight["styles"][number] | undefined,
  scheme: "light" | "dark",
): TextStyle | undefined {
  if (!style) return undefined;
  const out: TextStyle = {};
  const light = safeColor(style.light);
  const color = scheme === "dark" ? (safeColor(style.dark) ?? light) : light;
  if (color) out.color = color;
  const font = style.fontStyle ?? 0;
  if (font & ITALIC) out.fontStyle = "italic";
  if (font & BOLD) out.fontWeight = "700";
  if (font & UNDERLINE) out.textDecorationLine = "underline";
  return Object.keys(out).length ? out : undefined;
}

export type CodeLine = {
  tokens: readonly { text: string; style: TextStyle | undefined }[];
  /** Whether the source marked this 1-based line for emphasis. */
  emphasized: boolean;
};

/**
 * Stored tokens when they rebuild `value` exactly (as on the web), else one plain token per source
 * line, so a stale highlight can never change the code on screen.
 *
 * The final line is dropped when it is empty, because React Native renders a trailing newline as an
 * extra blank line while a browser's `pre` does not. Only the on-screen text loses that newline;
 * the copy button still copies `value`.
 */
export function resolveCodeLines(block: CodeBlock, scheme: "light" | "dark"): CodeLine[] {
  const stored = block.highlight?.lines;
  const exact =
    stored && stored.map((line) => line.map(([text]) => text).join("")).join("\n") === block.value;
  const lines: readonly (readonly (readonly [string, number])[])[] = exact
    ? stored
    : block.value.split("\n").map((line) => [[line, 0] as const]);
  const styles = block.highlight?.styles;
  const emphasized = new Set(block.highlightLines);
  const last = lines.at(-1);
  const shown =
    last && last.every(([text]) => text === "") && lines.length > 1 ? lines.slice(0, -1) : lines;
  return shown.map((line, index) => ({
    emphasized: emphasized.has(index + 1),
    tokens: line.map(([text, styleIndex]) => ({
      text,
      style: exact && styleIndex > 0 ? tokenStyle(styles?.[styleIndex], scheme) : undefined,
    })),
  }));
}
