import { describe, expect, mock, test } from "bun:test";
import { Effect, Layer } from "effect";
import { TestClock } from "effect/testing";
import { getUserProfile } from "@modules/users/profile/account";
import { CurrentUser } from "@shared/effect/request";
import { fakeDb } from "@api-tests/support/layers";

/** Run as `user_1` against a fake client, with the clock at 2026-01-03. */
function run<A, E, R>(effect: Effect.Effect<A, E, R>, client: Parameters<typeof fakeDb>[0]) {
  const layer = Layer.mergeAll(
    fakeDb(client),
    TestClock.layer(),
    Layer.succeed(CurrentUser, { userId: "user_1" }),
  );
  return Effect.runPromise(
    Effect.gen(function* () {
      yield* TestClock.setTime(Date.parse("2026-01-03T00:00:00.000Z"));
      return yield* effect;
    }).pipe(Effect.provide(layer)) as Effect.Effect<A, E>,
  );
}

const failure = <A, E>(effect: Effect.Effect<A, E, never>) =>
  Effect.runPromise(Effect.flip(effect));

const profileRow = (overrides: Record<string, unknown> = {}) => ({
  id: "user_1",
  name: "Test",
  email: "t@example.com",
  emailVerified: true,
  image: null as string | null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-02T00:00:00.000Z"),
  ...overrides,
});

function updateReturning(rows: unknown[]) {
  const set = mock((_values: Record<string, unknown>) => ({
    where: () => ({ returning: () => Promise.resolve(rows) }),
  }));
  return { update: () => ({ set }), set };
}

describe("users profile", () => {
  test("getUserProfile returns the DTO when the user exists", async () => {
    const findFirst = mock(() => Promise.resolve(profileRow()));

    const out = await run(getUserProfile, { query: { users: { findFirst } } });

    expect(out).toEqual({
      id: "user_1",
      name: "Test",
      email: "t@example.com",
      emailVerified: true,
      image: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
    });
    expect(findFirst).toHaveBeenCalled();
  });

  test("getUserProfile fails with USER_NOT_FOUND when the user is missing", async () => {
    const findFirst = () => Promise.resolve(undefined);

    const error = await failure(
      getUserProfile.pipe(
        Effect.provide(
          Layer.mergeAll(
            fakeDb({ query: { users: { findFirst } } }),
            Layer.succeed(CurrentUser, { userId: "missing" }),
          ),
        ),
      ),
    );

    expect(error).toMatchObject({ _tag: "NotFound", code: "USER_NOT_FOUND" });
  });
});
