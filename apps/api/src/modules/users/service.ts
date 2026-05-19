import { and, eq, ne } from "drizzle-orm";
import { userPreferences, users } from "@vols.rss/db";
import { normalizeEmail } from "@/lib/email";
import type { db } from "@adapters/db/client";
import { AppError } from "@shared/errors/app-error";
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
  UserProfileDto,
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

function sanitizePreferencesPatch(input: UpdateUserPreferencesDto): UpdateUserPreferencesDto {
  const next: UpdateUserPreferencesDto = {};

  if (input.defaultMode !== undefined) {
    if (
      input.defaultMode !== "smart" &&
      input.defaultMode !== "original" &&
      input.defaultMode !== "extracted"
    ) {
      throw new AppError("Unsupported reader mode.", {
        status: 400,
        code: "USER_PREFERENCES_INVALID_READER_MODE",
      });
    }
    next.defaultMode = input.defaultMode;
  }

  if (input.fontSizePx !== undefined) {
    next.fontSizePx = clampReaderFontSize(input.fontSizePx);
  }

  if (input.contentWidth !== undefined) {
    if (input.contentWidth !== "narrow" && input.contentWidth !== "wide") {
      throw new AppError("Unsupported reader content width.", {
        status: 400,
        code: "USER_PREFERENCES_INVALID_CONTENT_WIDTH",
      });
    }
    next.contentWidth = input.contentWidth;
  }

  if (input.openLinksInNewTab !== undefined) {
    next.openLinksInNewTab = Boolean(input.openLinksInNewTab);
  }

  if (input.showLinkPreviews !== undefined) {
    next.showLinkPreviews = Boolean(input.showLinkPreviews);
  }

  if (input.showImages !== undefined) {
    next.showImages = Boolean(input.showImages);
  }

  if (input.inboxDefaultView !== undefined) {
    if (
      input.inboxDefaultView !== "inbox" &&
      input.inboxDefaultView !== "today" &&
      input.inboxDefaultView !== "unread" &&
      input.inboxDefaultView !== "saved"
    ) {
      throw new AppError("Unsupported inbox default view.", {
        status: 400,
        code: "USER_PREFERENCES_INVALID_INBOX_DEFAULT_VIEW",
      });
    }
    next.inboxDefaultView = input.inboxDefaultView;
  }

  if (input.inboxDensity !== undefined) {
    if (input.inboxDensity !== "comfortable" && input.inboxDensity !== "compact") {
      throw new AppError("Unsupported inbox density.", {
        status: 400,
        code: "USER_PREFERENCES_INVALID_INBOX_DENSITY",
      });
    }
    next.inboxDensity = input.inboxDensity;
  }

  if (input.articleOpenBehavior !== undefined) {
    if (input.articleOpenBehavior !== "split" && input.articleOpenBehavior !== "reader") {
      throw new AppError("Unsupported article open behavior.", {
        status: 400,
        code: "USER_PREFERENCES_INVALID_ARTICLE_OPEN_BEHAVIOR",
      });
    }
    next.articleOpenBehavior = input.articleOpenBehavior;
  }

  if (input.inboxMarkReadBehavior !== undefined) {
    if (
      input.inboxMarkReadBehavior !== "on-open" &&
      input.inboxMarkReadBehavior !== "after-delay" &&
      input.inboxMarkReadBehavior !== "manual"
    ) {
      throw new AppError("Unsupported inbox mark as read behavior.", {
        status: 400,
        code: "USER_PREFERENCES_INVALID_INBOX_MARK_READ_BEHAVIOR",
      });
    }
    next.inboxMarkReadBehavior = input.inboxMarkReadBehavior;
  }

  if (input.inboxTimestampDisplay !== undefined) {
    if (input.inboxTimestampDisplay !== "absolute" && input.inboxTimestampDisplay !== "relative") {
      throw new AppError("Unsupported inbox timestamp display.", {
        status: 400,
        code: "USER_PREFERENCES_INVALID_INBOX_TIMESTAMP_DISPLAY",
      });
    }
    next.inboxTimestampDisplay = input.inboxTimestampDisplay;
  }

  if (input.inboxTimestampHourCycle !== undefined) {
    if (input.inboxTimestampHourCycle !== "12h" && input.inboxTimestampHourCycle !== "24h") {
      throw new AppError("Unsupported inbox timestamp hour cycle.", {
        status: 400,
        code: "USER_PREFERENCES_INVALID_INBOX_TIMESTAMP_HOUR_CYCLE",
      });
    }
    next.inboxTimestampHourCycle = input.inboxTimestampHourCycle;
  }

  if (input.inboxFontSizePx !== undefined) {
    next.inboxFontSizePx = clampInboxFontSize(input.inboxFontSizePx);
  }

  if (input.inboxShowRecents !== undefined) {
    next.inboxShowRecents = Boolean(input.inboxShowRecents);
  }

  if (input.inboxShowFavicons !== undefined) {
    next.inboxShowFavicons = Boolean(input.inboxShowFavicons);
  }

  return next;
}

export async function getUserProfileById(
  database: DB,
  userId: string,
): Promise<UserProfileDto | null> {
  const row = await database.query.users.findFirst({
    where: eq(users.id, userId),
    columns: {
      id: true,
      name: true,
      email: true,
      emailVerified: true,
      image: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    emailVerified: row.emailVerified,
    image: row.image,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function updateUserEmailById(
  database: DB,
  userId: string,
  emailInput: string,
): Promise<UserProfileDto> {
  const normalizedEmail = normalizeEmail(emailInput);
  if (!normalizedEmail) {
    throw new AppError("Enter a valid email address.", {
      status: 400,
      code: "USER_EMAIL_INVALID",
    });
  }
  const email = normalizedEmail;

  const conflictingUser = await database.query.users.findFirst({
    where: and(eq(users.email, email), ne(users.id, userId)),
    columns: { id: true },
  });

  if (conflictingUser) {
    throw new AppError("This email is already in use.", {
      status: 409,
      code: "USER_EMAIL_CONFLICT",
    });
  }

  const [updatedRow] = await database
    .update(users)
    .set({
      email,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId))
    .returning({
      id: users.id,
      name: users.name,
      email: users.email,
      emailVerified: users.emailVerified,
      image: users.image,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    });

  if (!updatedRow) {
    throw new AppError("User not found", { status: 404, code: "USER_NOT_FOUND" });
  }

  return {
    id: updatedRow.id,
    name: updatedRow.name,
    email: updatedRow.email,
    emailVerified: updatedRow.emailVerified,
    image: updatedRow.image,
    createdAt: updatedRow.createdAt.toISOString(),
    updatedAt: updatedRow.updatedAt.toISOString(),
  };
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
