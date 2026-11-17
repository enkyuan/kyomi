import type { Database } from "@adapters/db/service";

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

/** A Drizzle client or an open transaction: what the SQL helpers inside one `db.use` accept. */
export type SqlClient = Database | Transaction;

/** `db.execute` returns an array (postgres-js) or `{ rows }` (node-postgres); read both. */
export function rowsFromExecute<T>(result: unknown): T[] {
  if (Array.isArray(result)) {
    return result as T[];
  }
  if (result && typeof result === "object" && "rows" in result) {
    return (result as { rows: T[] }).rows;
  }
  return [];
}
