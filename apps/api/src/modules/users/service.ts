import { and, eq, ne } from "drizzle-orm";
import { userPreferences, users } from "@cronos/db";
import type { db } from "@adapters/db/client";
import { AppError } from "@shared/errors/app-error";
import type {
  ReaderContentWidthDto,
  ReaderDefaultModeDto,
  UpdateUserPreferencesDto,
  UserPreferencesDto,
  UserProfileDto,
} from "./types";

type DB = typeof db;

const MIN_READER_FONT_SIZE_PX = 14;
const MAX_READER_FONT_SIZE_PX = 22;

export const DEFAULT_USER_PREFERENCES: UserPreferencesDto = {
  defaultMode: "smart",
  fontSizePx: 17,
  contentWidth: "medium",
  openLinksInNewTab: true,
  showImages: true,
};

function parseReaderMode(value: string): ReaderDefaultModeDto {
  if (value === "smart" || value === "original" || value === "extracted") {
    return value;
  }
  return DEFAULT_USER_PREFERENCES.defaultMode;
}

function parseContentWidth(value: string): ReaderContentWidthDto {
  if (value === "narrow" || value === "medium" || value === "wide") {
    return value;
  }
  return DEFAULT_USER_PREFERENCES.contentWidth;
}

function clampReaderFontSize(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_USER_PREFERENCES.fontSizePx;
  }
  return Math.max(MIN_READER_FONT_SIZE_PX, Math.min(MAX_READER_FONT_SIZE_PX, Math.round(value)));
}

function rowToPreferences(row: typeof userPreferences.$inferSelect): UserPreferencesDto {
  return {
    defaultMode: parseReaderMode(row.readerMode),
    fontSizePx: clampReaderFontSize(row.readerFontSizePx),
    contentWidth: parseContentWidth(row.readerContentWidth),
    openLinksInNewTab: row.readerOpenLinksInNewTab,
    showImages: row.readerShowImages,
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
    if (
      input.contentWidth !== "narrow" &&
      input.contentWidth !== "medium" &&
      input.contentWidth !== "wide"
    ) {
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

  if (input.showImages !== undefined) {
    next.showImages = Boolean(input.showImages);
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
  const email = emailInput.trim().toLowerCase();
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!email || !emailPattern.test(email)) {
    throw new AppError("Enter a valid email address.", {
      status: 400,
      code: "USER_EMAIL_INVALID",
    });
  }

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
      readerFontSizePx: DEFAULT_USER_PREFERENCES.fontSizePx,
      readerContentWidth: DEFAULT_USER_PREFERENCES.contentWidth,
      readerOpenLinksInNewTab: DEFAULT_USER_PREFERENCES.openLinksInNewTab,
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
  if (patch.fontSizePx !== undefined) {
    updateSet.readerFontSizePx = patch.fontSizePx;
  }
  if (patch.contentWidth !== undefined) {
    updateSet.readerContentWidth = patch.contentWidth;
  }
  if (patch.openLinksInNewTab !== undefined) {
    updateSet.readerOpenLinksInNewTab = patch.openLinksInNewTab;
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
