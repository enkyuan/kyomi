import { pool } from "@adapters/db/client";
import { assertApiDatabaseReady } from "@adapters/db/preflight";
import {
  parseBackfillArgs,
  runCategoryBackfill,
  summarizeBackfill,
} from "@modules/catalog/backfill";

const args = parseBackfillArgs(process.argv);

try {
  await assertApiDatabaseReady({
    commandName: "categories:backfill",
    ensureSchema: true,
  });
  const stats = await runCategoryBackfill(args);
  console.log(summarizeBackfill(stats));
} finally {
  await pool.end();
}
