import { pool } from "./client";

const REQUIRED_DEV_TABLES = ["users", "sessions", "feeds", "memberships"] as const;

type TableRow = { table_name: string };

export function findMissingRequiredTables(existingTables: string[]): string[] {
  const existing = new Set(existingTables);
  return REQUIRED_DEV_TABLES.filter((tableName) => !existing.has(tableName));
}

export async function assertDevelopmentDatabaseSchemaReady(): Promise<void> {
  const result = await pool.query<TableRow>(
    `
      select table_name
      from information_schema.tables
      where table_schema = 'public'
        and table_name = any($1::text[])
    `,
    [REQUIRED_DEV_TABLES],
  );

  const missingTables = findMissingRequiredTables(result.rows.map((row) => row.table_name));
  if (missingTables.length === 0) {
    return;
  }

  throw new Error(
    [
      "Development database is missing required tables.",
      `Missing: ${missingTables.join(", ")}`,
      "Run `bun run db:migrate` before starting the app.",
    ].join(" "),
  );
}
