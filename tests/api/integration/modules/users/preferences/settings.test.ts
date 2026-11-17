import { describe, expect, mock, test } from "bun:test";
import { Effect, Layer } from "effect";
import { TestClock } from "effect/testing";
import {
  DEFAULT_USER_PREFERENCES,
  getUserPreferences,
  updateUserPreferences,
} from "@modules/users/preferences/settings";
import { CurrentUser } from "@shared/effect/request";
import { fakeDb } from "@api-tests/support/layers";

const NOW = new Date("2026-02-01T00:00:00.000Z");

/** A stored row: the defaults, in column form, with `overrides` applied. */
function storedRow(overrides: Record<string, unknown> = {}) {
  return {
    userId: "user_1",
    readerMode: "smart",
    readerFontSizePx: 17,
    readerContentWidth: "wide",
    readerOpenLinksInNewTab: true,
    readerShowLinkPreviews: true,
    readerShowImages: true,
    readerRememberPosition: true,
    inboxDefaultView: "my-feed",
    inboxDensity: "comfortable",
    articleOpenBehavior: "split",
    inboxMarkReadBehavior: "on-open",
    inboxTimestampDisplay: "relative",
    inboxTimestampHourCycle: "12h",
    inboxFontSizePx: 16,
    inboxShowFavicons: true,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function run<A, E, R>(effect: Effect.Effect<A, E, R>, client: Parameters<typeof fakeDb>[0]) {
  const layer = Layer.mergeAll(
    fakeDb(client),
    TestClock.layer(),
    Layer.succeed(CurrentUser, { userId: "user_1" }),
  );
  return Effect.runPromise(
    Effect.gen(function* () {
      yield* TestClock.setTime(NOW.getTime());
      return yield* effect;
    }).pipe(Effect.provide(layer)) as Effect.Effect<A, E>,
  );
}

const queryWith = (row: unknown) => ({
  query: { userPreferences: { findFirst: () => Promise.resolve(row) } },
});

describe("getUserPreferences", () => {
  test("returns the defaults when the user has no row", async () => {
    expect(await run(getUserPreferences, queryWith(undefined))).toEqual(DEFAULT_USER_PREFERENCES);
  });

  test("maps stored columns to preferences, upgrading legacy values and clamping sizes", async () => {
    const row = storedRow({
      readerMode: "extracted",
      readerContentWidth: "medium",
      inboxDefaultView: "today",
      inboxDensity: "mystery",
      readerFontSizePx: 99,
      inboxFontSizePx: 2,
      readerShowImages: false,
    });

    expect(await run(getUserPreferences, queryWith(row))).toEqual({
      ...DEFAULT_USER_PREFERENCES,
      defaultMode: "extracted",
      contentWidth: "wide",
      inboxDefaultView: "my-feed",
      inboxDensity: "comfortable",
      fontSizePx: 22,
      inboxFontSizePx: 14,
      showImages: false,
    });
  });
});

describe("updateUserPreferences", () => {
  function writableDb(updated: unknown) {
    const seedValues = mock((_row: Record<string, unknown>) => ({
      onConflictDoNothing: () => ({ returning: () => Promise.resolve([]) }),
    }));
    const set = mock((_values: Record<string, unknown>) => ({
      where: () => ({ returning: () => Promise.resolve([updated]) }),
    }));
    return {
      seedValues,
      set,
      client: { insert: () => ({ values: seedValues }), update: () => ({ set }) },
    };
  }

  test("seeds the defaults, then applies only the patched columns", async () => {
    const db = writableDb(storedRow({ readerMode: "original", readerFontSizePx: 20 }));

    const result = await run(
      updateUserPreferences({ defaultMode: "original", fontSizePx: 20 }),
      db.client,
    );

    expect(db.seedValues.mock.calls[0]?.[0]).toMatchObject({
      userId: "user_1",
      readerMode: "smart",
      readerFontSizePx: 17,
      inboxFontSizePx: 16,
      createdAt: NOW,
    });
    expect(db.set.mock.calls[0]?.[0]).toEqual({
      readerMode: "original",
      readerFontSizePx: 20,
      updatedAt: NOW,
    });
    expect(result).toMatchObject({ defaultMode: "original", fontSizePx: 20 });
  });

  test("clamps font sizes and coerces booleans", async () => {
    const db = writableDb(storedRow());

    await run(
      updateUserPreferences({ fontSizePx: 40, inboxFontSizePx: 1, showImages: false }),
      db.client,
    );

    expect(db.set.mock.calls[0]?.[0]).toEqual({
      readerFontSizePx: 22,
      inboxFontSizePx: 14,
      readerShowImages: false,
      updatedAt: NOW,
    });
  });

  test.each([
    ["defaultMode", "sepia", "USER_PREFERENCES_INVALID_READER_MODE"],
    ["contentWidth", "medium", "USER_PREFERENCES_INVALID_CONTENT_WIDTH"],
    ["inboxTimestampHourCycle", "36h", "USER_PREFERENCES_INVALID_INBOX_TIMESTAMP_HOUR_CYCLE"],
  ])("rejects an unsupported %s without writing", async (key, value, code) => {
    const insert = mock();

    const error = await Effect.runPromise(
      Effect.flip(updateUserPreferences({ [key]: value } as never)).pipe(
        Effect.provide(
          Layer.mergeAll(
            fakeDb({ insert }),
            TestClock.layer(),
            Layer.succeed(CurrentUser, { userId: "user_1" }),
          ),
        ),
      ),
    );

    expect(error).toMatchObject({ _tag: "BadRequest", code });
    expect(insert).not.toHaveBeenCalled();
  });
});
