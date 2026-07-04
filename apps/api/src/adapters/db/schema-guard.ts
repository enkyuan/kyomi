import { pool } from "./client";

const REQUIRED_DEV_TABLES = ["users", "sessions", "feeds", "memberships"] as const;
const REQUIRED_DEV_INDEXES = [
  "categories_slug_unique",
  "feed_items_feed_id_canonical_url_unique",
  "feed_item_tag_assignments_item_slug_provenance_unique",
  "feed_category_assignments_feed_category_provenance_unique",
  "feed_category_assignments_feed_category_provenance_model_unique",
  "feed_item_category_assignments_item_category_provenance_unique",
  "feed_item_category_assignments_item_category_provenance_model_unique",
] as const;

type TableRow = { table_name: string };
type IndexRow = { indexname: string };

export function findMissingRequiredTables(existingTables: string[]): string[] {
  const existing = new Set(existingTables);
  return REQUIRED_DEV_TABLES.filter((tableName) => !existing.has(tableName));
}

export function findMissingRequiredIndexes(existingIndexes: string[]): string[] {
  const existing = new Set(existingIndexes);
  return REQUIRED_DEV_INDEXES.filter((indexName) => !existing.has(indexName));
}

export async function assertDevelopmentDatabaseSchemaReady(): Promise<void> {
  const tablesResult = await pool.query<TableRow>(
    `
      select table_name
      from information_schema.tables
      where table_schema = 'public'
        and table_name = any($1::text[])
    `,
    [REQUIRED_DEV_TABLES],
  );
  const indexesResult = await pool.query<IndexRow>(
    `
      select indexname
      from pg_indexes
      where schemaname = 'public'
        and indexname = any($1::text[])
    `,
    [REQUIRED_DEV_INDEXES],
  );

  const missingTables = findMissingRequiredTables(tablesResult.rows.map((row) => row.table_name));
  const missingIndexes = findMissingRequiredIndexes(indexesResult.rows.map((row) => row.indexname));

  if (missingTables.length === 0 && missingIndexes.length === 0) {
    return;
  }

  const missingMessages = [
    missingTables.length > 0 ? `Missing tables: ${missingTables.join(", ")}` : null,
    missingIndexes.length > 0 ? `Missing indexes: ${missingIndexes.join(", ")}` : null,
  ].filter((message): message is string => Boolean(message));

  throw new Error(
    [
      "Development database is missing required schema objects.",
      ...missingMessages,
      "Run `bun run db:migrate` before starting the app.",
    ].join(" "),
  );
}
