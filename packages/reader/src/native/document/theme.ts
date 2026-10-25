import type { ReaderContentWidth } from "../../core/types";

export type ReaderNativeColors = {
  background: string;
  foreground: string;
  muted: string;
  border: string;
  card: string;
  link: string;
  codeBackground: string;
  highlight: string;
  quoteRule: string;
  callout: Record<"note" | "tip" | "important" | "warning" | "caution", string>;
};

export type ReaderNativeFonts = {
  body: string;
  strong: string;
  heading: string;
  mono: string;
};

export type ReaderNativeTheme = {
  scheme: "light" | "dark";
  colors: ReaderNativeColors;
  fonts: ReaderNativeFonts;
  fontSize: number;
  lineHeight: number;
  /** Space between blocks, in px. */
  blockGap: number;
  /** Width of the text column, used to reserve media boxes before they load. */
  columnWidth: number;
  /** Horizontal bleed available to `wide`/`full` placements. */
  bleed: number;
  tableColumnWidth: number;
  /** Upper bound for system font scaling (Dynamic Type / Android font scale). */
  maxFontSizeMultiplier: number;
  reduceMotion: boolean;
};

const LIGHT: ReaderNativeColors = {
  background: "#f8f7f5",
  foreground: "#303030",
  muted: "#757575",
  border: "rgba(0,0,0,0.12)",
  card: "#ffffff",
  link: "#303030",
  codeBackground: "rgba(0,0,0,0.045)",
  highlight: "rgba(255,213,79,0.45)",
  quoteRule: "rgba(48,48,48,0.22)",
  callout: {
    note: "rgba(59,130,246,0.10)",
    tip: "rgba(34,197,94,0.10)",
    important: "rgba(168,85,247,0.10)",
    warning: "rgba(245,158,11,0.12)",
    caution: "rgba(239,68,68,0.10)",
  },
};

const DARK: ReaderNativeColors = {
  background: "#202020",
  foreground: "#f7f7f7",
  muted: "#a1a1aa",
  border: "rgba(255,255,255,0.14)",
  card: "#292929",
  link: "#f7f7f7",
  codeBackground: "rgba(255,255,255,0.07)",
  highlight: "rgba(255,213,79,0.30)",
  quoteRule: "rgba(247,247,247,0.25)",
  callout: {
    note: "rgba(96,165,250,0.14)",
    tip: "rgba(74,222,128,0.12)",
    important: "rgba(192,132,252,0.14)",
    warning: "rgba(251,191,36,0.14)",
    caution: "rgba(248,113,113,0.14)",
  },
};

export const DEFAULT_NATIVE_READER_FONTS: ReaderNativeFonts = {
  body: "System",
  strong: "System",
  heading: "System",
  mono: "Menlo",
};

/** Narrow keeps the text near 65 characters; wide lets tablets use more of the screen. */
export const READER_NATIVE_MAX_COLUMN_WIDTH: Record<ReaderContentWidth, number> = {
  narrow: 704,
  wide: 960,
};

export type CreateReaderNativeThemeInput = {
  scheme: "light" | "dark";
  /** Window width minus the horizontal content inset on both sides. */
  availableWidth: number;
  /** The horizontal inset the list applies; `full` placements bleed into it. */
  inset: number;
  fontSize: number;
  contentWidth?: ReaderContentWidth;
  fonts?: Partial<ReaderNativeFonts>;
  colors?: Partial<ReaderNativeColors>;
  lineHeight?: number;
  reduceMotion?: boolean;
  maxFontSizeMultiplier?: number;
};

export function createReaderNativeTheme(input: CreateReaderNativeThemeInput): ReaderNativeTheme {
  const base = input.scheme === "dark" ? DARK : LIGHT;
  const maxWidth = READER_NATIVE_MAX_COLUMN_WIDTH[input.contentWidth ?? "narrow"];
  const columnWidth = Math.max(0, Math.min(input.availableWidth, maxWidth));
  return {
    scheme: input.scheme,
    colors: { ...base, ...input.colors },
    fonts: { ...DEFAULT_NATIVE_READER_FONTS, ...input.fonts },
    fontSize: input.fontSize,
    lineHeight: input.lineHeight ?? 1.68,
    blockGap: Math.round(input.fontSize * 1.15),
    columnWidth,
    bleed: Math.max(0, input.inset),
    tableColumnWidth: 144,
    maxFontSizeMultiplier: input.maxFontSizeMultiplier ?? 2,
    reduceMotion: input.reduceMotion ?? false,
  };
}
