import { db, pool } from "@adapters/db/client";
import { assertApiDatabaseReady } from "@adapters/db/script-preflight";
import { searchFeeds } from "@modules/discover/service";

function getArgValue(flag: string): string | null {
  const index = process.argv.indexOf(flag);
  if (index === -1) {
    return null;
  }
  const value = process.argv[index + 1];
  return value && !value.startsWith("--") ? value : null;
}

async function main() {
  const query = getArgValue("--query") ?? "hacker news";
  const expected = (getArgValue("--expect") ?? "hacker news").toLowerCase();
  const probeUserId = getArgValue("--user-id") ?? "00000000-0000-0000-0000-000000000000";
  const limit = Number(getArgValue("--limit") ?? "20");

  await assertApiDatabaseReady({
    commandName: "catalog:smoke",
    ensureSchema: true,
  });

  const rows = await searchFeeds(db, probeUserId, query, Number.isFinite(limit) ? limit : 20);
  if (rows.length === 0) {
    throw new Error(`No results for query "${query}"`);
  }

  const matched = rows.some((row) =>
    `${row.title} ${row.url} ${row.description ?? ""}`.toLowerCase().includes(expected),
  );
  if (!matched) {
    throw new Error(`No results matched expected token "${expected}" for query "${query}"`);
  }

  console.log(
    JSON.stringify(
      {
        query,
        expected,
        resultCount: rows.length,
        topResult: rows[0]?.title ?? null,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error: unknown) => {
    console.error(
      "[catalog-smoke] failed:",
      error instanceof Error ? error.message : String(error),
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end().catch(() => undefined);
  });
