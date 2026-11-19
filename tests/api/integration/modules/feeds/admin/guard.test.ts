import { describe, expect, test } from "bun:test";
import { Effect } from "effect";
import { requireFeedAdmin } from "@modules/feeds/admin/guard";
import { testConfig } from "@api-tests/support/layers";

/** The guard's failure, or `null` when it lets the caller through. */
const denial = (config: Record<string, string>, userId: string, headers?: Headers) =>
  Effect.runPromise(
    requireFeedAdmin(userId, headers).pipe(
      Effect.as(null),
      Effect.catch((error) => Effect.succeed(error)),
      Effect.provide(testConfig(config)),
    ),
  );

describe("requireFeedAdmin", () => {
  test("allows a user on the allowlist", async () => {
    expect(await denial({ FEED_ADMIN_USER_IDS: "a, b" }, "b")).toBeNull();
  });

  test("allows a caller presenting the shared secret, rejects a wrong one", async () => {
    const config = { FEED_ADMIN_SHARED_SECRET: "s3cret" };

    expect(
      await denial(config, "x", new Headers({ "x-feed-admin-secret": " s3cret " })),
    ).toBeNull();
    expect(await denial(config, "x", new Headers({ "x-feed-admin-secret": "nope" }))).toMatchObject(
      {
        _tag: "Forbidden",
        code: "FEED_ADMIN_FORBIDDEN",
      },
    );
    expect(await denial(config, "x")).toMatchObject({ code: "FEED_ADMIN_FORBIDDEN" });
  });

  test("is FEED_ADMIN_DISABLED when neither an allowlist nor a secret is configured", async () => {
    expect(await denial({}, "a")).toMatchObject({ _tag: "Forbidden", code: "FEED_ADMIN_DISABLED" });
  });

  test("is FEED_ADMIN_FORBIDDEN for an unlisted user when an allowlist exists", async () => {
    expect(await denial({ FEED_ADMIN_USER_IDS: "a" }, "b")).toMatchObject({
      code: "FEED_ADMIN_FORBIDDEN",
    });
  });
});
