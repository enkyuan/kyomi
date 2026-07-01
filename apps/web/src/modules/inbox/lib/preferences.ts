import type {
  InboxDensityDto,
  InboxMarkReadBehaviorDto,
  InboxPreferencesDto,
  InboxTimestampDisplayDto,
  InboxTimestampHourCycleDto,
} from "@lib/schemas";

const MIN_INBOX_FONT_SIZE_PX = 14;
const MAX_INBOX_FONT_SIZE_PX = 20;

export type InboxPreferences = InboxPreferencesDto;

export const DEFAULT_INBOX_PREFERENCES: InboxPreferences = {
  inboxDefaultView: "today",
  inboxDensity: "comfortable",
  articleOpenBehavior: "split",
  inboxMarkReadBehavior: "on-open",
  inboxTimestampDisplay: "absolute",
  inboxTimestampHourCycle: "12h",
  inboxFontSizePx: 16,
  inboxShowFavicons: true,
};

function clampInboxFontSize(value: unknown): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return DEFAULT_INBOX_PREFERENCES.inboxFontSizePx;
  }
  return Math.max(MIN_INBOX_FONT_SIZE_PX, Math.min(MAX_INBOX_FONT_SIZE_PX, Math.round(value)));
}

function parseInboxDensity(value: unknown): InboxDensityDto {
  return value === "compact" || value === "comfortable"
    ? value
    : DEFAULT_INBOX_PREFERENCES.inboxDensity;
}

function parseArticleOpenBehavior(value: unknown): InboxPreferences["articleOpenBehavior"] {
  return value === "reader" || value === "split"
    ? value
    : DEFAULT_INBOX_PREFERENCES.articleOpenBehavior;
}

function parseMarkReadBehavior(value: unknown): InboxMarkReadBehaviorDto {
  return value === "after-delay" || value === "manual" || value === "on-open"
    ? value
    : DEFAULT_INBOX_PREFERENCES.inboxMarkReadBehavior;
}

function parseTimestampDisplay(value: unknown): InboxTimestampDisplayDto {
  return value === "relative" || value === "absolute"
    ? value
    : DEFAULT_INBOX_PREFERENCES.inboxTimestampDisplay;
}

function parseTimestampHourCycle(value: unknown): InboxTimestampHourCycleDto {
  return value === "24h" || value === "12h"
    ? value
    : DEFAULT_INBOX_PREFERENCES.inboxTimestampHourCycle;
}

function parseDefaultView(value: unknown): InboxPreferences["inboxDefaultView"] {
  if (value === "inbox" || value === "all") {
    return "all";
  }
  return value === "today" || value === "unread" || value === "saved" || value === "recent"
    ? value
    : DEFAULT_INBOX_PREFERENCES.inboxDefaultView;
}

export function sanitizeInboxPreferences(value: unknown): InboxPreferences {
  if (!value || typeof value !== "object") {
    return DEFAULT_INBOX_PREFERENCES;
  }

  const record = value as Partial<InboxPreferences>;
  return {
    inboxDefaultView: parseDefaultView(record.inboxDefaultView),
    inboxDensity: parseInboxDensity(record.inboxDensity),
    articleOpenBehavior: parseArticleOpenBehavior(record.articleOpenBehavior),
    inboxMarkReadBehavior: parseMarkReadBehavior(record.inboxMarkReadBehavior),
    inboxTimestampDisplay: parseTimestampDisplay(record.inboxTimestampDisplay),
    inboxTimestampHourCycle: parseTimestampHourCycle(record.inboxTimestampHourCycle),
    inboxFontSizePx: clampInboxFontSize(record.inboxFontSizePx),
    inboxShowFavicons:
      typeof record.inboxShowFavicons === "boolean"
        ? record.inboxShowFavicons
        : DEFAULT_INBOX_PREFERENCES.inboxShowFavicons,
  };
}

export function normalizeInboxPreferencePatch(
  current: InboxPreferences,
  next: Partial<InboxPreferences>,
): InboxPreferences {
  return sanitizeInboxPreferences({ ...current, ...next });
}

export function getInboxPreferenceLimits() {
  return {
    minFontSizePx: MIN_INBOX_FONT_SIZE_PX,
    maxFontSizePx: MAX_INBOX_FONT_SIZE_PX,
  };
}
