import type { ReaderContentWidth, ReaderDefaultMode, ReaderPreferences } from "./types";

export const DEFAULT_READER_PREFERENCES: ReaderPreferences = {
  defaultMode: "smart",
  fontSizePx: 17,
  contentWidth: "wide",
  openLinksInNewTab: true,
  showLinkPreviews: true,
  showImages: true,
};

export const MIN_READER_FONT_SIZE_PX = 14;
export const MAX_READER_FONT_SIZE_PX = 22;

export function clampReaderFontSize(value: unknown): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return DEFAULT_READER_PREFERENCES.fontSizePx;
  }
  return Math.max(MIN_READER_FONT_SIZE_PX, Math.min(MAX_READER_FONT_SIZE_PX, Math.round(value)));
}

export function parseReaderDefaultMode(value: unknown): ReaderDefaultMode {
  if (value === "original" || value === "extracted" || value === "smart") {
    return value;
  }
  return DEFAULT_READER_PREFERENCES.defaultMode;
}

export function parseReaderContentWidth(value: unknown): ReaderContentWidth {
  if (value === "narrow" || value === "wide") {
    return value;
  }
  if (value === "medium") {
    return "wide";
  }
  return DEFAULT_READER_PREFERENCES.contentWidth;
}

export function sanitizeReaderPreferences(value: unknown): ReaderPreferences {
  if (!value || typeof value !== "object") {
    return DEFAULT_READER_PREFERENCES;
  }
  const record = value as Partial<ReaderPreferences>;
  return {
    defaultMode: parseReaderDefaultMode(record.defaultMode),
    fontSizePx: clampReaderFontSize(record.fontSizePx),
    contentWidth: parseReaderContentWidth(record.contentWidth),
    openLinksInNewTab:
      typeof record.openLinksInNewTab === "boolean"
        ? record.openLinksInNewTab
        : DEFAULT_READER_PREFERENCES.openLinksInNewTab,
    showLinkPreviews:
      typeof record.showLinkPreviews === "boolean"
        ? record.showLinkPreviews
        : DEFAULT_READER_PREFERENCES.showLinkPreviews,
    showImages:
      typeof record.showImages === "boolean"
        ? record.showImages
        : DEFAULT_READER_PREFERENCES.showImages,
  };
}
