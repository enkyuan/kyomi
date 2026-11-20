import { Effect } from "effect";
import { eq } from "drizzle-orm";
import { userPreferences } from "@kyomi/db";
import { Db } from "@adapters/db/service";
import { BadRequest } from "@shared/effect/errors";
import { currentDate } from "@shared/effect/clock";
import { CurrentUser } from "@shared/effect/request";
import type { UpdateUserPreferencesDto, UserPreferencesDto } from "./types";

type PreferenceColumns = typeof userPreferences.$inferInsert;
type PreferenceKey = keyof UserPreferencesDto;

export const DEFAULT_USER_PREFERENCES: UserPreferencesDto = {
  language: "en",
  defaultMode: "smart",
  fontSizePx: 17,
  contentWidth: "wide",
  openLinksInNewTab: true,
  showLinkPreviews: true,
  showImages: true,
  rememberPosition: true,
  inboxDefaultView: "my-feed",
  inboxDensity: "comfortable",
  articleOpenBehavior: "split",
  inboxMarkReadBehavior: "on-open",
  inboxTimestampDisplay: "relative",
  inboxTimestampHourCycle: "12h",
  inboxFontSizePx: 16,
  inboxShowFavicons: true,
};

/** The `user_preferences` column that stores each preference. */
const COLUMN_BY_KEY = {
  language: "language",
  defaultMode: "readerMode",
  fontSizePx: "readerFontSizePx",
  contentWidth: "readerContentWidth",
  openLinksInNewTab: "readerOpenLinksInNewTab",
  showLinkPreviews: "readerShowLinkPreviews",
  showImages: "readerShowImages",
  rememberPosition: "readerRememberPosition",
  inboxDefaultView: "inboxDefaultView",
  inboxDensity: "inboxDensity",
  articleOpenBehavior: "articleOpenBehavior",
  inboxMarkReadBehavior: "inboxMarkReadBehavior",
  inboxTimestampDisplay: "inboxTimestampDisplay",
  inboxTimestampHourCycle: "inboxTimestampHourCycle",
  inboxFontSizePx: "inboxFontSizePx",
  inboxShowFavicons: "inboxShowFavicons",
} as const satisfies Record<PreferenceKey, keyof PreferenceColumns>;

type ChoiceKey =
  | "defaultMode"
  | "contentWidth"
  | "inboxDefaultView"
  | "inboxDensity"
  | "articleOpenBehavior"
  | "inboxMarkReadBehavior"
  | "inboxTimestampDisplay"
  | "inboxTimestampHourCycle";

type Choice<K extends ChoiceKey> = {
  /** The accepted values; the first invalid one in a patch is rejected with `code`. */
  readonly values: readonly UserPreferencesDto[K][];
  /** Values older clients or rows may still hold, mapped to a current one when read. */
  readonly aliases?: Readonly<Record<string, UserPreferencesDto[K]>>;
  readonly message: string;
  readonly code: string;
};

/** Text preferences with a closed set of values, in the order patches are validated. */
const CHOICES: { readonly [K in ChoiceKey]: Choice<K> } = {
  defaultMode: {
    values: ["smart", "original", "extracted"],
    message: "Unsupported reader mode.",
    code: "USER_PREFERENCES_INVALID_READER_MODE",
  },
  contentWidth: {
    values: ["narrow", "wide"],
    aliases: { medium: "wide" },
    message: "Unsupported reader content width.",
    code: "USER_PREFERENCES_INVALID_CONTENT_WIDTH",
  },
  inboxDefaultView: {
    values: ["my-feed", "all", "saved", "recent"],
    aliases: { inbox: "my-feed", today: "my-feed", unread: "my-feed" },
    message: "Unsupported inbox default view.",
    code: "USER_PREFERENCES_INVALID_INBOX_DEFAULT_VIEW",
  },
  inboxDensity: {
    values: ["comfortable", "compact"],
    message: "Unsupported inbox density.",
    code: "USER_PREFERENCES_INVALID_INBOX_DENSITY",
  },
  articleOpenBehavior: {
    values: ["split", "reader"],
    message: "Unsupported article open behavior.",
    code: "USER_PREFERENCES_INVALID_ARTICLE_OPEN_BEHAVIOR",
  },
  inboxMarkReadBehavior: {
    values: ["on-open", "after-delay", "manual"],
    message: "Unsupported inbox mark as read behavior.",
    code: "USER_PREFERENCES_INVALID_INBOX_MARK_READ_BEHAVIOR",
  },
  inboxTimestampDisplay: {
    values: ["absolute", "relative", "relative-long", "date", "iso"],
    message: "Unsupported inbox timestamp display.",
    code: "USER_PREFERENCES_INVALID_INBOX_TIMESTAMP_DISPLAY",
  },
  inboxTimestampHourCycle: {
    values: ["12h", "24h"],
    message: "Unsupported inbox timestamp hour cycle.",
    code: "USER_PREFERENCES_INVALID_INBOX_TIMESTAMP_HOUR_CYCLE",
  },
};

const CHOICE_KEYS = Object.keys(CHOICES) as ChoiceKey[];

const FONT_SIZE_RANGES = {
  fontSizePx: { min: 14, max: 22 },
  inboxFontSizePx: { min: 14, max: 20 },
} as const;

const BOOLEAN_KEYS = [
  "openLinksInNewTab",
  "showLinkPreviews",
  "showImages",
  "rememberPosition",
  "inboxShowFavicons",
] as const;

function clampFontSize(key: keyof typeof FONT_SIZE_RANGES, value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_USER_PREFERENCES[key];
  }
  const { min, max } = FONT_SIZE_RANGES[key];
  return Math.max(min, Math.min(max, Math.round(value)));
}

/** A stored value as a current choice, falling back to the default for anything unknown. */
function readChoice<K extends ChoiceKey>(key: K, value: string): UserPreferencesDto[K] {
  const choice: Choice<K> = CHOICES[key];
  const values: readonly string[] = choice.values;
  if (values.includes(value)) {
    return value as UserPreferencesDto[K];
  }
  return choice.aliases?.[value] ?? DEFAULT_USER_PREFERENCES[key];
}

function rowToPreferences(row: typeof userPreferences.$inferSelect): UserPreferencesDto {
  const stored: Record<string, unknown> = row;
  const preferences: Record<string, unknown> = {};
  for (const key of Object.keys(COLUMN_BY_KEY) as PreferenceKey[]) {
    preferences[key] = stored[COLUMN_BY_KEY[key]];
  }
  for (const key of CHOICE_KEYS) {
    preferences[key] = readChoice(key, String(preferences[key]));
  }
  for (const key of ["fontSizePx", "inboxFontSizePx"] as const) {
    preferences[key] = clampFontSize(key, Number(preferences[key]));
  }
  return preferences as UserPreferencesDto;
}

/** `user_preferences` column values for a (partial) set of preferences. */
function toColumns(preferences: UpdateUserPreferencesDto): Partial<PreferenceColumns> {
  const columns: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(preferences)) {
    if (value !== undefined) {
      columns[COLUMN_BY_KEY[key as PreferenceKey]] = value;
    }
  }
  return columns as Partial<PreferenceColumns>;
}

/**
 * The patch a request may apply: unknown choice values are rejected with their own code, font
 * sizes are clamped into range and booleans coerced.
 */
const sanitizePatch = Effect.fn("users.preferences.sanitize")(function* (
  input: UpdateUserPreferencesDto,
) {
  const next: Record<string, unknown> = {};
  if (input.language !== undefined) {
    try {
      next.language = Intl.getCanonicalLocales(input.language)[0];
    } catch {
      return yield* new BadRequest({
        message: "Enter a valid language tag.",
        code: "LANGUAGE_INVALID",
      });
    }
  }

  for (const key of CHOICE_KEYS) {
    const value = input[key];
    if (value === undefined) {
      continue;
    }
    const choice: Choice<ChoiceKey> = CHOICES[key];
    const allowed: readonly unknown[] = choice.values;
    if (typeof value !== "string" || !allowed.includes(value)) {
      return yield* new BadRequest({ message: choice.message, code: choice.code });
    }
    next[key] = value;
  }

  for (const key of ["inboxFontSizePx", "fontSizePx"] as const) {
    if (input[key] !== undefined) {
      next[key] = clampFontSize(key, input[key]);
    }
  }
  for (const key of BOOLEAN_KEYS) {
    if (input[key] !== undefined) {
      next[key] = Boolean(input[key]);
    }
  }
  return next as UpdateUserPreferencesDto;
});

export const getUserPreferences = Effect.gen(function* () {
  const { userId } = yield* CurrentUser;
  const db = yield* Db;
  const row = yield* db.use("users.preferences.get", (client) =>
    client.query.userPreferences.findFirst({ where: eq(userPreferences.userId, userId) }),
  );
  return row ? rowToPreferences(row) : DEFAULT_USER_PREFERENCES;
});

export const updateUserPreferences = Effect.fn("users.preferences.update")(function* (
  input: UpdateUserPreferencesDto,
) {
  const { userId } = yield* CurrentUser;
  const db = yield* Db;
  const patch = yield* sanitizePatch(input);
  const now = yield* currentDate;

  const [seededRow] = yield* db.use("users.preferences.seed", (client) =>
    client
      .insert(userPreferences)
      .values({
        userId,
        ...toColumns(DEFAULT_USER_PREFERENCES),
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing({ target: userPreferences.userId })
      .returning(),
  );

  const [updatedRow] = yield* db.use("users.preferences.update", (client) =>
    client
      .update(userPreferences)
      .set({ ...toColumns(patch), updatedAt: now })
      .where(eq(userPreferences.userId, userId))
      .returning(),
  );

  const finalRow = updatedRow ?? seededRow;
  return finalRow ? rowToPreferences(finalRow) : yield* getUserPreferences;
});
