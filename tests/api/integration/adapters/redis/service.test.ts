import { describe, expect, test } from "bun:test";
import { redisClientOptions } from "@adapters/redis/service";

const settings = {
  REDIS_URL: "redis://127.0.0.1:6379",
  REDIS_CONNECT_TIMEOUT_MS: 10_000,
  REDIS_COMMAND_TIMEOUT_MS: 5_000,
};

describe("redisClientOptions", () => {
  test("bounds how long a connection attempt and a command can take", () => {
    expect(redisClientOptions(settings)).toMatchObject({
      connectTimeout: 10_000,
      commandTimeout: 5_000,
    });
  });

  test("follows the configured timeouts", () => {
    expect(
      redisClientOptions({
        ...settings,
        REDIS_CONNECT_TIMEOUT_MS: 2_000,
        REDIS_COMMAND_TIMEOUT_MS: 750,
      }),
    ).toMatchObject({ connectTimeout: 2_000, commandTimeout: 750 });
  });

  test("a command timeout of 0 means no limit, not an immediate timeout", () => {
    expect(
      redisClientOptions({ ...settings, REDIS_COMMAND_TIMEOUT_MS: 0 }).commandTimeout,
    ).toBeUndefined();
  });
});
