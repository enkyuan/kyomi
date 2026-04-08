import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@cronos/db";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("[db] Missing required DATABASE_URL");
}

export const db = drizzle(databaseUrl, { schema });
