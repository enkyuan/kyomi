import { sql } from "drizzle-orm";
import { API_PACKAGE_VERSION } from "@config/package-info";
import { SERVICE_NAME } from "@config/constants";
import type { db } from "@adapters/db/client";
import { HEALTH_STATUS } from "./health.constants";
import type { HealthPayload, ReadinessPayload } from "./health.types";

type DB = typeof db;

export function getHealth(): HealthPayload {
  return {
    status: HEALTH_STATUS,
    service: SERVICE_NAME,
    now: new Date().toISOString(),
    version: API_PACKAGE_VERSION,
  };
}

export async function buildReadinessPayload(database: DB): Promise<ReadinessPayload> {
  const now = new Date().toISOString();
  const base = { service: SERVICE_NAME, now, version: API_PACKAGE_VERSION };
  try {
    await database.execute(sql`select 1`);
    return { ready: true, ...base };
  } catch {
    return { ready: false, ...base };
  }
}
