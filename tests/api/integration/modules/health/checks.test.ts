import { describe, expect, test } from "bun:test";
import type { db } from "@adapters/db/client";
import { buildReadinessPayload, getHealth } from "@modules/health/checks";

type DB = typeof db;

describe("health checks", () => {
  test("getHealth includes semver version", () => {
    const payload = getHealth();
    expect(payload.status).toBe("ok");
    expect(payload.version).toMatch(/^\d+\.\d+\.\d+/);
  });

  test("buildReadinessPayload is ready when database execute succeeds", async () => {
    const fakeDb = {
      execute: async () => undefined,
    } as unknown as DB;

    const payload = await buildReadinessPayload(fakeDb);
    expect(payload.ready).toBe(true);
    expect(payload.service.length).toBeGreaterThan(0);
    expect(payload.version).toMatch(/^\d+\.\d+\.\d+/);
    expect(payload.now).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  test("buildReadinessPayload is not ready when database execute throws", async () => {
    const fakeDb = {
      execute: async () => {
        throw new Error("connection refused");
      },
    } as unknown as DB;

    const payload = await buildReadinessPayload(fakeDb);
    expect(payload.ready).toBe(false);
    expect(payload.service.length).toBeGreaterThan(0);
    expect(payload.version).toMatch(/^\d+\.\d+\.\d+/);
  });
});
