import type { Database } from "@adapters/db/service";

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

/** A Drizzle client or an open transaction: what the SQL helpers inside one `db.use` accept. */
export type SqlClient = Database | Transaction;
