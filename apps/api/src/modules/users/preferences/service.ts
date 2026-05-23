import { eq } from "drizzle-orm";
import { userPreferences } from "@vols.rss/db";
import type { db } from "@adapters/db/client";
import { AppError } from "@shared/errors/app";
import type {
  ArticleOpenBehaviorDto,
  InboxDefaultViewDto,
  InboxDensityDto,
  InboxMarkReadBehaviorDto,
  InboxTimestampDisplayDto,
  InboxTimestampHourCycleDto,
  ReaderContentWidthDto,
  ReaderDefaultModeDto,
  UpdateUserPreferencesDto,
  UserPreferencesDto,
} from "./types";

type DB = typeof db;

const MIN_READER_FONT_SIZE_PX = 14;
const MAX_READER_FONT_SIZE_PX = 22;
const MIN_INBOX_FONT_SIZE_PX = 14;
const MAX_INBOX_FONT_SIZE_PX = 20;

export const DEFAULT_USER_PREFERENCES: UserPreferencesDto = {
  defaultMode: "smart",
  fontSizePx: 17,
  contentWidth: "wide",
  openLinksInNewTab: true,
  showLinkPreviews: true,
  showImages: true,
  inboxDefaultView: "today",
  inboxDensity: "comfortable",
  articleOpenBehavior: "split",
  inboxMarkReadBehavior: "on-open",
  inboxTimestampDisplay: "absolute",
  inboxTimestampHourCycle: "12h",
  inboxFontSizePx: 16,
  inboxShowRecents: false,
  inboxShowFavicons: true,
};

function parseReaderMode(value: string): ReaderDefaultModeDto {
  if (value === "smart" || value === "original" || value === "extracted") {
    return value;
  }
  return DEFAULT_USER_PREFERENCES.defaultMode;
}

function parseContentWidth(value: string): ReaderContentWidthDto {
  if (value === "narrow" || value === "wide") {
    return value;
  }
  if (value === "medium") {
    return "wide";
  }
  return DEFAULT_USER_PREFERENCES.contentWidth;
}

function parseInboxDefaultView(value: string): InboxDefaultViewDto {
  if (value === "inbox" || value === "today" || value === "unread" || value === "saved") {
    return value;
  }
  return DEFAULT_USER_PREFERENCES.inboxDefaultView;
}

function parseInboxDensity(value: string): InboxDensityDto {
  if (value === "comfortable" || value === "compact") {
    return value;
  }
  return DEFAULT_USER_PREFERENCES.inboxDensity;
}

function parseArticleOpenBehavior(value: string): ArticleOpenBehaviorDto {
  if (value === "split" || value === "reader") {
    return value;
  }
  return DEFAULT_USER_PREFERENCES.articleOpenBehavior;
}

function parseInboxMarkReadBehavior(value: string): InboxMarkReadBehaviorDto {
  if (value === "on-open" || value === "after-delay" || value === "manual") {
    return value;
  }
  return DEFAULT_USER_PREFERENCES.inboxMarkReadBehavior;
}

function parseInboxTimestampDisplay(value: string): InboxTimestampDisplayDto {
  if (value === "absolute" || value === "relative") {
    return value;
  }
  return DEFAULT_USER_PREFERENCES.inboxTimestampDisplay;
}

function parseInboxTimestampHourCycle(value: string): InboxTimestampHourCycleDto {
  if (value === "12h" || value === "24h") {
    return value;
  }
  return DEFAULT_USER_PREFERENCES.inboxTimestampHourCycle;
}

function clampReaderFontSize(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_USER_PREFERENCES.fontSizePx;
  }
  return Math.max(MIN_READER_FONT_SIZE_PX, Math.min(MAX_READER_FONT_SIZE_PX, Math.round(value)));
}

function clampInboxFontSize(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_USER_PREFERENCES.inboxFontSizePx;
  }
  return Math.max(MIN_INBOX_FONT_SIZE_PX, Math.min(MAX_INBOX_FONT_SIZE_PX, Math.round(value)));
}

function rowToPreferences(row: typeof userPreferences.$inferSelect): UserPreferencesDto {
  return {
    defaultMode: parseReaderMode(row.readerMode),
    fontSizePx: clampReaderFontSize(row.readerFontSizePx),
    contentWidth: parseContentWidth(row.readerContentWidth),
    openLinksInNewTab: row.readerOpenLinksInNewTab,
    showLinkPreviews: row.readerShowLinkPreviews,
    showImages: row.readerShowImages,
    inboxDefaultView: parseInboxDefaultView(row.inboxDefaultView),
    inboxDensity: parseInboxDensity(row.inboxDensity),
    articleOpenBehavior: parseArticleOpenBehavior(row.articleOpenBehavior),
    inboxMarkReadBehavior: parseInboxMarkReadBehavior(row.inboxMarkReadBehavior),
    inboxTimestampDisplay: parseInboxTimestampDisplay(row.inboxTimestampDisplay),
    inboxTimestampHourCycle: parseInboxTimestampHourCycle(row.inboxTimestampHourCycle),
    inboxFontSizePx: clampInboxFontSize(row.inboxFontSizePx),
    inboxShowRecents: row.inboxShowRecents,
    inboxShowFavicons: row.inboxShowFavicons,
  };
}

type StringPreferenceKey =
  | "defaultMode"
  | "contentWidth"
  | "inboxDefaultView"
  | "inboxDensity"
  | "articleOpenBehavior"
  | "inboxMarkReadBehavior"
  | "inboxTimestampDisplay"
  | "inboxTimestampHourCycle";

const STRING_PREFERENCE_RULES: Array<{
  key: StringPreferenceKey;
  values: readonly string[];
  message: string;
  code: string;
}> = [
  {
    key: "defaultMode",
    values: ["smart", "original", "extracted"],
    message: "Unsupported reader mode.",
    code: "USER_PREFERENCES_INVALID_READER_MODE",
  },
  {
    key: "contentWidth",
    values: ["narrow", "wide"],
    message: "Unsupported reader content width.",
    code: "USER_PREFERENCES_INVALID_CONTENT_WIDTH",
  },
  {
    key: "inboxDefaultView",
    values: ["inbox", "today", "unread", "saved"],
    message: "Unsupported inbox default view.",
    code: "USER_PREFERENCES_INVALID_INBOX_DEFAULT_VIEW",
  },
  {
    key: "inboxDensity",
    values: ["comfortable", "compact"],
    message: "Unsupported inbox density.",
    code: "USER_PREFERENCES_INVALID_INBOX_DENSITY",
  },
  {
    key: "articleOpenBehavior",
    values: ["split", "reader"],
    message: "Unsupported article open behavior.",
    code: "USER_PREFERENCES_INVALID_ARTICLE_OPEN_BEHAVIOR",
  },
  {
    key: "inboxMarkReadBehavior",
    values: ["on-open", "after-delay", "manual"],
    message: "Unsupported inbox mark as read behavior.",
    code: "USER_PREFERENCES_INVALID_INBOX_MARK_READ_BEHAVIOR",
  },
  {
    key: "inboxTimestampDisplay",
    values: ["absolute", "relative"],
    message: "Unsupported inbox timestamp display.",
    code: "USER_PREFERENCES_INVALID_INBOX_TIMESTAMP_DISPLAY",
  },
  {
    key: "inboxTimestampHourCycle",
    values: ["12h", "24h"],
    message: "Unsupported inbox timestamp hour cycle.",
    code: "USER_PREFERENCES_INVALID_INBOX_TIMESTAMP_HOUR_CYCLE",
  },
];

const BOOLEAN_PREFERENCE_KEYS = [
  "openLinksInNewTab",
  "showLinkPreviews",
  "showImages",
  "inboxShowRecents",
  "inboxShowFavicons",
] as const;

function setStringPreference(
  next: UpdateUserPreferencesDto,
  key: StringPreferenceKey,
  value: string,
): void {
  switch (key) {
    case "defaultMode":
      next.defaultMode = value as ReaderDefaultModeDto;
      return;
    case "contentWidth":
      next.contentWidth = value as ReaderContentWidthDto;
      return;
    case "inboxDefaultView":
      next.inboxDefaultView = value as InboxDefaultViewDto;
      return;
    case "inboxDensity":
      next.inboxDensity = value as InboxDensityDto;
      return;
    case "articleOpenBehavior":
      next.articleOpenBehavior = value as ArticleOpenBehaviorDto;
      return;
    case "inboxMarkReadBehavior":
      next.inboxMarkReadBehavior = value as InboxMarkReadBehaviorDto;
      return;
    case "inboxTimestampDisplay":
      next.inboxTimestampDisplay = value as InboxTimestampDisplayDto;
      return;
    case "inboxTimestampHourCycle":
      next.inboxTimestampHourCycle = value as InboxTimestampHourCycleDto;
      return;
  }
}

function sanitizePreferencesPatch(input: UpdateUserPreferencesDto): UpdateUserPreferencesDto {
  const next: UpdateUserPreferencesDto = {};

  for (const rule of STRING_PREFERENCE_RULES) {
    const value = input[rule.key];
    if (value === undefined) {
      continue;
    }
    if (typeof value !== "string" || !rule.values.includes(value)) {
      throw new AppError(rule.message, { status: 400, code: rule.code });
    }
    setStringPreference(next, rule.key, value);
  }

  if (input.inboxFontSizePx !== undefined) {
    next.inboxFontSizePx = clampInboxFontSize(input.inboxFontSizePx);
  }

  if (input.fontSizePx !== undefined) {
    next.fontSizePx = clampReaderFontSize(input.fontSizePx);
  }

  for (const key of BOOLEAN_PREFERENCE_KEYS) {
    if (input[key] !== undefined) {
      (next as Record<typeof key, boolean>)[key] = Boolean(input[key]);
    }
  }

  return next;
}

export async function getUserPreferences(
  database: DB,
  userId: string,
): Promise<UserPreferencesDto> {
  const row = await database.query.userPreferences.findFirst({
    where: eq(userPreferences.userId, userId),
  });

  return row ? rowToPreferences(row) : DEFAULT_USER_PREFERENCES;
}

export async function updateUserPreferences(
  database: DB,
  userId: string,
  input: UpdateUserPreferencesDto,
): Promise<UserPreferencesDto> {
  const patch = sanitizePreferencesPatch(input);
  const now = new Date();

  const [seededRow] = await database
    .insert(userPreferences)
    .values({
      userId,
      readerMode: DEFAULT_USER_PREFERENCES.defaultMode,
      inboxDefaultView: DEFAULT_USER_PREFERENCES.inboxDefaultView,
      inboxDensity: DEFAULT_USER_PREFERENCES.inboxDensity,
      articleOpenBehavior: DEFAULT_USER_PREFERENCES.articleOpenBehavior,
      inboxMarkReadBehavior: DEFAULT_USER_PREFERENCES.inboxMarkReadBehavior,
      inboxTimestampDisplay: DEFAULT_USER_PREFERENCES.inboxTimestampDisplay,
      inboxTimestampHourCycle: DEFAULT_USER_PREFERENCES.inboxTimestampHourCycle,
      inboxFontSizePx: DEFAULT_USER_PREFERENCES.inboxFontSizePx,
      inboxShowRecents: DEFAULT_USER_PREFERENCES.inboxShowRecents,
      inboxShowFavicons: DEFAULT_USER_PREFERENCES.inboxShowFavicons,
      readerFontSizePx: DEFAULT_USER_PREFERENCES.fontSizePx,
      readerContentWidth: DEFAULT_USER_PREFERENCES.contentWidth,
      readerOpenLinksInNewTab: DEFAULT_USER_PREFERENCES.openLinksInNewTab,
      readerShowLinkPreviews: DEFAULT_USER_PREFERENCES.showLinkPreviews,
      readerShowImages: DEFAULT_USER_PREFERENCES.showImages,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing({
      target: userPreferences.userId,
    })
    .returning();

  const updateSet: Partial<typeof userPreferences.$inferInsert> = {
    updatedAt: now,
  };
  if (patch.defaultMode !== undefined) {
    updateSet.readerMode = patch.defaultMode;
  }
  if (patch.inboxDefaultView !== undefined) {
    updateSet.inboxDefaultView = patch.inboxDefaultView;
  }
  if (patch.inboxDensity !== undefined) {
    updateSet.inboxDensity = patch.inboxDensity;
  }
  if (patch.articleOpenBehavior !== undefined) {
    updateSet.articleOpenBehavior = patch.articleOpenBehavior;
  }
  if (patch.inboxMarkReadBehavior !== undefined) {
    updateSet.inboxMarkReadBehavior = patch.inboxMarkReadBehavior;
  }
  if (patch.inboxTimestampDisplay !== undefined) {
    updateSet.inboxTimestampDisplay = patch.inboxTimestampDisplay;
  }
  if (patch.inboxTimestampHourCycle !== undefined) {
    updateSet.inboxTimestampHourCycle = patch.inboxTimestampHourCycle;
  }
  if (patch.inboxFontSizePx !== undefined) {
    updateSet.inboxFontSizePx = patch.inboxFontSizePx;
  }
  if (patch.inboxShowRecents !== undefined) {
    updateSet.inboxShowRecents = patch.inboxShowRecents;
  }
  if (patch.inboxShowFavicons !== undefined) {
    updateSet.inboxShowFavicons = patch.inboxShowFavicons;
  }
  if (patch.fontSizePx !== undefined) {
    updateSet.readerFontSizePx = patch.fontSizePx;
  }
  if (patch.contentWidth !== undefined) {
    updateSet.readerContentWidth = patch.contentWidth;
  }
  if (patch.openLinksInNewTab !== undefined) {
    updateSet.readerOpenLinksInNewTab = patch.openLinksInNewTab;
  }
  if (patch.showLinkPreviews !== undefined) {
    updateSet.readerShowLinkPreviews = patch.showLinkPreviews;
  }
  if (patch.showImages !== undefined) {
    updateSet.readerShowImages = patch.showImages;
  }

  const [updatedRow] = await database
    .update(userPreferences)
    .set(updateSet)
    .where(eq(userPreferences.userId, userId))
    .returning();

  const finalRow = updatedRow ?? seededRow;
  if (finalRow) {
    return rowToPreferences(finalRow);
  }

  return getUserPreferences(database, userId);
}
